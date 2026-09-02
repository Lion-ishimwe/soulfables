/**
 * What a story is about, on a card.
 *
 * A shelf is where a story lives and a theme is what it is about, which
 * is why both exist and why only one of them belongs on the card twice
 * over. Two themes is the useful number: enough to tell a reader what
 * they are walking into, few enough that the card stays a card.
 *
 * Colour is assigned per theme so the same subject reads the same way
 * everywhere — Grief is the same blue on the Library, on a shelf, and in
 * the admin. Themes the House adds later fall through to a deterministic
 * hash rather than to grey, the same approach the drawn covers take: an
 * unknown theme should look considered, not unfinished.
 */

const ACCENT: Record<string, string> = {
  heartbreak: '#C4707F',
  healing: '#6FAE84',
  identity: '#9B8AC4',
  grief: '#7C93B8',
  hope: '#D9A441',
  forgiveness: '#6FA8A8',
  growth: '#7FB069',
  'self-worth': '#D0A05C',
  family: '#C08A5E',
  love: '#C97B8E',
  purpose: '#C9A227',
  nostalgia: '#A88BB0',
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
