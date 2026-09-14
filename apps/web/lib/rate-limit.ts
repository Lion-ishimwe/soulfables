import 'server-only';
import { headers } from 'next/headers';

/**
 * A rate limit for the doors that cost something.
 *
 * Kept in the process's own memory, which is exactly right for a House
 * that runs on one instance and exactly wrong for one that runs on
 * several — if that day comes, this file is where a shared store goes,
 * and nothing that calls it has to change. Sliding window: the last
 * `windowMs` of timestamps per key, pruned as they age out.
 *
 * Keys are chosen by the caller: a reader's id where there is one, the
 * network address where there is not. The answer is a yes or a wait,
 * never an exception — a limit that throws is a limit that takes the
 * page down with it.
 */

const buckets = new Map<string, number[]>();

/** Occasionally sweep keys that have gone quiet, so memory does not creep. */
let lastSweep = Date.now();
function sweep(now: number, windowMs: number) {
  if (now - lastSweep < 60_000) return;
  lastSweep = now;
  for (const [key, stamps] of buckets) {
    const live = stamps.filter((t) => now - t < windowMs);
    if (live.length === 0) buckets.delete(key);
    else buckets.set(key, live);
  }
}

export type Limit = { ok: true } | { ok: false; retryAfterSeconds: number };

export function checkLimit(key: string, max: number, windowMs: number): Limit {
  const now = Date.now();
  sweep(now, windowMs);
  const stamps = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (stamps.length >= max) {
    const oldest = stamps[0] ?? now;
    return { ok: false, retryAfterSeconds: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)) };
  }
  stamps.push(now);
  buckets.set(key, stamps);
  return { ok: true };
}

/** The caller's network address, as nginx forwards it. */
export async function callerAddress(): Promise<string> {
  const h = await headers();
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown';
}

/** A limit keyed on who is asking: the reader, or failing that the address. */
export async function limitFor(scope: string, who: string | null, max: number, windowMs: number): Promise<Limit> {
  const key = `${scope}:${who ?? (await callerAddress())}`;
  return checkLimit(key, max, windowMs);
}

export const HOUR = 60 * 60 * 1000;
export const MINUTE = 60 * 1000;

/** The sentence a limited caller reads. */
export function waitMessage(l: { retryAfterSeconds: number }): string {
  const m = Math.ceil(l.retryAfterSeconds / 60);
  return m <= 1 ? 'Too many in a short time. Give it a minute.' : `Too many in a short time. Try again in about ${m} minutes.`;
}
