import 'server-only';
import { isDemoMode } from './demo/mode';

/**
 * The weekly letter.
 *
 * One story, one reflection, every Sunday. A letter is written in the
 * admin as Markdown, kept as a draft until it is sent, and sent once to
 * every confirmed subscriber through the same email service the rest of
 * the House uses. A sent letter is published on /letter/<slug> for
 * anyone who joins later. Nothing here sends by itself.
 */

export type PublishedLetter = {
  slug: string;
  volume: number;
  number: number;
  title: string;
  dek: string | null;
  publishedAt: string | null;
};

export type Letter = PublishedLetter & {
  id: string;
  subject: string | null;
  body: string;
  status: string;
  sentAt: string | null;
  featuredStory: { id: string; slug: string; title: string } | null;
};

function shape(r: Record<string, unknown>): Letter {
  const story = (r.featured_story as Record<string, unknown> | Record<string, unknown>[] | null) ?? null;
  const one = Array.isArray(story) ? story[0] : story;
  return {
    id: r.id as string,
    slug: r.slug as string,
    volume: Number(r.volume ?? 1),
    number: Number(r.number ?? 0),
    title: r.title as string,
    subject: (r.subject as string) ?? null,
    dek: (r.dek as string) ?? null,
    body: (r.body_mdx as string) ?? '',
    status: r.status as string,
    publishedAt: (r.published_at as string) ?? null,
    sentAt: (r.sent_at as string) ?? null,
    featuredStory: one ? { id: one.id as string, slug: one.slug as string, title: one.title as string } : null,
  };
}

const SELECT = 'id, slug, volume, number, title, subject, dek, body_mdx, status, published_at, sent_at, featured_story:stories!letters_featured_story_id_fkey(id, slug, title)';

/** The letters already sent, newest first. Public, like a published story. */
export async function getPublishedLetters(): Promise<PublishedLetter[]> {
  if (isDemoMode()) return [];
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  const { data, error } = await supabase
    .from('letters')
    .select('slug, volume, number, title, dek, published_at')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(52);
  if (error) {
    console.error('[letters] getPublishedLetters', error.message);
    return [];
  }
  return (data ?? []).map((r: Record<string, unknown>) => ({
    slug: r.slug as string,
    volume: Number(r.volume ?? 1),
    number: Number(r.number ?? 0),
    title: r.title as string,
    dek: (r.dek as string) ?? null,
    publishedAt: (r.published_at as string) ?? null,
  }));
}

/** One sent letter, for its public page. */
export async function getPublishedLetter(slug: string): Promise<Letter | null> {
  if (isDemoMode()) return null;
  const { createPublicClient } = await import('./supabase/server');
  const supabase = createPublicClient();
  const { data, error } = await supabase.from('letters').select(SELECT).eq('slug', slug).eq('status', 'published').maybeSingle();
  if (error) {
    console.error('[letters] getPublishedLetter', error.message);
    return null;
  }
  return data ? shape(data as Record<string, unknown>) : null;
}

/** Any letter, draft or sent, for the editor. Staff session. */
export async function getLetterForEditing(id: string): Promise<Letter | null> {
  if (isDemoMode()) return null;
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data, error } = await supabase.from('letters').select(SELECT).eq('id', id).maybeSingle();
  if (error) {
    console.error('[letters] getLetterForEditing', error.message);
    return null;
  }
  return data ? shape(data as Record<string, unknown>) : null;
}

/** Published stories the editor may feature. */
export async function listStoryChoices(): Promise<{ id: string; title: string }[]> {
  if (isDemoMode()) return [];
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase.from('stories').select('id, title').eq('status', 'published').order('title');
  return ((data ?? []) as { id: string; title: string }[]).map((s) => ({ id: s.id, title: s.title }));
}

/** The next issue number: one past the highest so far. */
export async function nextLetterNumber(): Promise<number> {
  if (isDemoMode()) return 1;
  const { createClient } = await import('./supabase/server');
  const supabase = await createClient();
  const { data } = await supabase.from('letters').select('number').order('number', { ascending: false }).limit(1).maybeSingle();
  return Number((data as { number?: number } | null)?.number ?? 0) + 1;
}

export function slugifyLetter(title: string, number: number): string {
  const base = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
  return base ? `${base}-${number}` : `letter-${number}`;
}

/**
 * The letter's Markdown, rendered the small way.
 *
 * Paragraphs, a line beginning "::" as a heading, "> " as a quote,
 * **bold**, *italic* and [links](https://…). Everything is escaped
 * first, so a letter can never carry markup into a reader's inbox or
 * the page. Enough for a letter; a story has its own renderer.
 */
export function renderLetterHtml(markdown: string): string {
  const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (t: string) =>
    esc(t)
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#C89528">$1</a>');
  return markdown
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean)
    .map((block) => {
      if (block.startsWith('::')) return `<h2 style="font-family:Georgia,serif;font-weight:400;font-size:22px;margin:28px 0 8px">${inline(block.replace(/^::\s*/, ''))}</h2>`;
      if (block.startsWith('>')) return `<blockquote style="border-left:2px solid #C89528;margin:16px 0;padding:4px 16px;color:#8A8A8A;font-style:italic">${inline(block.replace(/^>\s?/gm, ''))}</blockquote>`;
      return `<p style="margin:0 0 16px;line-height:1.7">${inline(block).replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}
