import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { getHouseSettings } from '@/lib/settings';
import { LEGAL, legalDate } from '@/lib/legal';

export const metadata: Metadata = {
  title: 'Digital Products',
  description:
    'What you get when you buy a book from the House, when you get it, what you may do with it, and when money comes back.',
  alternates: { canonical: '/digital-products' },
};

export const revalidate = 3600;

/**
 * The digital products policy.
 *
 * The terms say what the House and a reader owe each other in general.
 * This page is the part a buyer actually looks for: what arrives, when,
 * what they may do with it, and what happens when something is wrong or
 * they change their mind. Every promise here matches a mechanism —
 * delivery on capture, the library, the download log, the refund path in
 * the webhook — and the numbers are the House's decisions: seven days
 * for any refund, a change of mind only if nothing was downloaded,
 * prices that include VAT.
 *
 * The seller is whatever Settings → The House names as the registered
 * business; until then it is the House itself.
 */
export default async function DigitalProductsPage() {
  const house = await getHouseSettings();
  const who = house.legalName ?? house.siteName;
  const updated = legalDate(LEGAL.digitalProducts);

  const h = 'mt-12 font-display text-2xl text-ivory';
  const p = 'mt-4 font-reading text-lg leading-relaxed text-grey';
  const li = 'font-reading text-lg leading-relaxed text-grey';
  const shop = (
    <a href={`mailto:${house.supportEmailShop}`} className="text-gold hover:text-gold-soft">
      {house.supportEmailShop}
    </a>
  );

  return (
    <article className="mx-auto max-w-measure px-5 py-20 sm:px-8">
      <p className="sf-eyebrow">The House</p>
      <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">
        Digital Products
      </h1>
      <p className="mt-5 font-ui text-sm text-grey-muted">
        Last changed {updated}. The short version: you get the book the moment you pay, it stays
        in your library, you may download it as often as you like for yourself, refunds are
        possible within seven days of purchase, a change of mind only if you never downloaded it,
        and the price you see includes VAT.
      </p>

      <h2 className={h}>Who is selling</h2>
      <p className={p}>
        {who} sells the books in the{' '}
        <Link href={'/shop' as Route} className="text-gold hover:text-gold-soft">Bookshop</Link>.
        {house.legalAddress && ` Its registered address is ${house.legalAddress.replace(/\n+/g, ', ')}.`}
        {house.vatNumber && ` Its VAT number is ${house.vatNumber}.`} Questions about a purchase go
        to {shop}, with your order reference.
      </p>

      <h2 className={h}>What you are buying</h2>
      <p className={p}>
        A digital book: the files in the formats listed on its page, usually PDF and EPUB, and a
        personal licence to read them. You are not buying a printed copy, and you are not buying the
        right to pass the files on. A bundle is the same, several times over. A deck of reflection
        cards is a printable file and is treated exactly like a book.
      </p>

      <h2 className={h}>When you get it</h2>
      <p className={p}>
        The moment your payment clears. The book is placed in your{' '}
        <Link href={'/account/library' as Route} className="text-gold hover:text-gold-soft">library</Link>{' '}
        at once, in every format it comes in, and a receipt is sent to the address you gave. If you
        bought without an account, the book is tied to that email address; make an account with the
        same address later and it will be waiting.
      </p>
      <p className={p}>
        If the payment clears and the book does not appear within a few minutes, write to {shop}{' '}
        with the order reference from your receipt. That is a fault on our side and we fix it first.
      </p>

      <h2 className={h}>Downloads</h2>
      <p className={p}>
        As often as you like, for as long as the House stands. There is a sensible ceiling on how
        many downloads one account can start in an hour, there to stop a leaked link from being used
        as a public copy, and it is far above anything a reader would reach. Each download is noted
        — which file, when, and to where — as the{' '}
        <Link href={'/privacy' as Route} className="text-gold hover:text-gold-soft">privacy page</Link>{' '}
        explains.
      </p>

      <h2 className={h}>Your licence</h2>
      <ul className="mt-4 list-disc space-y-3 pl-5">
        <li className={li}><strong className="text-ivory">You may</strong> read the book on any device you own, keep copies for your own use, print a deck for your own table, and quote short passages with attribution.</li>
        <li className={li}><strong className="text-ivory">You may not</strong> sell, lend, give away, share or publish the files, remove the copyright notice, or use the text to train software.</li>
        <li className={li}><strong className="text-ivory">The words stay the author’s.</strong> A purchase does not transfer copyright in any story, cover or design.</li>
      </ul>

      <h2 className={h}>The right to withdraw</h2>
      <p className={p}>
        Under European consumer law you may normally withdraw from a distance purchase within
        a set period. For digital content that right ends once delivery has begun with your
        agreement. That is why the checkout asks you to tick that you want the book delivered
        straight away and understand that the legal right no longer applies. In its place the
        House gives the seven days set out above. The tick is recorded with your order, together
        with the version of this page you accepted.
      </p>

      <h2 className={h}>Refunds</h2>
      <ul className="mt-4 list-disc space-y-3 pl-5">
        <li className={li}>
          <strong className="text-ivory">Something is wrong with what you received.</strong> A file
          that will not open, a book that is not what its page described, a format that is missing.
          Write to {shop}, or ask from your receipt, within seven days of purchase. We put it right
          first, usually with a corrected file. If we cannot, we refund the purchase in full.
        </li>
        <li className={li}>
          <strong className="text-ivory">You changed your mind.</strong> Within seven days of
          purchase, if you have not downloaded any file of the book, we refund it in full on request.
          Once a file has been downloaded, a change of mind is no longer grounds for a refund.
        </li>
        <li className={li}>
          <strong className="text-ivory">You bought the same book twice.</strong> Refunded, if you
          ask within seven days of the second purchase.
        </li>
        <li className={li}>
          <strong className="text-ivory">Residency.</strong> Renewals and cancellation are described in
          the <Link href={'/terms' as Route} className="text-gold hover:text-gold-soft">terms</Link>.
        </li>
      </ul>
      <p className={p}>
        A refund goes back the way the payment came, through PayPal, and usually shows within a few
        days. A refund removes the book from your library. Your receipt then shows the refund, on
        your{' '}
        <Link href={'/account/orders' as Route} className="text-gold hover:text-gold-soft">orders page</Link>.
      </p>

      <h2 className={h}>Prices and VAT</h2>
      <p className={p}>
        The price shown is the price charged, in the currency shown, and it includes VAT wherever
        VAT applies. There are no fees added at checkout. Your receipt states the total paid and,
        where {who} is registered for VAT, its VAT number. Payment is taken by PayPal; the House
        never sees or stores card or bank details.
      </p>

      <h2 className={h}>Narration</h2>
      <p className={p}>
        Stories in the library may be read aloud by a generated voice, and are labelled as such. A
        narration is part of reading a story on the site; it is not a product, it is not included
        in a book’s files, and it is not the same thing as a recorded edition, which would be
        offered and described separately.
      </p>

      <h2 className={h}>Changes</h2>
      <p className={p}>
        When this page changes in substance, the date at the top changes with it. What you accepted
        at the time of a purchase is recorded with that order and is what applies to it.
      </p>
    </article>
  );
}
