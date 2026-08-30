/**
 * A quill and inkwell, drawn rather than downloaded.
 *
 * Purely decorative, so it is hidden from assistive technology entirely —
 * a screen reader describing "a feather pen beside a bottle of ink" would
 * be reading out the wallpaper.
 *
 * Hand-drawn for the same reason the charts are: it is a few dozen path
 * commands, it inherits the gold, and it costs no request. It also
 * survives a theme change, which a PNG of a gold quill would not.
 */
export function Quill({ className = 'h-40 w-40' }: { className?: string }) {
  return (
    <svg viewBox="0 0 200 200" className={className} aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id="quill-feather" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#E8CE8A" />
          <stop offset="45%" stopColor="#C89528" />
          <stop offset="100%" stopColor="#7A5C18" />
        </linearGradient>
        <linearGradient id="quill-ink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3A2E14" />
          <stop offset="100%" stopColor="#15100A" />
        </linearGradient>
        <linearGradient id="quill-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#C89528" />
          <stop offset="50%" stopColor="#E8CE8A" />
          <stop offset="100%" stopColor="#8A6A1E" />
        </linearGradient>
      </defs>

      {/* The feather: one closed vane, split by the shaft. */}
      <path
        d="M150 18c-30 6-58 26-76 54-11 17-17 34-19 50l16-9c4-14 10-27 19-40 14-20 33-35 55-44-18 13-33 29-44 48-8 14-13 28-16 41l17-10c3-11 8-22 15-33 13-21 31-37 52-48-6 15-9 30-11 45-2 18-4 34-13 47-6 9-15 16-27 21l-9 4 12 3c15-3 27-10 36-21 12-15 16-33 18-52 2-22 4-42 15-58Z"
        fill="url(#quill-feather)"
      />

      {/* The shaft, running from the tip of the vane down to the nib. */}
      <path
        d="M152 20 74 132l-9 13 4 3 9-13L156 24Z"
        fill="#EFE0B8"
        opacity="0.55"
      />
      <path d="M66 148l-9 13 15-5 3-5Z" fill="#E8CE8A" />

      {/* The inkwell. */}
      <path
        d="M118 150h56a6 6 0 0 1 6 6v14a20 20 0 0 1-20 20h-28a20 20 0 0 1-20-20v-14a6 6 0 0 1 6-6Z"
        fill="url(#quill-ink)"
        stroke="url(#quill-rim)"
        strokeWidth="2"
      />
      <ellipse cx="146" cy="152" rx="30" ry="6" fill="#0B0B0B" stroke="url(#quill-rim)" strokeWidth="2" />
      <ellipse cx="146" cy="152" rx="21" ry="3.5" fill="#C89528" opacity="0.28" />

      {/* Three sparks, because the House likes a little ceremony. */}
      <g fill="#E8CE8A">
        <path d="M38 44 41 53 50 56 41 59 38 68 35 59 26 56 35 53Z" opacity="0.9" />
        <path d="M176 74 178 80 184 82 178 84 176 90 174 84 168 82 174 80Z" opacity="0.7" />
        <path d="M28 108 30 113 35 115 30 117 28 122 26 117 21 115 26 113Z" opacity="0.5" />
      </g>
    </svg>
  );
}
