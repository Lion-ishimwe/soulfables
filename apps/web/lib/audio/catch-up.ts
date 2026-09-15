import 'server-only';
import { isDemoMode } from '@/lib/demo/mode';
import { narrateMissing } from './narrate';

/**
 * Every published story has a narration by default — including the ones
 * published before the House could read, and any whose reading failed
 * at the time (a voice that was unreachable, a restart mid-reading).
 *
 * So the server, once it is up, looks for published stories with no
 * narration and reads them, and looks again every few hours. Nobody has
 * to press anything. The switch in Settings → The House still governs
 * it: ensureNarration() checks it before every reading.
 *
 * Started once per process from instrumentation.ts; harmless to call
 * twice.
 */

const FIRST_LOOK_MS = 30_000;
const EVERY_MS = 6 * 60 * 60 * 1000;

declare global {
  // eslint-disable-next-line no-var
  var __soulfablesCatchUp: boolean | undefined;
}

async function look(reason: string) {
  try {
    const result = await narrateMissing(reason);
    console.info(
      '[narration]',
      result.attempted ? `catch-up read ${result.read} of ${result.attempted}` : 'catch-up: every published story has a narration',
    );
  } catch (e) {
    console.error('[narration] catch-up failed:', e instanceof Error ? e.message : e);
  }
}

export function startNarrationCatchUp() {
  if (globalThis.__soulfablesCatchUp) return;
  if (isDemoMode()) return;
  globalThis.__soulfablesCatchUp = true;

  setTimeout(() => void look('catch-up at start'), FIRST_LOOK_MS).unref();
  setInterval(() => void look('catch-up'), EVERY_MS).unref();
}
