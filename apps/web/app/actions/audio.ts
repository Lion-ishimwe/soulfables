'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { z } from 'zod';
import { field } from '@/lib/form';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Narration, attached to a story.
 *
 * A narration file is tens of megabytes, and a server action carries
 * ten at most. So the file does not pass through the server at all:
 * the browser asks for a signed upload address, sends the file straight
 * to the private bucket, and then tells the server it is there. Three
 * steps, each guarded by staff, none of which streams audio through the
 * instance.
 *
 * Only the third step writes the row. A file that was uploaded and never
 * confirmed is an object nobody can reach, which is harmless; a row
 * without a file would be a promise, which is not.
 */

export type AudioActionResult = {
  error?: string;
  message?: string;
  /** For the first step: where to send the file. */
  upload?: { signedUrl: string; token: string; path: string };
};

const FORMAT_BY_EXT: Record<string, string> = { mp3: 'mp3', m4a: 'm4a', aac: 'aac', ogg: 'ogg' };
const MAX_BYTES = 500 * 1024 * 1024;

async function storyIdFor(slug: string): Promise<string | null> {
  const db = createAdminClient();
  const { data } = await db.from('stories').select('id').eq('slug', slug).maybeSingle();
  return (data?.id as string) ?? null;
}

const beginSchema = z.object({
  storySlug: z.string().trim().min(1),
  filename: z.string().trim().min(1).max(200),
  size: z.coerce.number().int().positive().max(MAX_BYTES, 'Narration files are limited to 500 MB.'),
});

