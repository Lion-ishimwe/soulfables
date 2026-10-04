import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getPublishedLetter, renderLetterHtml } from '@/lib/letters';
import { formatDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const letter = await getPublishedLetter(slug);
  return { title: letter ? letter.title : 'The Weekly Letter', description: letter?.dek ?? undefined };
}

/**
 * A letter that has gone out, kept for anyone who joins later.
 *
 * The same words as the email, rendered from the same Markdown by the
 * same small renderer, so what the site shows is what readers got.
 */
export default async function LetterIssuePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const letter = await getPublishedLetter(slug);
  if (!letter) notFound();

  return (
    <article className="mx-auto max-w-content px-5 py-20 sm:px-8">
      <header className="text-center">
        <p className="text-gold" aria-hidden="true">✦</p>
        <p className="sf-eyebrow mt-5">
          The Weekly Letter · Vol. {letter.volume} · No. {letter.number} · {formatDate(letter.publishedAt)}
        </p>
        <h1 className="mt-4 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">{letter.title}</h1>
        {letter.dek && <p className="mt-3 font-display text-lg italic text-grey-muted">{letter.dek}</p>}
      </header>

      <div
        className="letter-body mx-auto mt-12 max-w-measure font-reading text-lg leading-relaxed text-grey [&_a]:text-gold [&_blockquote]:text-grey-muted [&_h2]:text-ivory [&_strong]:text-ivory"
        dangerouslySetInnerHTML={{ __html: renderLetterHtml(letter.body) }}
      />

      {letter.featuredStory && (
        <aside className="mx-auto mt-12 max-w-measure border border-rule p-6 text-center">
          <p className="sf-eyebrow">This week&rsquo;s story</p>
          <p className="mt-2 font-display text-2xl text-ivory">{letter.featuredStory.title}</p>
          <Link
            href={`/story/${letter.featuredStory.slug}` as Route}
            className="mt-4 inline-block border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
          >
            Read it
          </Link>
        </aside>
      )}

      <p className="mt-16 text-center font-ui text-sm text-grey-muted">
        <Link href={'/letter' as Route} className="text-gold hover:text-gold-soft">All letters, and how to receive the next one →</Link>
      </p>
    </article>
  );
}
