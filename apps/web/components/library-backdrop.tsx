/**
 * The House, seen from inside.
 *
 * A drawn library interior behind the front door: shelves receding into
 * the dark, a lamp on the left, dust in the light. Rendered as SVG rather
 * than a photograph for three reasons — nothing to download, nothing that
 * belongs to somebody else, and it scales to any viewport without a
 * second asset.
 *
 * It sits at low opacity behind the greeting and is marked aria-hidden:
 * it is atmosphere, and a screen reader announcing "decorative library
 * illustration" would be worse than silence.
 *
 * Swap for a real photograph by giving the hero a background image and
 * deleting this — the layout does not depend on it.
 */
export function LibraryBackdrop() {
  // Shelf bays, drawn with slight irregularity so the wall does not read
  // as a spreadsheet.
  const bays = [
    { x: 2, w: 15, rows: 5, lean: 0.4 },
    { x: 19, w: 13, rows: 6, lean: -0.2 },
    { x: 34, w: 16, rows: 5, lean: 0.3 },
    { x: 52, w: 12, rows: 6, lean: 0 },
    { x: 66, w: 15, rows: 5, lean: -0.35 },
    { x: 83, w: 15, rows: 6, lean: 0.25 },
  ];

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      <svg
        viewBox="0 0 100 60"
        preserveAspectRatio="xMidYMid slice"
        className="h-full w-full"
      >
        <defs>
          {/* The room falls away at the edges and into the floor. */}
          <radialGradient id="lb-vignette" cx="42%" cy="34%" r="78%">
            <stop offset="0%" stopColor="#0B0B0B" stopOpacity="0" />
            <stop offset="62%" stopColor="#0B0B0B" stopOpacity="0.55" />
            <stop offset="100%" stopColor="#0B0B0B" stopOpacity="1" />
          </radialGradient>

          {/* The lamp by the door. */}
          <radialGradient id="lb-lamp" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#C89528" stopOpacity="0.55" />
            <stop offset="35%" stopColor="#C89528" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#C89528" stopOpacity="0" />
          </radialGradient>

          <linearGradient id="lb-wall" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#141210" />
            <stop offset="70%" stopColor="#0D0C0B" />
            <stop offset="100%" stopColor="#080808" />
          </linearGradient>
        </defs>

        <rect width="100" height="60" fill="url(#lb-wall)" />

        {/* Shelving. Books are ticks of varying height and warmth — at
            this scale a spine is two strokes, and more detail would only
            fight the text sitting on top of it. */}
        {bays.map((bay, b) =>
          Array.from({ length: bay.rows }, (_, r) => {
            const shelfY = 6 + r * 8.4 + bay.lean * r;
            const books = 9 + ((b * 7 + r * 3) % 6);

            return (
              <g key={`${b}-${r}`}>
                {/* The board itself. */}
                <rect
                  x={bay.x}
                  y={shelfY + 6.2}
                  width={bay.w}
                  height="0.5"
                  fill="#F4ECDC"
                  fillOpacity="0.09"
                />

                {Array.from({ length: books }, (_, i) => {
                  const seed = b * 31 + r * 17 + i * 7;
                  const w = bay.w / books;
                  const h = 3.4 + (seed % 5) * 0.55;
                  // A handful of spines catch the light.
                  const warm = seed % 9 === 0;
                  return (
                    <rect
                      key={i}
                      x={bay.x + i * w + 0.12}
                      y={shelfY + 6.2 - h}
                      width={Math.max(0.4, w - 0.24)}
                      height={h}
                      fill={warm ? '#C89528' : '#F4ECDC'}
                      fillOpacity={warm ? 0.16 : 0.05 + (seed % 4) * 0.012}
                    />
                  );
                })}
              </g>
            );
          }),
        )}

        {/* Lamplight, and the pool it throws on the floor. */}
        <ellipse cx="16" cy="30" rx="26" ry="30" fill="url(#lb-lamp)" />
        <ellipse
          cx="16"
          cy="56"
          rx="20"
          ry="3"
          fill="#C89528"
          fillOpacity="0.06"
        />

        <rect width="100" height="60" fill="url(#lb-vignette)" />
      </svg>
    </div>
  );
}
