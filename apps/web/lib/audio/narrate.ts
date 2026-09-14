import 'server-only';
import { createHash } from 'node:crypto';
import { revalidatePath, revalidateTag } from 'next/cache';
import { createAdminClient } from '@/lib/supabase/admin';
import { isDemoMode } from '@/lib/demo/mode';
import { synthesise, VOICES, defaultVoice } from './tts';

/**
 * Reading a story aloud, and deciding whether it needs reading.
 *
 * narrateStory() is the act: gather the words, have the voice read them,
 * put the file in the private bucket, record the narration. It is what
 * the admin's button calls and what publication calls.
 *
 * ensureNarration() is the judgement: is the House's switch on, is the
 * story published, is there a recording by a person (which is never
 * replaced), have the words changed since the last reading? Only then
 * does it read. It never throws — it is called after a publish has
 * already succeeded, and a failed reading must not undo a publication.
 * It says what it did, for the log.
 */

export type NarrateOutcome =
  | { done: true; voice: string; durationSeconds: number; characters: number }
  | { done: false; reason: string };

/** The words a story is read from: chapters in order for a serial, the body otherwise. */
async function storyText(storyId: string): Promise<{ title: string; text: string; slug: string; status: string } | null> {
  const db = createAdminClient();
  const { data: story } = await db
    .from('stories')
    .select('slug, title, status, body_mdx, release_mode, story_chapters(number, body_mdx, status)')
    .eq('id', storyId)
    .maybeSingle();
  if (!story) return null;

  const chapters = ((story.story_chapters as { number: number; body_mdx: string; status: string }[]) ?? [])
    .filter((c) => c.status === 'published')
    .sort((a, b) => a.number - b.number);
  const text =
    story.release_mode === 'serial' && chapters.length
      ? chapters.map((c) => c.body_mdx).join('\n\n')
      : ((story.body_mdx as string) ?? '');

  return { title: story.title as string, text, slug: story.slug as string, status: story.status as string };
}

const hashOf = (s: string) => createHash('sha256').update(s).digest('hex');

export async function narrateStory(opts: {
  storyId?: string;
  /** Alternative to storyId, for callers that hold the address. */
  slug?: string;
  voice?: string;
  access?: 'free' | 'premium';
  actor?: { id: string | null; email: string | null };
  /** Why this reading happened, for the audit line. */
  reason?: string;
}): Promise<NarrateOutcome> {
  if (isDemoMode()) return { done: false, reason: 'demo' };

  const voice = VOICES.some((v) => v.id === opts.voice) ? (opts.voice as string) : defaultVoice();

  let storyId = opts.storyId ?? '';
  if (!storyId && opts.slug) {
    const { data } = await createAdminClient().from('stories').select('id').eq('slug', opts.slug).maybeSingle();
    storyId = (data?.id as string) ?? '';
  }
  if (!storyId) return { done: false, reason: 'no such story' };

  const words = await storyText(storyId);
  if (!words) return { done: false, reason: 'no such story' };
  if (words.text.trim().split(/\s+/).length < 20) return { done: false, reason: 'not enough written to read' };

  const spoken = await synthesise(`${words.title}.\n\n${words.text}`, voice);
  const db = createAdminClient();
  const path = `audio/${storyId}/${Date.now()}.mp3`;

  const { error: uploadError } = await db.storage
    .from('protected-media')
    .upload(path, spoken.audio, { contentType: 'audio/mpeg', upsert: false });
  if (uploadError) throw new Error(`Could not store the narration: ${uploadError.message}`);

  const { data: previous } = await db.from('story_audio').select('storage_path, access').eq('story_id', storyId);
  const access = opts.access ?? ((previous?.[0]?.access as 'free' | 'premium' | undefined) ?? 'free');

  const { error: upsertError } = await db.from('story_audio').upsert(
    {
      story_id: storyId,
      storage_path: path,
      format: 'mp3',
      duration_seconds: spoken.durationSeconds,
      file_size_bytes: spoken.audio.byteLength,
      narrator: `${voice} (generated)`,
      access,
      generated: true,
      source_hash: hashOf(words.text),
    },
    { onConflict: 'story_id,format' },
  );
  if (upsertError) {
    await db.storage.from('protected-media').remove([path]);
    throw new Error(`Could not record the narration: ${upsertError.message}`);
  }

  const stale = (previous ?? []).map((p) => p.storage_path as string).filter((p) => p && p !== path);
  if (stale.length) {
    await db.from('story_audio').delete().eq('story_id', storyId).neq('storage_path', path);
    await db.storage.from('protected-media').remove(stale);
  }

  await db
    .from('audit_log')
    .insert({
      action: 'story.narration.generate',
      entity_type: 'story',
      entity_id: storyId,
      actor_id: opts.actor?.id ?? null,
      actor_email: opts.actor?.email ?? null,
      after: { path, voice, characters: spoken.characters, bytes: spoken.audio.byteLength, access, reason: opts.reason ?? 'manual' },
    })
    .then(() => undefined, () => undefined);

  revalidateTag('content');
  revalidatePath(`/story/${words.slug}`);
  revalidatePath(`/admin/stories/${words.slug}`);

  return { done: true, voice, durationSeconds: spoken.durationSeconds, characters: spoken.characters };
}

/**
 * Read this story aloud if it should be, and is not already.
 *
 * Called after a publish, a release, or a save of something published.
 * Runs after the response has gone, so the person who pressed Publish
 * is not kept waiting for a voice to finish.
 */
export async function ensureNarration(slug: string, reason: string): Promise<NarrateOutcome> {
  try {
    if (isDemoMode()) return { done: false, reason: 'demo' };
    const db = createAdminClient();

    const { data: house } = await db.from('house_settings').select('auto_narration').eq('id', 1).maybeSingle();
    if (house && house.auto_narration === false) return { done: false, reason: 'switched off' };

    const { data: story } = await db
      .from('stories')
      .select('id, status, story_audio(generated, source_hash)')
      .eq('slug', slug)
      .maybeSingle();
    if (!story) return { done: false, reason: 'no such story' };
    if (story.status !== 'published') return { done: false, reason: 'not published' };

    const existing = ((story.story_audio as { generated: boolean; source_hash: string | null }[] | null) ?? [])[0];
    if (existing && !existing.generated) return { done: false, reason: 'a recording exists' };

    const words = await storyText(story.id as string);
    if (!words) return { done: false, reason: 'no such story' };
    if (existing?.source_hash && existing.source_hash === hashOf(words.text)) {
      return { done: false, reason: 'words unchanged' };
    }

    const outcome = await narrateStory({ storyId: story.id as string, reason });
    console.info('[narration]', slug, outcome.done ? `read by ${outcome.voice}` : outcome.reason);
    return outcome;
  } catch (e) {
    console.error('[narration] failed for', slug, e instanceof Error ? e.message : e);
    return { done: false, reason: e instanceof Error ? e.message : 'failed' };
  }
}

/** Every published story that has no narration at all, read aloud in turn. */
export async function narrateMissing(reason: string): Promise<{ attempted: number; read: number }> {
  const db = createAdminClient();
  const { data } = await db
    .from('stories')
    .select('slug, story_audio(id)')
    .eq('status', 'published');
  const missing = (data ?? []).filter((s) => ((s.story_audio as unknown[] | null) ?? []).length === 0);
  let read = 0;
  for (const s of missing) {
    const outcome = await ensureNarration(s.slug as string, reason);
    if (outcome.done) read += 1;
  }
  return { attempted: missing.length, read };
}
