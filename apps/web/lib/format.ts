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
