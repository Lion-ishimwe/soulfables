import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { getHouseSettings } from '@/lib/settings';
import { LEGAL, legalDate } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Privacy',
  description: 'What the House keeps about you, why, for how long, and what you can do about it.',
  alternates: { canonical: '/privacy' },
};

export const revalidate = 3600;

/**
 * The privacy page.
 *
 * Written from what the system actually does, table by table, rather
 * than from a template. Every claim here has a mechanism behind it: the
 * journal policy is a database rule, the export and deletion are buttons
 * on the account page, the retention of receipts is a "set null" on a
 * foreign key. If the system changes, this page has to change with it.
 *
 * The controller is whatever Settings → The House names as the
 * registered business; until then it is the House itself.
 */
export default async function PrivacyPage() {
  const house = await getHouseSettings();
  const who = house.legalName ?? house.siteName;
  const updated = legalDate(LEGAL.privacy);

  const h = 'mt-12 font-display text-2xl text-ivory';
  const p = 'mt-4 font-reading text-lg leading-relaxed text-grey';
  const li = 'font-reading text-lg leading-relaxed text-grey';

  return (
    <article className="mx-auto max-w-measure px-5 py-20 sm:px-8">
      <p className="sf-eyebrow">The House</p>
      <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">Privacy</h1>
      <p className="mt-5 font-ui text-sm text-grey-muted">
        Last changed {updated}. The short version: we keep what the House needs to work for you,
        nothing is sold, the journal is private including from us, and you can take a copy of
        everything or delete it all from your account page.
      </p>

      <h2 className={h}>Who is responsible</h2>
      <p className={p}>
        {who} runs Soulfables and is the controller of the personal data described here.
        {house.legalAddress && ` Its registered address is ${house.legalAddress.replace(/\n+/g, ', ')}.`}{' '}
        Questions about your data go to{' '}
        <a href={`mailto:${house.supportEmailGeneral}`} className="text-gold hover:text-gold-soft">{house.supportEmailGeneral}</a>.
      </p>

      <h2 className={h}>What we keep, and why</h2>
      <ul className="mt-4 list-disc space-y-3 pl-5">
        <li className={li}><strong className="text-ivory">Your account.</strong> Email address, the name you give, a password we never see in the clear. So you can sign in and so your library is yours.</li>
        <li className={li}><strong className="text-ivory">Your reading.</strong> How far through each story you are, where you paused in a narration, what you saved, bookmarked and kept. So the House can remember your place and your shelf.</li>
        <li className={li}><strong className="text-ivory">Your journal.</strong> Every reflection you write, with the feeling and story you attached to it. Private: the database allows only you to read your entries, and no member of staff has a way around that rule. Nothing in the journal is read by any software of ours unless you ask: a Premium reader may press a button on the journal page asking the Librarian what it notices in their recent entries, and only then are those entries sent, once, to the model that answers; the answer is shown to you and not stored.</li>
        <li className={li}><strong className="text-ivory">Your orders.</strong> What you bought, when, for how much, and the payment reference the payment provider gave us. We never see or store card or bank details; PayPal handles those.</li>
        <li className={li}><strong className="text-ivory">Downloads.</strong> Each time you download a book we record which file, when, and the network address it went to, so a leaked link can be traced and a dispute answered.</li>
        <li className={li}><strong className="text-ivory">Reading counts.</strong> Which stories are opened and finished, counted for the House. Attached to your account while you have one.</li>
      </ul>

      <h2 className={h}>What we do not do</h2>
      <p className={p}>
        We do not sell or rent any of it. We do not follow you around other websites: there are no
        advertising trackers here, and the fonts are served from our own address rather than fetched
        from Google. We do not read your journal, and no feature reads it on our behalf.
      </p>

      <h2 className={h}>Who else touches it</h2>
      <ul className="mt-4 list-disc space-y-3 pl-5">
        <li className={li}><strong className="text-ivory">Supabase</strong> hosts the database and the files, under contract to us.</li>
        <li className={li}><strong className="text-ivory">PayPal</strong> takes payment. Your email and what you bought go to PayPal to complete the purchase; PayPal&rsquo;s own privacy terms apply to what you give them.</li>
        <li className={li}><strong className="text-ivory">Amazon Web Services</strong> runs the server, and reads stories aloud where a story has a generated voice. The text read is the story, never anything of yours.</li>
        <li className={li}><strong className="text-ivory">Anthropic</strong> provides the writing assistant used by the House&rsquo;s own writers. Readers&rsquo; data is never sent to it.</li>
        <li className={li}>An email service sends receipts and account emails once one is connected. It receives your address and the message.</li>
      </ul>

      <h2 className={h}>How long</h2>
      <p className={p}>
        For as long as you have an account. When you delete it, your journal, shelf, reading
        history and account details are deleted at once. Receipts for money that changed hands are
        kept for as long as tax law requires, with your account no longer attached to them.
      </p>

      <h2 className={h}>Your rights</h2>
      <p className={p}>
        You can see everything we hold about you and take a copy, as one file, from{' '}
        <Link href={'/account/settings' as Route} className="text-gold hover:text-gold-soft">your account page</Link>.
        You can correct your name there and change your password. You can delete your account and
        everything in it from the same page, without asking us. If you would rather write to us, or
        want to object to anything here, use the address above. You also have the right to complain
        to the data protection authority where you live.
      </p>

      <h2 className={h}>Cookies</h2>
      <p className={p}>
        One cookie keeps you signed in. There are no others. Reading preferences you set are kept
        on your account, not in your browser.
      </p>

      <h2 className={h}>Children</h2>
      <p className={p}>
        Soulfables is written for adults, and accounts are for people aged sixteen and over.
      </p>

      <h2 className={h}>Changes</h2>
      <p className={p}>
        When this page changes, the date at the top changes with it. Anything that changes what we
        keep or why will be said plainly here first.
      </p>
    </article>
  );
}
