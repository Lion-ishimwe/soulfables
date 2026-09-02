'use client';

import { useRef } from 'react';

/**
 * Search and sort, as a plain GET form.
 *
 * Every view of the Library is a URL: /library?shelf=grief&sort=oldest is
 * a page somebody can bookmark, send to a friend, or land on from a
 * search engine. That is worth more here than the smoothness of filtering
 * in the browser, and it means the whole page stays server-rendered and
 * cached rather than shipping the catalogue to every reader.
 *
 * The only client-side behaviour is submitting when the sort changes,
 * because a select that needs a separate button pressed afterwards is a
 * select people set and then wonder about. Without JavaScript the button
 * is still there and still works.
 */
export function LibraryControls({
  action,
  q,
  sort,
  hidden,
  sorts,
  placeholder = 'Search stories, authors, or keywords…',
}: {
  action: string;
  q: string;
  sort: string;
  /** Params this form must carry through rather than drop. */
  hidden: Record<string, string>;
  sorts: { value: string; label: string }[];
  placeholder?: string;
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      action={action}
      method="get"
      className="flex flex-wrap items-center gap-3"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div className="relative min-w-0 flex-1 basis-64">
        <label htmlFor="lib-q" className="sr-only">
          Search stories
        </label>
        <input
          id="lib-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder={placeholder}
          className="w-full rounded-lg border border-rule bg-ink-raised py-2.5 pl-4 pr-10 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-grey-faint"
        >
          ⌕
        </span>
      </div>

      <div className="flex items-center gap-2">
        <label
          htmlFor="lib-sort"
          className="whitespace-nowrap font-ui text-xs text-grey-muted"
        >
          Sort by
        </label>
        <select
          id="lib-sort"
          name="sort"
          defaultValue={sort}
          onChange={() => form.current?.requestSubmit()}
          className="rounded-lg border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/50"
        >
          {sorts.map((s) => (
            <option key={s.value} value={s.value} className="bg-ink">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="rounded-lg border border-rule px-4 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Search
      </button>
    </form>
  );
}
