'use client';

import { useRef } from 'react';

/**
 * Search and the three filters, as one GET form.
 *
 * Same reasoning as the reader's Library: the state lives in the URL, so
 * "every draft of Caelum's on the Grief shelf" is a link an editor can
 * keep in a tab or send to somebody. It also means this page holds no
 * client state at all, and the list it renders is the list the server
 * decided on.
 *
 * Selects submit on change. A filter you have to press a button to apply
 * is a filter people set, walk away from, and then read the wrong numbers
 * off. The button stays for anyone without JavaScript.
 */

export type FilterSelect = {
  name: string;
  label: string;
  value: string;
  options: { value: string; label: string }[];
};

export function StoriesToolbar({
  q,
  filters,
  hidden,
}: {
  q: string;
  filters: FilterSelect[];
  /** Params the form must carry rather than drop — tab, layout, sort. */
  hidden: Record<string, string>;
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form
      ref={form}
      action="/admin/stories"
      method="get"
      className="flex flex-wrap items-center gap-3"
    >
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}

      <div className="relative min-w-0 flex-1 basis-56">
        <label htmlFor="adm-q" className="sr-only">
          Search stories
        </label>
        <input
          id="adm-q"
          name="q"
          type="search"
          defaultValue={q}
          placeholder="Search stories, authors, or keywords…"
          className="w-full rounded-lg border border-rule bg-ink-raised py-2.5 pl-4 pr-10 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
        />
        <span
          aria-hidden="true"
          className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-grey-faint"
        >
          ⌕
        </span>
      </div>

      {filters.map((f) => (
        <div key={f.name}>
          <label htmlFor={`adm-${f.name}`} className="sr-only">
            {f.label}
          </label>
          <select
            id={`adm-${f.name}`}
            name={f.name}
            defaultValue={f.value}
            onChange={() => form.current?.requestSubmit()}
            className="rounded-lg border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors focus:border-gold/50"
          >
            {f.options.map((o) => (
              <option key={o.value} value={o.value} className="bg-ink">
                {o.label}
              </option>
            ))}
          </select>
        </div>
      ))}

      <button
        type="submit"
        className="rounded-lg border border-rule px-4 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-grey-muted transition-colors hover:border-gold/40 hover:text-ivory"
      >
        Apply
      </button>
    </form>
  );
}

/**
 * How many to a page.
 *
 * Sits beside the page numbers rather than up with the filters, because
 * it is a question about the list you are already looking at and not
 * about which list you want.
 */
export function PerPage({
  value,
  hidden,
  options = [12, 16, 24, 48],
}: {
  value: number;
  hidden: Record<string, string>;
  options?: number[];
}) {
  const form = useRef<HTMLFormElement>(null);

  return (
    <form ref={form} action="/admin/stories" method="get">
      {Object.entries(hidden).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <label htmlFor="adm-per" className="sr-only">
        Stories per page
      </label>
      <select
        id="adm-per"
        name="per"
        defaultValue={String(value)}
        onChange={() => form.current?.requestSubmit()}
        className="rounded-lg border border-rule bg-ink-raised px-3 py-2 font-ui text-xs text-ivory outline-none transition-colors focus:border-gold/50"
      >
        {options.map((n) => (
          <option key={n} value={n} className="bg-ink">
            {n} per page
          </option>
        ))}
      </select>
    </form>
  );
}
