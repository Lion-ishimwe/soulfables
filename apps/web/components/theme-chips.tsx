/**
 * What a story is about, on a card.
 *
 * A shelf is where a story lives — the feeling a reader arrives carrying
 * — and a theme is what the story is about. The two vocabularies share no
 * word, and a database trigger keeps it that way, because the first
 * version of them overlapped on six and a story on the Grief shelf could
 * be tagged "Grief" and say nothing.
 *
 * Two themes is the useful number: enough to tell a reader what they are
 * walking into, few enough that the card stays a card.
 *
 * Colour is assigned per theme so the same subject reads the same way
 * everywhere — Memory is the same blue on the Library, on a shelf, and
 * in the admin. Themes the House adds later fall through to a deterministic
 * hash rather than to grey, the same approach the drawn covers take: an
 * unknown theme should look considered, not unfinished.
 */

const ACCENT: Record<string, string> = {
  // Self
  identity: '#9B8AC4',
  'self-worth': '#D0A05C',
  becoming: '#7FB069',
  belonging: '#6FA8A8',
  // People
  family: '#C08A5E',
  motherhood: '#C4849B',
  friendship: '#D9A441',
  marriage: '#C97B8E',
  devotion: '#C4707F',
  betrayal: '#A85A5A',
  // What is unsaid
  secrets: '#7C6FA8',
  silence: '#8A8FA0',
  // Time
  memory: '#7C93B8',
  nostalgia: '#A88BB0',
  regret: '#9A7B86',
  // Place and movement
  home: '#C9925E',
  leaving: '#6F93AE',
  return: '#6FAE84',
  'letting-go': '#8FB0A8',
  // Meaning
  purpose: '#C9A227',
  faith: '#D9C089',
};

/** The palette an unnamed theme draws from. Muted, so nothing shouts. */
const SPARE = ['#9B8AC4', '#6FAE84', '#C4707F', '#7C93B8', '#D9A441', '#C08A5E'];

function accentFor(slug: string): string {
  if (ACCENT[slug]) return ACCENT[slug];

  let h = 2166136261;
  for (let i = 0; i < slug.length; i++) {
    h ^= slug.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return SPARE[Math.abs(h) % SPARE.length];
}

export function ThemeChips({
  themes,
  limit = 2,
  className = '',
}: {
  themes?: { slug: string; label: string }[];
  limit?: number;
  className?: string;
}) {
  if (!themes?.length) return null;

  const shown = themes.slice(0, limit);
  const hidden = themes.length - shown.length;

  return (
    <ul className={`flex flex-wrap items-center gap-x-3 gap-y-1.5 ${className}`}>
      {shown.map((t) => (
        <li
          key={t.slug}
          className="flex items-center gap-1.5 font-ui text-xs text-grey-muted"
        >
          {/* A mark rather than a filled pill: twelve filled pills on a
              grid of cards is a page of badges, not a page of stories. */}
          <span aria-hidden="true" style={{ color: accentFor(t.slug) }}>
            ✦
          </span>
          {t.label}
        </li>
      ))}
      {hidden > 0 && (
        <li className="font-ui text-xs text-grey-faint">+{hidden}</li>
      )}
    </ul>
  );
}
