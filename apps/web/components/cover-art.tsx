/**
 * Generated cover art.
 *
 * Soulfables has no photography yet, and inventing some from stock would
 * mean the platform depending on assets the House does not own. So covers
 * are drawn instead — from the story's own shelf, title and author.
 *
 * Every cover is a real image the moment one is uploaded: `cover_image`
 * exists on both `stories` and `products`, and the <Cover> component
 * below renders the photograph whenever there is one and falls back to
 * this only when there is not. Nothing has to change to switch over.
 *
 * The art is deterministic — the same story always gets the same cover —
 * because a cover that reshuffles on every render is a cover nobody can
 * recognise on a shelf.
 */

/** Deep, desaturated grounds. One per shelf, so a shelf reads as a place. */
const SHELF_PALETTE: Record<string, { deep: string; lift: string }> = {
  heartbreak: { deep: '#1A0E12', lift: '#3A1822' },
  healing: { deep: '#0E1712', lift: '#1C3226' },
  grief: { deep: '#101317', lift: '#1E2833' },
  anxiety: { deep: '#0F1018', lift: '#1E2036' },
  change: { deep: '#0C1418', lift: '#173039' },
  love: { deep: '#1A1410', lift: '#3A2A18' },
  loneliness: { deep: '#121016', lift: '#26202F' },
  hope: { deep: '#161206', lift: '#332913' },
  forgiveness: { deep: '#141416', lift: '#2A2A2E' },
};

const DEFAULT_PALETTE = { deep: '#0F0F10', lift: '#26262A' };

/** Stable hash, so a title always yields the same arrangement. */
function hash(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

export function CoverArt({
  title,
  author,
  shelf,
  className,
}: {
  title: string;
  author?: string | null;
  shelf?: string | null;
  className?: string;
}) {
  const palette = SHELF_PALETTE[shelf ?? ''] ?? DEFAULT_PALETTE;
  const seed = hash(title);

  // Where the lamp sits, and how far it reaches. Varies per title but
  // always upper-middle, so the type below it stays legible.
  const glowX = 30 + (seed % 40);
  const glowY = 22 + ((seed >> 3) % 16);
  const glowR = 48 + ((seed >> 6) % 22);

  // A few horizontal rules, like shelf edges seen in the dark.
  const ruleCount = 2 + (seed % 3);
  const rules = Array.from({ length: ruleCount }, (_, i) => {
    const y = 60 + i * 9 + ((seed >> (i + 2)) % 5);
    const inset = 12 + ((seed >> (i + 4)) % 16);
    return { y, inset };
  });

  const id = `c${seed.toString(36)}`;

  // Long titles need a smaller face and more lines.
  const words = title.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > 14 && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current = `${current} ${word}`.trim();
    }
  }
  if (current) lines.push(current);

  const titleSize = lines.length > 3 ? 8 : lines.length > 2 ? 9.5 : 11;
  const startY = 50 - ((lines.length - 1) * titleSize * 1.15) / 2;

  return (
    <svg
      viewBox="0 0 100 150"
      className={className}
      role="img"
      aria-label={`Cover for ${title}`}
      preserveAspectRatio="xMidYMid slice"
    >
      <defs>
        <linearGradient id={`${id}-ground`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={palette.lift} />
          <stop offset="55%" stopColor={palette.deep} />
          <stop offset="100%" stopColor="#08080A" />
        </linearGradient>

        <radialGradient id={`${id}-lamp`}>
          <stop offset="0%" stopColor="#C89528" stopOpacity="0.30" />
          <stop offset="45%" stopColor="#C89528" stopOpacity="0.10" />
          <stop offset="100%" stopColor="#C89528" stopOpacity="0" />
        </radialGradient>
      </defs>

      <rect width="100" height="150" fill={`url(#${id}-ground)`} />
      <circle
        cx={glowX}
        cy={glowY}
        r={glowR}
        fill={`url(#${id}-lamp)`}
      />

      {/* Shelf edges, barely there. */}
      {rules.map((r, i) => (
        <line
          key={i}
          x1={r.inset}
          y1={r.y}
          x2={100 - r.inset}
          y2={r.y}
          stroke="#F4ECDC"
          strokeOpacity="0.06"
          strokeWidth="0.4"
        />
      ))}

      {/* The House mark. */}
      <text
        x="50"
        y="22"
        textAnchor="middle"
        fill="#C89528"
        fontSize="5"
        fontFamily="Georgia, serif"
      >
        ✦
      </text>

      {/* Title. */}
      {lines.map((line, i) => (
        <text
          key={i}
          x="50"
          y={startY + i * titleSize * 1.15}
          textAnchor="middle"
          fill="#F4ECDC"
          fontSize={titleSize}
          fontFamily="'Cormorant Garamond', Georgia, serif"
          fontWeight="300"
        >
          {line}
        </text>
      ))}

      {/* Hairline, then the author. */}
      <line
        x1="34"
        y1="116"
        x2="66"
        y2="116"
        stroke="#C89528"
        strokeOpacity="0.5"
        strokeWidth="0.4"
      />
      {author && (
        <text
          x="50"
          y="126"
          textAnchor="middle"
          fill="#8A8A8A"
          fontSize="3.6"
          letterSpacing="0.6"
          fontFamily="Inter, system-ui, sans-serif"
        >
          {author.toUpperCase()}
        </text>
      )}

      {/* Inset frame. */}
      <rect
        x="4"
        y="4"
        width="92"
        height="142"
        fill="none"
        stroke="#F4ECDC"
        strokeOpacity="0.10"
        strokeWidth="0.4"
      />
    </svg>
  );
}

/**
 * A cover: the real photograph when one exists, the drawn one when not.
 *
 * Everything that shows a cover goes through here, so uploading artwork
 * in the admin is the only step needed to replace the generated art —
 * no component has to change.
 */
export function Cover({
  src,
  title,
  author,
  shelf,
  className = '',
  sizes = '(min-width: 1024px) 20vw, 45vw',
}: {
  src?: string | null;
  title: string;
  author?: string | null;
  shelf?: string | null;
  className?: string;
  sizes?: string;
}) {
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={`Cover for ${title}`}
        loading="lazy"
        decoding="async"
        sizes={sizes}
        className={`h-full w-full object-cover ${className}`}
      />
    );
  }

  return (
    <CoverArt
      title={title}
      author={author}
      shelf={shelf}
      className={`h-full w-full ${className}`}
    />
  );
}
