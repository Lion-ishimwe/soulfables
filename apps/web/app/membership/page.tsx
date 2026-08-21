import type { Metadata } from 'next';
import { getViewer } from '@/lib/auth';
import { getPlan } from '@/lib/membership';
import { PlanSwitcher } from '@/components/plan-switcher';

export const metadata: Metadata = {
  title: 'Residency',
  description:
    'Free readers have the run of the library. Residents get the narrated editions, the premium shelves and the companion.',
  alternates: { canonical: '/membership' },
};

export const dynamic = 'force-dynamic';

const TIERS = [
  {
    slug: 'free',
    name: 'Reader',
    price: 'Free',
    line: 'The library, the journal, and the Weekly Letter.',
    includes: [
      'Every free folktale in the House',
      'Your private reading journal',
      'Saved stories, bookmarks and kept passages',
      'The Weekly Letter',
    ],
  },
  {
    slug: 'resident',
    name: 'Resident',
    price: '$6',
    per: 'a month',
    line: 'Everything in the House, including the narrated editions.',
    includes: [
      'Everything a Reader has',
      'The premium shelves',
      'Narrated stories, and offline listening',
      'The Librarian, whenever you want them',
      'A standing invitation to Residents',
    ],
  },
] as const;

export default async function MembershipPage() {
  const [viewer, plan] = await Promise.all([getViewer(), getPlan()]);

  return (
    <div className="mx-auto max-w-page px-5 py-20 sm:px-8">
      <header className="mx-auto max-w-content text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">Residency</p>
        <h1 className="mt-4 font-display text-4xl font-light text-ivory sm:text-5xl">
          Visit, or live here.
        </h1>
        <p className="mx-auto mt-5 max-w-measure text-base leading-normal text-grey-muted">
          Most of the House is open to everyone and always will be. Residency
          is for the people who keep coming back.
        </p>
      </header>

      <div className="mt-14 grid gap-px bg-rule sm:grid-cols-2">
        {TIERS.map((tier) => {
          const current = plan === tier.slug;
          return (
            <article
              key={tier.slug}
              className={`flex flex-col bg-ink p-8 sm:p-10 ${current ? 'ring-1 ring-inset ring-gold/30' : ''}`}
            >
              <div className="flex items-baseline justify-between gap-3">
                <h2 className="font-display text-3xl font-light text-ivory">
                  {tier.name}
                </h2>
                {current && (
                  <span className="border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold">
                    Yours
                  </span>
                )}
              </div>

              <p className="mt-3 font-display text-4xl text-gold">
                {tier.price}
                {'per' in tier && (
                  <span className="ml-2 font-ui text-sm text-grey-muted">{tier.per}</span>
                )}
              </p>

              <p className="mt-4 text-sm leading-normal text-grey">{tier.line}</p>

              <ul className="mt-7 flex-1 space-y-2.5">
                {tier.includes.map((item) => (
                  <li key={item} className="flex gap-3 text-sm text-grey-muted">
                    <span aria-hidden="true" className="text-gold">✦</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="mt-8">
                <PlanSwitcher
                  target={tier.slug as 'free' | 'resident'}
                  current={plan}
                  signedIn={Boolean(viewer)}
                />
              </div>
            </article>
          );
        })}
      </div>

      <p className="mx-auto mt-10 max-w-measure text-center text-xs leading-normal text-grey-muted">
        Residency is monthly and you can stop whenever you like. Anything you
        have bought outright stays yours either way — a book you own is not
        rented.
      </p>
    </div>
  );
}
