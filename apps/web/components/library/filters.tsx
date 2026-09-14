import Link from 'next/link';
import type { Route } from 'next';
import { ShelfGlyph } from '@/components/shelf-glyph';

/**
 * The chip row and the view switch.
 *
 * Both are links, not buttons, for the same reason the rest of the
 * Library is: a filtered view should be a page, and a page should have
 * an address. It also means they work before any JavaScript has loaded,
 * which on a phone on a bad connection is most of the time somebody
 * spends looking at a page.
 */

export function ShelfChips({
  shelves,
  active,
  href,
}: {
  shelves: { slug: string; label: string; emoji?: string }[];
  /** Empty string means "All". */
  active: string;
  href: (shelf: string) => string;
}) {
  const chip =
    'flex items-center gap-2 whitespace-nowrap rounded-full border px-4 py-2 font-ui text-sm transition-all duration-base ease-house';
  const on = 'border-gold/50 bg-gold-dim text-ivory';
  const off = 'border-rule bg-ink-raised text-grey-muted hover:border-gold/40 hover:text-ivory';

  return (
    <nav aria-label="Filter by shelf">
      {/*
        Scrolls sideways rather than wrapping to three lines on a phone.
        The shelves are a row in the House's head, and stacking them loses
        that.
      */}
      <ul className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <li>
          <Link
            href={href('') as Route}
            aria-current={active === '' ? 'page' : undefined}
            className={`${chip} ${active === '' ? on : off}`}
          >
            <span aria-hidden="true" className="text-xs">
              ▦
            </span>
            All
          </Link>
        </li>

        {shelves.map((s) => (
          <li key={s.slug}>
            <Link
              href={href(s.slug) as Route}
              aria-current={active === s.slug ? 'page' : undefined}
              className={`${chip} ${active === s.slug ? on : off}`}
            >
              <ShelfGlyph slug={s.slug} className="h-3.5 w-3.5 text-gold" />
              {s.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function ViewToggle({
  view,
  href,
}: {
  view: 'grid' | 'list';
  href: (view: 'grid' | 'list') => string;
}) {
  const box =
    'flex h-9 w-9 items-center justify-center rounded-md font-ui text-sm transition-colors';
  const on = 'bg-gold-dim text-gold';
  const off = 'text-grey-muted hover:text-ivory';

  return (
    <div
      className="flex items-center gap-1 rounded-lg border border-rule bg-ink-raised p-1"
      role="group"
      aria-label="Layout"
    >
      <Link
        href={href('grid') as Route}
        aria-label="Grid"
        aria-current={view === 'grid' ? 'true' : undefined}
        className={`${box} ${view === 'grid' ? on : off}`}
      >
        <span aria-hidden="true">▦</span>
      </Link>
      <Link
        href={href('list') as Route}
        aria-label="List"
        aria-current={view === 'list' ? 'true' : undefined}
        className={`${box} ${view === 'list' ? on : off}`}
      >
        <span aria-hidden="true">☰</span>
      </Link>
    </div>
  );
}
