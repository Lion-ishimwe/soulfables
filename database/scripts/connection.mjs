/**
 * Parsing a Postgres connection string, carefully.
 *
 * Shared by setup.mjs and remote.mjs because getting this wrong is
 * quiet and expensive:
 *
 *   A password containing @ (or /, :, ?, #) splits the URL in the wrong
 *   place. libpq then reads the tail of the password as the hostname and
 *   reports that it cannot resolve it, which sends you off checking DNS
 *   and the pooler and your network — none of which is the problem.
 *
 *   Masking on the FIRST @ leaks the rest of the password to the
 *   terminal. The host separator is the LAST @, not the first.
 *
 * Supabase generates passwords that can contain these characters, so
 * this is the common case rather than an edge one.
 */

/** Split into pieces on the last @, which is the real host separator. */
function split(url) {
  const scheme = url.match(/^(postgres(?:ql)?:\/\/)/)?.[1];
  if (!scheme) return null;

  const rest = url.slice(scheme.length);
  const at = rest.lastIndexOf('@');
  if (at === -1) return { scheme, user: '', password: '', host: rest };

  const credentials = rest.slice(0, at);
  const host = rest.slice(at + 1);
  const colon = credentials.indexOf(':');

  return colon === -1
    ? { scheme, user: credentials, password: '', host }
    : {
        scheme,
        user: credentials.slice(0, colon),
        password: credentials.slice(colon + 1),
        host,
      };
}

/**
 * Is this even a connection string?
 *
 * Checked before anything is printed. A string missing its @ has no
 * boundary between password and host, so there is no safe way to mask
 * it — the only correct move is to refuse it and never echo it.
 */
export function validate(url) {
  if (!/^postgres(ql)?:\/\//.test(url)) {
    return {
      ok: false,
      problem: ['That does not start with postgresql:// — copy the whole URI.'],
    };
  }

  const rest = url.replace(/^postgres(ql)?:\/\//, "");
  if (!rest.includes('@')) {
    return {
      ok: false,
      problem: [
        "There is no @ between the password and the host, so the password",
        "is running straight into the hostname.",
        "",
        "The @ is part of the structure and must stay. If your password",
        "itself contains an @, leave it alone — it gets encoded for you.",
      ],
    };
  }

  return { ok: true };
}

/**
 * Percent-encode the password if it needs it, leaving an already-encoded
 * one alone. Returns the usable URL plus anything worth telling the user.
 */
export function normalise(url) {
  const parts = split(url);
  if (!parts) return { url, notes: [] };

  const notes = [];
  let password = parts.password;

  // Already encoded? Then decoding and re-encoding is a no-op, and
  // touching it would double-encode a legitimate % in the password.
  const looksEncoded = /%[0-9A-Fa-f]{2}/.test(password);
  const needsEncoding = /[@/:?#[\]]/.test(password);

  if (needsEncoding && !looksEncoded) {
    password = encodeURIComponent(password);
    notes.push(
      'The password contains a character that has meaning in a URL, so it has been percent-encoded.'
    );
  }

  /*
   * Say this before the connection is attempted, not after it fails.
   * The direct host publishes only an AAAA record, so on a network
   * without IPv6 it cannot resolve at all — and the resulting error
   * talks about DNS, which sounds like something the user broke.
   */
  if (/^db\./.test(parts.host)) {
    notes.push(
      'This is the direct host, which is IPv6-only on the Free plan. If your' +
        ' network is IPv4 it will not resolve — use the Session pooler instead.'
    );
  }

  const fixed = `${parts.scheme}${parts.user}${password ? ':' + password : ''}@${parts.host}`;
  return { url: fixed, notes, host: parts.host };
}

/** Safe to print. Masks on the last @, so nothing of the password shows. */
export function mask(url) {
  const parts = split(url);
  if (!parts) return url;
  return `${parts.scheme}${parts.user}${parts.password ? ':******' : ''}@${parts.host}`;
}

/**
 * Advice for the connection failures that actually happen, rather than a
 * generic "check your settings".
 */
export function explain(message, host = '') {
  if (/could not translate host name|ENOTFOUND|Name or service not known/i.test(message)) {
    if (/^db\./.test(host)) {
      return [
        'That is the direct host, which resolves over IPv6 only on the Free',
        'plan. Most networks are IPv4, so use the Session pooler instead —',
        'Connect → Session pooler, also on port 5432.',
      ];
    }
    return ['The hostname did not resolve. Copy the whole string from Connect rather than typing it.'];
  }
  if (/Tenant or user not found/i.test(message)) {
    return [
      'The pooler wants the username postgres.PROJECT_REF, not plain',
      'postgres. Copying the string from Connect gets this right.',
    ];
  }
  if (/password authentication failed/i.test(message)) {
    return ['Wrong password. Settings → Database has a reset.'];
  }
  if (/Network is unreachable|ETIMEDOUT|timeout expired/i.test(message)) {
    return [
      'Reached DNS but not the server. On the Free plan the direct host is',
      'IPv6-only; the Session pooler works over IPv4.',
    ];
  }
  return [];
}
