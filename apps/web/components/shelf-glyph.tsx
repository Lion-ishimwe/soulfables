/**
 * A drawn glyph for each shelf.
 *
 * The shelves carried emoji, and an emoji is whatever the reader's device
 * makes of it: a red heart on one phone and a glossy one on another, a
 * candle that is a different candle everywhere. These are thin strokes
 * in currentColor, so they take the gold of wherever they sit, look the
 * same on every device, and follow the palette.
 *
 * Keyed by slug. A shelf without a drawing gets the House's spark rather
 * than nothing — a new shelf should not arrive with a hole beside it.
 */
const GLYPHS: Record<string, React.ReactNode> = {
  heartbreak: (
    <>
      <path d="M12 20.5s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10.5c0 5.4-7 10-7 10Z" />
      <path d="M12 7.9 10.5 11l2.8 2.1-1.8 3.2" />
    </>
  ),
  healing: (
    <>
      <path d="M5.5 18.5c0-8 5-13 13-14-1 8-6 13-13 14Z" />
      <path d="M5.5 18.5c3-4.5 6-7.5 10-10.5" />
    </>
  ),
  anxiety: <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />,
  love: <path d="M12 20.5s-7-4.6-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10.5c0 5.4-7 10-7 10Z" />,
  loneliness: (
    <>
      <path d="M9 20h6" />
      <path d="M10 20v-3.5a4.5 4.5 0 0 1-1.5-3.3V12h7v1.2A4.5 4.5 0 0 1 14 16.5V20" />
      <path d="M12 12V9" />
      <path d="M12 4.5c-.9 1.2-1.5 2.1-1.5 3a1.5 1.5 0 0 0 3 0c0-.9-.6-1.8-1.5-3Z" />
    </>
  ),
  grief: (
    <>
      <path d="M18.5 5.5c-5 0-9 4-10.5 9.5L5 18.5" />
      <path d="M8 15c3.5-.3 6.5-2.5 9-6.5" />
      <path d="M9.5 15h5" />
    </>
  ),
  hope: (
    <>
      <path d="M4 18.5h16" />
      <path d="M7 18.5a5 5 0 0 1 10 0" />
      <path d="M12 8.5V5" />
      <path d="m6.5 10.8-1.8-1.8" />
      <path d="m17.5 10.8 1.8-1.8" />
    </>
  ),
  forgiveness: (
    <>
      <path d="M8.5 15.5a4.5 4.5 0 1 1 3.5-7.3" />
      <path d="M15.5 8.5a4.5 4.5 0 1 1-3.5 7.3" />
    </>
  ),
  change: (
    <>
      <path d="M12 20v-7" />
      <path d="M12 13c0-3 2-5 5.5-5 0 3.5-2 5-5.5 5Z" />
      <path d="M12 13c0-3-2-5-5.5-5 0 3.5 2 5 5.5 5Z" />
      <path d="M5 20h14" />
    </>
  ),
  belonging: (
    <>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 10v10h12V10" />
      <path d="M10 20v-5h4v5" />
    </>
  ),
  identity: (
    <>
      <circle cx="12" cy="9.5" r="5.5" />
      <path d="M12 15v5M9 20h6" />
    </>
  ),
};

const SPARK = <path d="m12 3 2.2 6.3L20.5 12l-6.3 2.7L12 21l-2.2-6.3L3.5 12l6.3-2.7L12 3Z" />;

export function ShelfGlyph({
  slug,
  className = 'h-5 w-5',
}: {
  slug: string;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {GLYPHS[slug] ?? SPARK}
    </svg>
  );
}
