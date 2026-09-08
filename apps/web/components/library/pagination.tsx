import Link from 'next/link';
import type { Route } from 'next';

/**
 * Numbered pages, server-rendered.
 *
 * Numbers rather than an infinite scroll, because a library is somewhere
 * you leave and come back to, and "page 3" is a place you can come back
 * to. Every page is its own URL for the same reason the filters are.
 *
 * Long runs collapse to first / neighbours / last with an ellipsis, so
 * eighty pages still fits on a phone.
 */
export function Pagination({
  page,
  pages,
  href,
}: {
  page: number;
  pages: number;
  /** Builds the URL for a page number, carrying the other filters. */
  href: (page: number) => string;
}) {
  if (pages <= 1) return null;

  const window = new Set<number>([1, pages, page, page - 1, page + 1]);
  const numbers = [...window].filter((n) => n >= 1 && n <= pages).sort((a, b) => a - b);

  const box =
    'flex h-9 min-w-9 items-center justify-center rounded-lg border px-3 font-ui text-sm tabular-nums transition-colors';

  return (
    <nav aria-label="Pages" className="flex flex-wrap items-center justify-center gap-2">
      {page > 1 ? (
        <Link
          href={href(page - 1) as Route}
          rel="prev"
          aria-label="Previous page"
          className={`${box} border-rule text-grey-muted hover:border-gold/40 hover:text-ivory`}
        >
          ←
        </Link>
      ) : (
        <span aria-hidden="true" className={`${box} border-rule text-grey-faint opacity-40`}>
          ←
        </span>
      )}

      {numbers.map((n, i) => (
        <span key={n} className="flex items-center gap-2">
          {i > 0 && n - numbers[i - 1] > 1 && (
            <span className="px-1 font-ui text-sm text-grey-faint">…</span>
          )}
          {n === page ? (
            <span
              aria-current="page"
              className={`${box} border-gold/50 bg-gold-dim text-gold`}
            >
              {n}
            </span>
          ) : (
            <Link
              href={href(n) as Route}
              className={`${box} border-rule text-grey-muted hover:border-gold/40 hover:text-ivory`}
            >
              {n}
            </Link>
          )}
        </span>
      ))}

      {page < pages ? (
        <Link
          href={href(page + 1) as Route}
          rel="next"
          aria-label="Next page"
          className={`${box} border-rule text-grey-muted hover:border-gold/40 hover:text-ivory`}
        >
          →
        </Link>
      ) : (
        <span aria-hidden="true" className={`${box} border-rule text-grey-faint opacity-40`}>
          →
        </span>
      )}
    </nav>
  );
}
