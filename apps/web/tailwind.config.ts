import type { Config } from 'tailwindcss';
import {
  colors, fonts, fontSize, letterSpacing, lineHeight, radius, shadow, layout, motion,
} from '../../packages/design-system/src/tokens';

/**
 * Tailwind is configured entirely from the token file. Nothing here
 * invents a value — if a colour or size is needed, it goes in tokens.ts
 * first so the Flutter app inherits it too.
 *
 * Colours are one step removed: each utility reads a CSS variable that
 * globals.css sets from the tokens, once for the night palette and once
 * for the day one, so `bg-ink` is the ground whichever face the House is
 * wearing. The names stay semantic — ink is the ground, ivory the
 * strongest text — which is why the same class works on paper.
 */
const channel = (name: string) => `rgb(var(--c-${name}) / <alpha-value>)`;
export default {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    '../../packages/design-system/src/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: channel('ink'), raised: channel('ink-raised'), hover: channel('ink-hover') },
        ivory: channel('ivory'),
        gold: { DEFAULT: channel('gold'), soft: channel('gold-soft'), dim: 'var(--c-gold-dim)' },
        grey: { DEFAULT: channel('grey'), muted: channel('grey-muted'), faint: 'var(--c-grey-faint)' },
        rule: { DEFAULT: 'var(--c-rule)', strong: 'var(--c-rule-strong)' },
        // The reader's paper mode is its own thing and does not follow the theme.
        paper: { DEFAULT: colors.paper, ink: colors.paperInk, muted: colors.paperMuted },
        state: { success: colors.success, warning: channel('gold'), danger: colors.danger },
      },
      fontFamily: {
        display: fonts.display.split(',').map((f) => f.trim()),
        reading: fonts.reading.split(',').map((f) => f.trim()),
        ui: fonts.ui.split(',').map((f) => f.trim()),
      },
      fontSize: fontSize as unknown as Record<string, string>,
      // Tokens store line-height as unitless numbers; Tailwind's config
      // type wants strings. Convert rather than weakening the token type.
      lineHeight: Object.fromEntries(
        Object.entries(lineHeight).map(([k, v]) => [k, String(v)]),
      ),
      letterSpacing,
      borderRadius: radius,
      boxShadow: shadow,
      maxWidth: {
        measure: layout.measure,
        content: layout.contentWidth,
        page: layout.pageWidth,
        wide: layout.wideWidth,
      },
      transitionTimingFunction: { house: motion.ease },
      transitionDuration: {
        fast: motion.fast.replace('ms', ''),
        base: motion.base.replace('ms', ''),
        slow: motion.slow.replace('ms', ''),
      },
      keyframes: {
        // The only two animations in the system. Both are entrances, both
        // are slow, neither loops. Brief §18: no excessive animation.
        rise: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        lamp: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
      },
      animation: {
        rise: `rise ${motion.slow} ${motion.ease} both`,
        lamp: `lamp ${motion.slow} ${motion.ease} both`,
      },
    },
  },
  plugins: [],
} satisfies Config;
