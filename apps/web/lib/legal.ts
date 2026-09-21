/**
 * The House's legal pages, by version.
 *
 * Each page carries the date it last changed, and an order records the
 * versions the buyer accepted at checkout — so if the wording moves
 * later, what a given person agreed to is still on file. A version is
 * the date, written as the page shows it; there is nothing cleverer to
 * gain from a number.
 *
 * Change a date here when the page's wording changes in substance. A
 * comma does not need a new version; a new refund window does.
 */
export const LEGAL = {
  terms: '2026-09-19',
  privacy: '2026-09-15',
  digitalProducts: '2026-09-21',
} as const;

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** '2026-09-19' → '19 September 2026', the way the pages say it. */
export function legalDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}
