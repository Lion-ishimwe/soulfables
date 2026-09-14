import type { Metadata } from 'next';
import type { Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getResidents, getStories } from '@/lib/content';
import { Avatar } from '@/components/admin/avatar';
import { StoryCard } from '@/components/story-card';

export const revalidate = 300;

export async function generateStaticParams() {
  return (await getResidents()).map((a) => ({ slug: a.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const author = (await getResidents()).find((a) => a.slug === slug);
  if (!author) return { title: 'Not found' };
  return {
    title: author.name,
    description: author.bio ?? `Stories by ${author.name} at Soulfables.`,
    alternates: { canonical: `/author/${author.slug}` },
    openGraph: { type: 'profile', title: `${author.name} · Soulfables`, description: author.bio ?? undefined },
  };
}

/**
 * A writer's page.
 *
 * Every byline on the site now leads somewhere: who they are, in their
 * own words, and what they have written for the House. A House voice —
 * the Librarian — is shown as what it is, not as a person.
 */
export default async function AuthorPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [authors, stories] = await Promise.all([getResidents(), getStories()]);
  const author = authors.find((a) => a.slug === slug);
  if (!author) notFound();

  const theirs = stories.filter((s) => s.author === author.name);

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': author.isPersona ? 'Organization' : 'Person',
    name: author.name,
    description: author.bio ?? undefined,
    url: `/author/${author.slug}`,
  };

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <header className="mx-auto max-w-content px-5 pb-12 pt-20 text-center sm:px-8">
        <div className="mx-auto flex justify-center">
          <Avatar src={author.avatarUrl} name={author.name} isPersona={author.isPersona} size={96} />
        </div>
        <p className="sf-eyebrow mt-6">{author.isPersona ? 'A voice of the House' : 'Writes for the House'}</p>
        <h1 className="mt-3 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">{author.name}</h1>
        {author.bio && (
          <p className="mx-auto mt-5 max-w-measure font-reading text-lg leading-relaxed text-grey">{author.bio}</p>
        )}
        <p className="mt-5 font-ui text-xs text-grey-muted">
          {theirs.length === 0 ? 'Nothing published yet.' : `${theirs.length} ${theirs.length === 1 ? 'story' : 'stories'} in the library`}
        </p>
      </header>

      {theirs.length > 0 && (
        <section className="mx-auto max-w-page px-5 pb-24 sm:px-8">
          <ul className="grid gap-px bg-rule sm:grid-cols-2 lg:grid-cols-3">
            {theirs.map((s) => (
              <li key={s.slug}>
                <StoryCard story={s} />
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="pb-20 text-center">
        <Link href={'/residents' as Route} className="font-ui text-sm text-gold transition-colors hover:text-gold-soft">
          Everyone who writes here →
        </Link>
      </p>
    </>
  );
}
