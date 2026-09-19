import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { getHouseSettings } from '@/lib/settings';
import { LEGAL, legalDate } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Terms',
  description: 'The terms on which the House opens its doors: accounts, purchases, refunds, and what is whose.',
  alternates: { canonical: '/terms' },
};

export const revalidate = 3600;

/**
 * The terms.
 *
 * Plain terms for a plain product: an account is free, a book is bought
 * once and kept, digital goods arrive at once and so the withdrawal
 * right is waived with the buyer's consent at checkout, and the words
 * belong to whoever wrote them. Names the registered business from
 * Settings → The House once there is one.
 */
export default async function TermsPage() {
  const house = await getHouseSettings();
  const who = house.legalName ?? house.siteName;
  const updated = legalDate(LEGAL.terms);

  const h = 'mt-12 font-display text-2xl text-ivory';
  const p = 'mt-4 font-reading text-lg leading-relaxed text-grey';

  return (
    <article className="mx-auto max-w-measure px-5 py-20 sm:px-8">
      <p className="sf-eyebrow">The House</p>
      <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">Terms</h1>
      <p className="mt-5 font-ui text-sm text-grey-muted">
        Last changed {updated}. These are the terms between you and {who} when you use Soulfables.
        They are meant to be read, so they are short.
      </p>

      <h2 className={h}>The House and you</h2>
      <p className={p}>
        Soulfables is a library of stories and the rooms around it: a journal, a shelf, a
        bookshop. Reading the free stories needs no account. An account is free and gives you a
        shelf, a journal and a place for what you buy. You must be at least sixteen to hold one,
        and you are responsible for keeping your password to yourself.
      </p>

      <h2 className={h}>Buying a book</h2>
      <p className={p}>
        The price shown is the price charged, including VAT where it applies. Payment is taken by
        PayPal; we never see your card or bank details. When payment clears, the book is placed in
        your library at once and stays there for as long as the House stands, to download as often
        as you like for your own reading. You may not sell, share or publish it.
      </p>
      <p className={p}>
        Because a book is delivered the moment you pay, you agree at checkout to immediate delivery
        and acknowledge that the fourteen-day right to withdraw no longer applies once delivery has
        begun. What happens when a file is faulty, when you change your mind, or when you bought
        something twice is set out in the{' '}
        <Link href={'/digital-products' as Route} className="text-gold hover:text-gold-soft">digital products policy</Link>,
        which forms part of these terms.
      </p>

      <h2 className={h}>Premium</h2>
      <p className={p}>
        Premium is a subscription that opens the stories and narrations kept for Premium readers, the generated companion, guided journals, sleep stories, early access and your own theme.
        It renews until you cancel it, and cancelling stops the next renewal; what you have paid
        for stays open until the end of the period paid. Anything bought outright stays yours
        regardless.
      </p>

      <h2 className={h}>What is whose</h2>
      <p className={p}>
        The stories, their narrations and the House&rsquo;s own words belong to {who} or to the
        writers who wrote them, and are licensed to you to read and listen to, not to copy or
        reuse. Everything you write in your journal belongs to you and stays private to you. If
        you ever choose to share a reflection with the House, you give us permission to show it
        where you asked, and you can withdraw that at any time.
      </p>

      <h2 className={h}>Generated voices</h2>
      <p className={p}>
        Some stories are read aloud by a generated voice. Where that is so, the player says so.
        A generated reading is offered as a convenience, not as a narrated edition, and may be
        replaced by a recording.
      </p>

      <h2 className={h}>Conduct</h2>
      <p className={p}>
        The House asks only that you use it as it is meant to be used. Do not try to reach what
        is not yours, copy what you have not bought, or interfere with the service for others. We
        may close an account that does.
      </p>

      <h2 className={h}>The limits of what we promise</h2>
      <p className={p}>
        We will keep the House running and your library available with reasonable care, and we
        will tell you if that changes. The service is provided as it is; beyond what the law
        will not let us exclude, our liability to you is limited to what you paid us in the twelve
        months before a claim.
      </p>

      <h2 className={h}>Law</h2>
      <p className={p}>
        These terms are governed by the law of the country where {who} is registered, without
        taking away any protection the law of your own country gives you as a consumer. Nothing
        here limits your legal rights.
      </p>

      <h2 className={h}>Changes</h2>
      <p className={p}>
        When these terms change, the date at the top changes with it, and anything that affects
        a purchase you have already made will not apply to it.
      </p>
    </article>
  );
}
