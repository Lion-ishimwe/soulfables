import type { Metadata } from 'next';
import Link from 'next/link';
import { listAdminFeatured, listAdminShelves } from '@/lib/admin-data';
import { getStories, getProducts } from '@/lib/content';
import { PageHeader, EmptyState } from '@/components/admin/ui';
import { FeaturedForm, type Catalogue } from '@/components/admin/featured-form';
import { deleteFeatured, moveFeatured } from '@/app/actions/editorial';
import { KebabMenu } from '@/components/admin/kebab-menu';
import { SettingsTabs } from '@/components/admin/settings-tabs';
import { BackdropForm } from '@/components/admin/backdrop-form';
import { getBackdrop } from '@/lib/featured';

export const metadata: Metadata = { title: 'Featured' };
export const dynamic = 'force-dynamic';

/** Placements that show exactly one thing; a new placement replaces. */
const SINGULAR = new Set(['home_hero', 'shop_hero']);

const PLACEMENT_LABEL: Record<string, string> = {
  home_hero: 'Front door — hero',
  librarian_pick: 'Front door — the Librarian suggests',
  shop_hero: 'Bookshop — hero',
  shelf_spotlight: 'Shelf — spotlight',
  library_order: 'Library — what comes first',
  shop_order: 'Bookshop — what comes first',
};

/*
 * Placements that hold an ordered list rather than a single slot. These
 * get arrows; the single ones do not, because there is nothing to
 * arrange when only one thing shows.
 */
const ORDERED = new Set(['library_order', 'shop_order', 'librarian_pick']);

/*
 * What the House puts in front of people.
 *
 * Grouped by placement rather than listed flat, because the question
 * being asked is always "what is on the front door right now?" — not
 * "what featured rows exist". A placement with nothing live says so,
 * since an empty slot falls back to whatever the page decides on its own
 * and that is worth knowing before someone wonders why their pick is not
 * showing.
 */
export default async function FeaturedPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; deleted?: string }>;
}) {
  const [{ saved, deleted }, slots, stories, products, shelves, backdrop] =
    await Promise.all([
      searchParams,
      listAdminFeatured(),
      getStories(),
      getProducts(),
      listAdminShelves(),
      getBackdrop(),
    ]);

  const catalogue: Catalogue = {
    story: stories.map((s) => ({ slug: s.slug, title: s.title })),
    shelf: shelves.map((s) => ({ slug: s.slug, title: s.label })),
    product: products.map((p) => ({ slug: p.slug, title: p.title })),
    letter: [],
  };

  // Show a title rather than a slug wherever we can resolve one.
  const titleOf = (type: string, slug: string) => {
    const list = catalogue[type as keyof Catalogue] ?? [];
    return list.find((o) => o.slug === slug)?.title ?? slug;
  };

  const placements = Object.keys(PLACEMENT_LABEL);

  return (
    <>
      <PageHeader
        title="Featured"
        subtitle="What readers meet first, and where. Changing this changes the front door immediately."
      />
      <SettingsTabs />

      <div className="mb-6">
        <BackdropForm current={backdrop} />
      </div>

      {saved && (
        <p className="mb-6 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          Placed. The front door has already changed —{' '}
          <Link href="/" className="text-gold underline underline-offset-2">
            look at it
          </Link>
          .
        </p>
      )}
      {deleted && (
        <p className="mb-6 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          Removed. That slot falls back to whatever the page chooses on its own.
        </p>
      )}

      <div className="mb-10">
        <FeaturedForm catalogue={catalogue} />
      </div>

      {slots.length === 0 ? (
        <EmptyState
          title="Nothing placed."
          body="Every page falls back to something sensible on its own — the newest story, the featured product. Placing something here overrides that."
        />
      ) : (
        <div className="space-y-8">
          {placements.map((placement) => {
            const inSlot = slots.filter((s) => s.placement === placement);

            return (
              <section key={placement}>
                <div className="mb-3 flex items-baseline justify-between gap-4">
                  <h2 className="sf-eyebrow">{PLACEMENT_LABEL[placement]}</h2>
                  <span className="font-ui text-xs text-grey-muted">
                    {inSlot.length === 0
                      ? 'Falls back to the page default'
                      : SINGULAR.has(placement)
                        ? 'Shows one — placing another replaces it'
                        : `Shows ${inSlot.length}`}
                  </span>
                </div>

                {inSlot.length > 0 && (
                  <ul className="divide-y divide-rule border border-rule">
                    {inSlot.map((s, i) => (
                      <li
                        key={s.id}
                        className="flex flex-wrap items-start justify-between gap-4 px-5 py-4"
                      >
                        <div className="min-w-0">
                          <p className="flex flex-wrap items-center gap-3">
                            <span className="text-ivory">
                              {titleOf(s.entityType, s.entitySlug)}
                            </span>
                            <span className="border border-rule px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-grey-muted">
                              {s.entityType}
                            </span>
                            {!s.active && (
                              <span className="border border-rule-strong px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-grey-muted">
                                Not live
                              </span>
                            )}
                          </p>
                          {s.headline && (
                            <p className="mt-1.5 font-display text-lg italic text-grey">
                              {s.headline}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          {ORDERED.has(placement) && inSlot.length > 1 && (
                            <>
                              <form action={moveFeatured}>
                                <input type="hidden" name="id" value={s.id} />
                                <input type="hidden" name="direction" value="up" />
                                <button
                                  type="submit"
                                  disabled={i === 0}
                                  aria-label={`Move ${titleOf(s.entityType, s.entitySlug)} up`}
                                  className="rounded px-2 py-1 font-ui text-sm text-grey-muted transition-colors hover:text-ivory disabled:opacity-30"
                                >
                                  ↑
                                </button>
                              </form>
                              <form action={moveFeatured}>
                                <input type="hidden" name="id" value={s.id} />
                                <input type="hidden" name="direction" value="down" />
                                <button
                                  type="submit"
                                  disabled={i === inSlot.length - 1}
                                  aria-label={`Move ${titleOf(s.entityType, s.entitySlug)} down`}
                                  className="rounded px-2 py-1 font-ui text-sm text-grey-muted transition-colors hover:text-ivory disabled:opacity-30"
                                >
                                  ↓
                                </button>
                              </form>
                            </>
                          )}

                        <KebabMenu
                          label={titleOf(s.entityType, s.entitySlug)}
                          items={[
                            {
                              kind: 'action',
                              label: 'Remove placement',
                              action: deleteFeatured,
                              fields: { id: s.id },
                              danger: true,
                              confirm:
                                'Remove this placement? The slot falls back to whatever the page chooses on its own.',
                            },
                          ]}
                        />
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}
