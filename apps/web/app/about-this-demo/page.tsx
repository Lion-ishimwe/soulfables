import type { Metadata } from 'next';
import Link from 'next/link';
import { isDemoMode } from '@/lib/demo/mode';

export const metadata: Metadata = {
  title: 'About this demo',
  robots: { index: false, follow: false },
};

/*
 * What is real and what is not.
 *
 * Written plainly because the alternative — letting someone assume the
 * payment flow works — is how a platform gets signed off on a promise it
 * cannot keep.
 */
export default function AboutDemoPage() {
  const demo = isDemoMode();

  const rows: { thing: string; state: 'real' | 'demo' | 'off'; note: string }[] = [
    { thing: 'Stories, shelves and the journey graph', state: 'demo', note: 'Sample texts written for this demo. Real ones are authored in the admin.' },
    { thing: 'The reader', state: 'real', note: 'Exactly the reading experience that ships — typography, sizing, night and paper modes.' },
    { thing: 'Search', state: 'real', note: 'Same interface; matches on titles and loglines here, full text in the database.' },
    { thing: 'The journal', state: 'real', note: 'Writes and deletes work. Entries live in memory and vanish on restart.' },
    { thing: 'Saving and reading progress', state: 'real', note: 'Kept per browser, in memory.' },
    { thing: 'Sign in', state: 'demo', note: 'No accounts and no password check. Any email opens the House.' },
    { thing: 'The admin dashboard', state: 'demo', note: 'Browsable, but nothing saves — writing needs the database.' },
    { thing: 'Checkout and payment', state: 'off', note: 'Deliberately not connected. Scheduled as the last milestone.' },
    { thing: 'File downloads', state: 'off', note: 'Needs private storage and a real entitlement.' },
  ];

  const badge = {
    real: 'border-state-success/45 text-state-success',
    demo: 'border-gold/45 text-gold',
    off: 'border-rule-strong text-grey-muted',
  };

  const label = { real: 'Working', demo: 'Sample', off: 'Not connected' };

  return (
    <section className="mx-auto max-w-content px-5 py-24 sm:px-8">
      <p className="text-gold" aria-hidden="true">✦</p>
      <p className="sf-eyebrow mt-5">{demo ? 'Demonstration' : 'Live'}</p>
      <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">
        What is real here?
      </h1>
      <p className="mt-5 max-w-measure text-base leading-normal text-grey-muted">
        {demo
          ? 'This build runs without a database, so you can walk the whole House without setting anything up. Here is exactly what works and what is standing in.'
          : 'This build is connected to a database. Everything below is live.'}
      </p>

      <div className="mt-12 overflow-x-auto border border-rule">
        <table className="w-full min-w-[36rem] text-sm">
          <tbody className="divide-y divide-rule">
            {rows.map((r) => (
              <tr key={r.thing}>
                <td className="px-5 py-4 align-top text-ivory">{r.thing}</td>
                <td className="px-5 py-4 align-top">
                  <span className={`inline-block whitespace-nowrap border px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] ${badge[r.state]}`}>
                    {label[r.state]}
                  </span>
                </td>
                <td className="px-5 py-4 align-top text-grey-muted">{r.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-10 text-sm leading-normal text-grey-muted">
        Nothing you type here is sent anywhere or kept. The journal lives in
        the server&rsquo;s memory for as long as it happens to be running.
      </p>

      <Link
        href="/"
        className="mt-8 inline-block border-b border-gold/40 pb-1 font-ui text-sm text-gold transition-colors hover:border-gold hover:text-gold-soft"
      >
        Back to the House
      </Link>
    </section>
  );
}