/** Step one: a place to put the file. */
export async function beginAudioUpload(
  _prev: AudioActionResult,
  formData: FormData,
): Promise<AudioActionResult> {
  await requireStaff();
  if (isDemoMode()) return { error: 'Demo mode has nowhere to put a file.' };

  const parsed = beginSchema.safeParse({
    storySlug: field(formData, 'storySlug'),
    filename: field(formData, 'filename'),
    size: field(formData, 'size'),
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const ext = parsed.data.filename.split('.').pop()?.toLowerCase() ?? '';
  const format = FORMAT_BY_EXT[ext];
  if (!format) return { error: 'Narration comes as MP3, M4A, AAC or OGG.' };

  const storyId = await storyIdFor(parsed.data.storySlug);
  if (!storyId) return { error: 'That story could not be found.' };

  // A fresh path per upload, so a re-recording never overwrites the one
  // a reader may be listening to right now.
  const path = `audio/${storyId}/${Date.now()}.${format}`;

  const db = createAdminClient();
  const { data, error } = await db.storage.from('protected-media').createSignedUploadUrl(path);
  if (error || !data) {
    console.error('[audio] signed upload url', error?.message);
    return { error: 'Could not prepare the upload. Try again in a moment.' };
  }

  return { upload: { signedUrl: data.signedUrl, token: data.token, path } };
}

const finishSchema = z.object({
  storySlug: z.string().trim().min(1),
  path: z.string().trim().min(1),
  size: z.coerce.number().int().positive(),
  durationSeconds: z.coerce.number().int().nonnegative().optional(),
  narrator: z.string().trim().max(120).optional().or(z.literal('')),
  access: z.enum(['free', 'premium']).default('free'),
});

/** Step two: the file is there; now the story knows about it. */
export async function finishAudioUpload(
  _prev: AudioActionResult,
  formData: FormData,
): Promise<AudioActionResult> {
  const viewer = await requireStaff();
  if (isDemoMode()) return { error: 'Demo mode has nowhere to put a file.' };

  const parsed = finishSchema.safeParse({
    storySlug: field(formData, 'storySlug'),
    path: field(formData, 'path'),
    size: field(formData, 'size'),
    durationSeconds: field(formData, 'durationSeconds') || undefined,
    narrator: field(formData, 'narrator'),
    access: field(formData, 'access') || 'free',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const storyId = await storyIdFor(d.storySlug);
  if (!storyId) return { error: 'That story could not be found.' };

  // The path must be one this story was given, and the object must exist:
  // the row is a claim, and a claim is checked before it is written.
  if (!d.path.startsWith(`audio/${storyId}/`)) return { error: 'That upload does not belong to this story.' };

  const db = createAdminClient();
  const dir = d.path.slice(0, d.path.lastIndexOf('/'));
  const name = d.path.slice(d.path.lastIndexOf('/') + 1);
  const { data: listed } = await db.storage.from('protected-media').list(dir, { search: name });
  if (!listed?.some((o) => o.name === name)) return { error: 'The file did not arrive. Try the upload again.' };

  const format = d.path.split('.').pop() ?? 'mp3';

  // One narration per story per format: a re-recording replaces the row
  // and the old object goes, so the bucket holds what the House offers.
  const { data: previous } = await db
    .from('story_audio')
    .select('id, storage_path')
    .eq('story_id', storyId);

  const { error: upsertError } = await db.from('story_audio').upsert(
    {
      story_id: storyId,
      storage_path: d.path,
      format,
      duration_seconds: d.durationSeconds ?? null,
      file_size_bytes: d.size,
      narrator: d.narrator || null,
      access: d.access,
    },
    { onConflict: 'story_id,format' },
  );
  if (upsertError) return { error: `Could not record the narration: ${upsertError.message}` };

  const stale = (previous ?? []).map((p) => p.storage_path as string).filter((p) => p && p !== d.path);
  if (stale.length) await db.storage.from('protected-media').remove(stale);
  if (previous?.length) {
    // Other formats' rows would now be a second narration; keep one.
    await db.from('story_audio').delete().eq('story_id', storyId).neq('storage_path', d.path);
  }

  await db.from('audit_log').insert({
    action: 'story.narration.upload',
    entity_type: 'story',
    entity_id: storyId,
    actor_id: viewer.id,
    actor_email: viewer.email,
    after: { path: d.path, bytes: d.size, duration: d.durationSeconds ?? null, access: d.access },
  }).then(() => undefined, () => undefined);

  revalidateTag('content');
  revalidatePath(`/admin/stories/${d.storySlug}`);
  revalidatePath(`/story/${d.storySlug}`);

  return { message: 'Narration attached. Readers can listen now.' };
}

export async function removeStoryAudio(formData: FormData): Promise<void> {
  await requireStaff();
  if (isDemoMode()) return;
  const slug = field(formData, 'storySlug') ?? '';
  const storyId = await storyIdFor(slug);
  if (!storyId) return;

  const db = createAdminClient();
  const { data: rows } = await db.from('story_audio').select('storage_path').eq('story_id', storyId);
  const paths = (rows ?? []).map((r) => r.storage_path as string).filter(Boolean);
  await db.from('story_audio').delete().eq('story_id', storyId);
  if (paths.length) await db.storage.from('protected-media').remove(paths);

  revalidateTag('content');
  revalidatePath(`/admin/stories/${slug}`);
  revalidatePath(`/story/${slug}`);
}

const generateSchema = z.object({
  storySlug: z.string().trim().min(1),
  voice: z.string().trim().min(1).max(40).optional(),
  access: z.enum(['free', 'premium']).default('free'),
});

/**
 * A generated voice reads the story, now.
 *
 * The body is read by the service role — the whole story, chapters and
 * all, whatever the reader-side grants withhold — spoken in pieces, put
 * in the private bucket, and recorded as narration with `generated` set,
 * so the player says a synthetic voice is reading. A few cents a story.
 */
export async function generateStoryAudio(
  _prev: AudioActionResult,
  formData: FormData,
): Promise<AudioActionResult> {
  const viewer = await requireStaff();
  if (isDemoMode()) return { error: 'Demo mode has nowhere to put a file.' };

  const parsed = generateSchema.safeParse({
    storySlug: field(formData, 'storySlug'),
    voice: field(formData, 'voice') || undefined,
    access: field(formData, 'access') || 'free',
  });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const { synthesise, VOICES, defaultVoice } = await import('@/lib/audio/tts');
  const voice = VOICES.some((v) => v.id === d.voice) ? (d.voice as string) : defaultVoice();

  const db = createAdminClient();
  const { data: story } = await db
    .from('stories')
    .select('id, title, body_mdx, release_mode, story_chapters(number, body_mdx, status)')
    .eq('slug', d.storySlug)
    .maybeSingle();
  if (!story) return { error: 'That story could not be found.' };

  // A serial is its chapters, in order; a whole story is its body.
  const chapters = ((story.story_chapters as { number: number; body_mdx: string; status: string }[]) ?? [])
    .sort((a, b) => a.number - b.number);
  const text =
    story.release_mode === 'serial' && chapters.length
      ? chapters.map((c) => c.body_mdx).join('\n\n')
      : (story.body_mdx as string) ?? '';
  if (text.trim().split(/\s+/).length < 20) return { error: 'There is not enough written to read aloud.' };

  let spoken;
  try {
    spoken = await synthesise(`${story.title}.\n\n${text}`, voice);
  } catch (e) {
    console.error('[audio] synthesis failed', e);
    const reason = e instanceof Error ? e.message : 'unknown';
    return {
      error: /not authorized|AccessDenied|credential/i.test(reason)
        ? 'The server is not allowed to speak yet — the instance role needs Polly permission. See the deployment guide.'
        : `The voice could not read it: ${reason}`,
    };
  }

  const path = `audio/${story.id}/${Date.now()}.mp3`;
  const { error: uploadError } = await db.storage
    .from('protected-media')
    .upload(path, spoken.audio, { contentType: 'audio/mpeg', upsert: false });
  if (uploadError) return { error: `Could not store the narration: ${uploadError.message}` };

  const { data: previous } = await db.from('story_audio').select('storage_path').eq('story_id', story.id);
  const { error: upsertError } = await db.from('story_audio').upsert(
    {
      story_id: story.id,
      storage_path: path,
      format: 'mp3',
      duration_seconds: spoken.durationSeconds,
      file_size_bytes: spoken.audio.byteLength,
      narrator: `${voice} (generated)`,
      access: d.access,
      generated: true,
    },
    { onConflict: 'story_id,format' },
  );
  if (upsertError) {
    await db.storage.from('protected-media').remove([path]);
    return { error: `Could not record the narration: ${upsertError.message}` };
  }
  const stale = (previous ?? []).map((p) => p.storage_path as string).filter((p) => p && p !== path);
  if (stale.length) {
    await db.from('story_audio').delete().eq('story_id', story.id).neq('storage_path', path);
    await db.storage.from('protected-media').remove(stale);
  }

  await db.from('audit_log').insert({
    action: 'story.narration.generate',
    entity_type: 'story',
    entity_id: story.id,
    actor_id: viewer.id,
    actor_email: viewer.email,
    after: { path, voice, characters: spoken.characters, bytes: spoken.audio.byteLength, access: d.access },
  }).then(() => undefined, () => undefined);

  revalidateTag('content');
  revalidatePath(`/admin/stories/${d.storySlug}`);
  revalidatePath(`/story/${d.storySlug}`);

  const minutes = Math.max(1, Math.round(spoken.durationSeconds / 60));
  return { message: `${voice} has read it — about ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}. Readers can listen now.` };
}
