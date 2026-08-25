import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Support',
  description:
    'Two ways to reach Soulfables — general enquiries, and help with an order or a book you have bought.',
  alternates: { canonical: '/support' },
};

/*
 * Two addresses, and a clear line between them.
 *
 * The commonest support failure is a person waiting on the wrong inbox,
 * so the page leads with which is which rather than with a form. Both are
 * plain mailto links: a contact form that silently fails is worse than an
 * address someone can copy, and there is no send infrastructure behind a
 * form yet.
 */
const DESKS = [
  {
    email: 'hello@soulfables.com',
    title: 'General enquiries',
    blurb:
      'Anything about the House itself — writing for us, permissions, press, or a question that does not fit anywhere else.',
    examples: [
      'Writing for Soulfables',
      'Permissions and reprints',
      'Press and partnerships',
      'Something you would like to tell us',
    ],
  },
  {
    email: 'support@soulfables.com',
    title: 'Orders and books',
    blurb:
      'Anything to do with something you have bought — a missing download, a file that will not open, a receipt, a refund.',
    examples: [
      'A book has not arrived',
      'A download link has expired',
      'A file will not open on your reader',
      'Receipts, refunds and payment questions',
    ],
  },
] as const;

export default function SupportPage() {
  return (
    <div className="mx-auto max-w-content px-5 py-20 sm:px-8">
      <header className="text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">The House</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">
          Getting hold of us
        </h1>
        <p className="mx-auto mt-5 max-w-measure text-base leading-normal text-grey-muted">
          Two addresses, so your message reaches whoever can actually answer
          it. Write to either and we will read it.
        </p>
      </header>

      <div className="mt-14 grid gap-px bg-rule sm:grid-cols-2">
        {DESKS.map((desk) => (
          <section key={desk.email} className="bg-ink p-8">
            <h2 className="font-display text-2xl text-ivory">{desk.title}</h2>

            <a
              href={`mailto:${desk.email}`}
              className="mt-3 inline-block font-ui text-sm text-gold transition-colors hover:text-gold-soft"
            >
              {desk.email}
            </a>

            <p className="mt-4 text-sm leading-normal text-grey-muted">
              {desk.blurb}
            </p>

            <ul className="mt-5 space-y-2">
              {desk.examples.map((e) => (
                <li key={e} className="flex gap-3 text-sm text-grey">
                  <span aria-hidden="true" className="text-gold">✦</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      {/* The answers most messages are actually looking for. */}
      <section className="mt-16">
        <h2 className="sf-eyebrow mb-6 text-center">Before you write</h2>

        <dl className="divide-y divide-rule border border-rule">
          {[
            {
              q: 'A book I bought is not in my library',
              a: 'Books appear the moment payment clears, under the email you used at checkout. If you bought as a guest, create an account with that same address and it will be waiting.',
              href: '/account/library',
              hrefLabel: 'Open your library',
            },
            {
              q: 'A download link stopped working',
              a: 'Download links are deliberately short-lived, so an old one will refuse. Open your library and start the download again — a fresh link is made each time.',
              href: '/account/library',
              hrefLabel: 'Open your library',
            },
            {
              q: 'I want to write for Soulfables',
              a: 'Write to hello@soulfables.com and tell us what you are working on. Writers are given an account and a template; anything written comes to the House before it goes out.',
              href: null,
              hrefLabel: null,
            },
            {
              q: 'How do I stop the Weekly Letter?',
              a: 'Every letter carries an unsubscribe link at the foot. It takes effect immediately and does not touch your account or anything you have bought.',
              href: '/letter',
              hrefLabel: 'The Weekly Letter',
            },
            {
              q: 'What do you keep about me?',
              a: 'Your email, what you have read and kept, and whatever you write in the journal. Journal entries are private — no member of staff can read them, and no database policy grants that.',
              href: '/privacy',
              hrefLabel: 'Privacy',
            },
          ].map((item) => (
            <div key={item.q} className="px-6 py-5">
              <dt className="font-ui text-sm font-semibold text-ivory">
                {item.q}
              </dt>
              <dd className="mt-2 max-w-prose text-sm leading-normal text-grey-muted">
                {item.a}
                {item.href && (
                  <>
                    {' '}
                    <Link
                      href={item.href as '/account/library'}
                      className="text-gold transition-colors hover:text-gold-soft"
                    >
                      {item.hrefLabel}
                    </Link>
                  </>
                )}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <p className="mt-14 text-center font-display text-xl italic text-grey-muted">
        The lamp will be here when you return.
      </p>
    </div>
  );
}
