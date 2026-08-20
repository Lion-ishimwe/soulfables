import type { Route } from 'next';
import Link from 'next/link';

/**
 * A placeholder that stays in character.
 *
 * The live site currently returns a 404 for /wander and /residents, which
 * reads as broken rather than unfinished. A room that is not built yet
 * should still feel like part of the House.
 */
export function QuietPage({
  eyebrow,
  title,
  body,
  cta,
}: {
  eyebrow: string;
  title: string;
  body: string;
  cta?: { href: Route; label: string };
}) {
  return (
    <section className="mx-auto max-w-content px-5 py-32 text-center sm:px-8 sm:py-44">
      <p className="text-gold" aria-hidden="true">
        ✦
      </p>
      <p className="sf-eyebrow mt-6">{eyebrow}</p>
      <h1 className="mt-5 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
        {title}
      </h1>
      <p className="mx-auto mt-6 max-w-measure text-base leading-normal text-grey-muted">
        {body}
      </p>
      <Link
        href={cta?.href ?? '/library'}
        className="mt-10 inline-block border-b border-gold/40 pb-1 font-ui text-sm text-gold transition-colors duration-base ease-house hover:border-gold hover:text-gold-soft"
      >
        {cta?.label ?? 'Browse the library'}
      </Link>
    </section>
  );
}
