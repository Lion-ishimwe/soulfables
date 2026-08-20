/**
 * Soulfables design tokens.
 *
 * These are not invented. Every value here was measured off the running
 * site so the rebuild is visually continuous with what readers already
 * know. Where the brief (§18) named a colour in words — "deep black,
 * warm ivory, muted gold, soft grey" — the hex below is the one the House
 * is actually using.
 *
 * This file is the single source of truth. The CSS custom properties in
 * `theme.css` and the Tailwind config both derive from it, and the Dart
 * equivalent for the Flutter app is generated from it by
 * `scripts/generate-dart-tokens.ts` — so web and mobile cannot drift.
 */

export const colors = {
  /** Page ground. Measured: rgb(11,11,11). */
  ink: '#0B0B0B',
  /** One step up from the ground, for cards and raised surfaces. */
  inkRaised: '#141414',
  inkHover: '#1C1C1C',

  /** Warm ivory — headings and anything that should feel lamp-lit. */
  ivory: '#F4ECDC',
  /** Pure white, used sparingly: it reads cold against the ivory. */
  white: '#FFFFFF',

  /** Muted gold. The House accent. Measured: rgb(200,149,40). */
  gold: '#C89528',
  goldSoft: '#D9AE55',
  goldDim: 'rgba(200, 149, 40, 0.16)',

  /** Body copy on dark. */
  grey: '#CFCFCF',
  /** Metadata, captions, the quiet line under a title. */
  greyMuted: '#8A8A8A',
  greyFaint: 'rgba(138, 138, 138, 0.5)',

  /** Hairlines. Never a solid border — the House does not do hard edges. */
  rule: 'rgba(244, 236, 220, 0.10)',
  ruleStrong: 'rgba(244, 236, 220, 0.18)',

  /**
   * Daylight reading mode. The site is night-first, but a reader who
   * wants ivory paper at noon should have it — brief §7 asks for both.
   */
  paper: '#F7F3EA',
  paperInk: '#1A1714',
  paperMuted: '#6B6259',

  /** State. Kept desaturated so nothing shouts. */
  success: '#7C9A6B',
  warning: '#C89528',
  danger: '#B4564A',
} as const;

/**
 * Three faces, three jobs.
 *   display — Cormorant Garamond. Titles, shelf names, the H1s.
 *   reading — EB Garamond. Story bodies only. Chosen over Cormorant for
 *             long-form because it holds up at small sizes.
 *   ui      — Inter. Navigation, buttons, metadata, admin.
 */
export const fonts = {
  display: '"Cormorant Garamond", Georgia, "Times New Roman", serif',
  reading: '"EB Garamond", Georgia, "Times New Roman", serif',
  ui: 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif',
} as const;

/**
 * Type scale. Display sizes are generous on purpose — the brief asked for
 * spacious and cinematic, and Cormorant needs room to be worth using.
 */
export const fontSize = {
  micro: '0.6875rem',  // 11px — the ALL-CAPS eyebrow labels
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.375rem',
  '2xl': '1.75rem',
  '3xl': '2.25rem',
  '4xl': '3rem',
  '5xl': '4rem',
  '6xl': '5.25rem',
} as const;

export const fontWeight = {
  light: 300,
  regular: 400,
  medium: 500,
  semibold: 600,
} as const;

export const lineHeight = {
  tight: 1.1,
  snug: 1.25,
  normal: 1.5,
  /** Story body default. Deliberately loose. */
  reading: 1.75,
  loose: 1.9,
} as const;

/**
 * Letter-spacing. The eyebrow treatment ("THE LIBRARY OF FEELINGS",
 * "A NOTE FROM THE LIBRARIAN") is a signature of the brand: small, caps,
 * widely tracked, muted. `wider` is that value.
 */
export const letterSpacing = {
  tighter: '-0.02em',
  normal: '0',
  wide: '0.08em',
  wider: '0.18em',
  widest: '0.28em',
} as const;

/** 4px base. */
export const spacing = {
  0: '0', 1: '0.25rem', 2: '0.5rem', 3: '0.75rem', 4: '1rem',
  5: '1.25rem', 6: '1.5rem', 8: '2rem', 10: '2.5rem', 12: '3rem',
  16: '4rem', 20: '5rem', 24: '6rem', 32: '8rem', 40: '10rem',
} as const;

export const radius = {
  none: '0',
  sm: '2px',
  md: '4px',
  lg: '8px',
  /** Cards and covers. Barely rounded — closer to print than to software. */
  card: '3px',
  full: '9999px',
} as const;

/**
 * Elevation is done with light, not drop shadows. A raised surface in the
 * House looks like something a lamp is falling on.
 */
export const shadow = {
  none: 'none',
  lamp: '0 0 60px -20px rgba(200, 149, 40, 0.25)',
  lift: '0 20px 60px -30px rgba(0, 0, 0, 0.9)',
  cover: '0 30px 80px -40px rgba(0, 0, 0, 1)',
} as const;

/**
 * Motion. Brief §18 says avoid excessive animation, so there are only
 * three durations and everything eases the same way. Anything that wants
 * to be flashier than `slow` is out of character.
 */
export const motion = {
  fast: '140ms',
  base: '260ms',
  slow: '480ms',
  ease: 'cubic-bezier(0.22, 0.61, 0.36, 1)',
} as const;

/** Reading measure. ~68 characters is the target line length. */
export const layout = {
  measure: '34rem',
  contentWidth: '46rem',
  pageWidth: '75rem',
  wideWidth: '90rem',
} as const;

export const tokens = {
  colors, fonts, fontSize, fontWeight, lineHeight,
  letterSpacing, spacing, radius, shadow, motion, layout,
} as const;

export type SoulfablesTokens = typeof tokens;
