/**
 * Pure formatters, importable from both server and client code.
 *
 * Deliberately free of any `server-only` import: these are used inside
 * client components (the file uploader, the buy form) as well as in
 * server-rendered pages, and duplicating them would let the two drift.
 */

/** Money is stored in minor units everywhere. This is the only formatter. */
export function formatMoney(minorUnits: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
  }).format(minorUnits / 100);
}

export function formatBytes(bytes: number | null): string {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  if (mb < 1) return `${Math.round(bytes / 1024)} KB`;
  return `${mb.toFixed(1)} MB`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Big numbers, short.
 *
 * "2.1K" rather than "2,143" on a card, because the card is asking "is
 * this widely read?" and not "by exactly how many". Below a thousand the
 * exact figure is short enough to just say.
 */
export function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 1_000_000) {
    const k = n / 1000;
    return `${k < 10 ? k.toFixed(1).replace(/\.0$/, '') : Math.round(k)}K`;
  }
  const m = n / 1_000_000;
  return `${m < 10 ? m.toFixed(1).replace(/\.0$/, '') : Math.round(m)}M`;
}
