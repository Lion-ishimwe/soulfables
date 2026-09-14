import type { Instrumentation } from 'next';

/**
 * What the server does when a request fails.
 *
 * Next calls onRequestError for any error thrown while rendering a
 * page, running a route handler, a server action or the middleware.
 * The error is written to the app_errors table with the service role,
 * over plain HTTP to the database's REST API — no client library here,
 * because this file loads on every runtime and must stay light and
 * must never itself throw.
 *
 * Secrets are not logged: the stack is kept, request bodies and headers
 * are not.
 */
export const onRequestError: Instrumentation.onRequestError = async (err, request, context) => {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return;

    const e = err as { message?: string; stack?: string; digest?: string };
    const body = {
      message: String(e?.message ?? err).slice(0, 2000),
      digest: e?.digest ?? null,
      stack: typeof e?.stack === 'string' ? e.stack.slice(0, 8000) : null,
      path: request.path,
      method: request.method,
      kind: context.routeType,
      runtime: process.env.NEXT_RUNTIME ?? null,
    };

    await fetch(`${url}/rest/v1/app_errors`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(body),
    });
  } catch {
    /* an error while recording an error is not worth a third one */
  }
};

export function register() {
  /* nothing to set up; onRequestError is what matters here */
}
