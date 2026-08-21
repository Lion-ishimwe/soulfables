import Link from 'next/link';
import { isDemoMode } from '@/lib/demo/mode';

/**
 * Says plainly that this is a demonstration.
 *
 * Deliberately not dismissible and not subtle. Someone evaluating a
 * platform must never be unsure whether what they are looking at is real
 * — a demo that hides its own nature is how a stakeholder ends up
 * believing a payment flow works.
 *
 * Renders nothing at all in live mode.
 */
export function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="border-b border-gold/25 bg-gold-dim">
      <p className="mx-auto flex max-w-page flex-wrap items-center justify-center gap-x-3 gap-y-1 px-5 py-2 text-center font-ui text-xs text-grey sm:px-8">
        <span className="font-semibold uppercase tracking-[0.14em] text-gold">
          Demonstration
        </span>
        <span>
          Sample stories, no database. Anything you write is kept in memory
          and disappears when the server restarts.
        </span>
        <Link
          href="/about-this-demo"
          className="text-gold underline-offset-2 transition-colors hover:text-gold-soft hover:underline"
        >
          What is real?
        </Link>
      </p>
    </div>
  );
}
