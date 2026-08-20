'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

/**
 * The thank-you page's status watcher.
 *
 * The crucial thing this component does is refuse to celebrate early.
 * Landing back from the payment provider proves only that a browser was
 * redirected — it proves nothing about money. So this polls the server
 * until the webhook has actually marked the order paid, and only then
 * shows a success state and a link to the library.
 *
 * If the webhook has not arrived within the window, it says so honestly
 * and gives the reader something to do, rather than spinning forever or
 * claiming a success that has not happened.
 */

type Status = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded' | 'unknown';

const POLL_MS = 2000;
const GIVE_UP_AFTER_MS = 45000;

export function OrderStatus({ reference }: { reference: string }) {
  const [status, setStatus] = useState<Status>('pending');
  const [needsAccount, setNeedsAccount] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();

    async function check() {
      try {
        const res = await fetch(`/api/orders/${reference}/status`, {
          cache: 'no-store',
        });
        if (!active) return;

        if (res.ok) {
          const body = (await res.json()) as { status: Status; needsAccount?: boolean };
          setStatus(body.status);
          setNeedsAccount(Boolean(body.needsAccount));

          if (body.status !== 'pending') return; // settled — stop polling
        }
      } catch {
        // Network hiccup. Keep trying until the deadline.
      }

      if (!active) return;

      if (Date.now() - startedAt > GIVE_UP_AFTER_MS) {
        setTimedOut(true);
        return;
      }

      window.setTimeout(check, POLL_MS);
    }

    check();
    return () => {
      active = false;
    };
  }, [reference]);

  if (status === 'paid') {
    return (
      <Panel
        title="Thank you. Your payment came through."
        body={
          needsAccount
            ? 'Create an account with the same email address you used at checkout, and everything you have bought will be waiting in your library.'
            : 'Your book is in your library now, in every format it ships in. It stays there.'
        }
        cta={
          needsAccount
            ? { href: '/signup', label: 'Create your account' }
            : { href: '/account/library', label: 'Open your library' }
        }
      />
    );
  }

  if (status === 'failed' || status === 'cancelled') {
    return (
      <Panel
        tone="warn"
        title="That payment did not go through."
        body="Nothing has been charged. You are welcome to try again whenever you like."
        cta={{ href: '/shop', label: 'Back to the bookshop' }}
      />
    );
  }

  if (timedOut) {
    return (
      <Panel
        tone="warn"
        title="This is taking longer than it should."
        body={`Your payment may still be settling. Nothing is lost — if it cleared, the book will appear in your library and a confirmation is on its way by email. Quote ${reference} if you need to write to us.`}
        cta={{ href: '/account/library', label: 'Check your library' }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-measure border border-rule p-10 text-center">
      <p className="text-gold" aria-hidden="true">
        ✦
      </p>
      <p className="sf-eyebrow mt-5">Confirming</p>
      <h1 className="mt-4 font-display text-3xl font-light text-ivory">
        We are confirming your order.
      </h1>
      <p aria-live="polite" className="mx-auto mt-4 text-sm leading-normal text-grey-muted">
        This usually takes a few seconds. Please stay on this page — we will
        not say your book is ready until the payment has actually cleared.
      </p>
      <p className="mt-6 font-mono text-xs text-grey-muted">{reference}</p>
    </div>
  );
}

function Panel({
  title,
  body,
  cta,
  tone = 'ok',
}: {
  title: string;
  body: string;
  cta: { href: '/signup' | '/account/library' | '/shop'; label: string };
  tone?: 'ok' | 'warn';
}) {
  return (
    <div
      className={`mx-auto max-w-measure border p-10 text-center ${
        tone === 'ok' ? 'border-gold/30 bg-gold-dim' : 'border-rule'
      }`}
    >
      <p className="text-gold" aria-hidden="true">
        ✦
      </p>
      <h1 className="mt-5 font-display text-3xl font-light leading-snug text-ivory">
        {title}
      </h1>
      <p className="mx-auto mt-4 text-sm leading-normal text-grey">{body}</p>
      <Link
        href={cta.href}
        className="mt-8 inline-block border border-gold/50 px-8 py-3.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
      >
        {cta.label}
      </Link>
    </div>
  );
}
