/*
 * A browser error, told to the House.
 *
 * Posted to /api/errors, which writes it to the same app_errors table
 * the server uses for its own failures, so the admin Report page shows
 * both. Nothing here may throw: this runs while a page is already
 * broken.
 */
export function reportClientError(error: Error & { digest?: string }, reloading: boolean) {
  try {
    const body = JSON.stringify({
      message: String(error?.message ?? error).slice(0, 2000),
      digest: error?.digest ?? null,
      stack: typeof error?.stack === 'string' ? error.stack.slice(0, 8000) : null,
      path: window.location.pathname,
      reloading,
    });
    fetch('/api/errors', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* an error while recording an error is not worth a third one */
  }
}
