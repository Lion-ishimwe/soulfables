import 'server-only';
import type { Route } from 'next';
import { getStories, getShelves, getProducts } from './content';
import { isDemoMode } from './demo/mode';
import { createClient } from './supabase/server';
import type { FeaturedSlot } from './demo/editorial';

/**
 * What the House is currently putting in front of people.
 *
 * This is the read side of the Featured admin. It existed only as a write
 * for a while — the admin saved slots and nothing consulted them, so
 * placing something changed a row and nothing else. That is the whole
 * point of the feature, so it is worth stating plainly: if a page shows
 * featured content, it must read it from here.
 *
 * Slots are resolved to real entities, so a slot pointing at a story that
 * has since been unpublished simply disappears rather than rendering a
 * dead card. An empty placement is normal and means "use the page's own
 * default" — never an error.
 */

export type Placement =
  | 'home_hero'
  | 'librarian_pick'
  | 'shop_hero'
  | 'shelf_spotlight';

export type FeaturedItem = {
  id: string;
  placement: Placement;
  entityType: FeaturedSlot['entityType'];
  slug: string;
  title: string;
  subtitle: string;
  headline: string | null;
  blurb: string | null;
  href: Route;
  coverImage: string | null;
  /** Story-only extras, for rendering a card that looks like the others. */
  shelf?: string;
  author?: string;
  readingMinutes?: number;
  hasAudio?: boolean;
};

async function rawSlots(): Promise<FeaturedSlot[]> {
  if (isDemoMode()) {
    const { demoListFeatured } = await import('./demo/editorial');
    return demoListFeatured();
  }

  const supabase = await createClient();
  const { data } = await supabase
    .from('featured_slots')
    .select('id, placement, entity_type, entity_id, headline, blurb, sort_order, starts_at, ends_at')
    .order('sort_order');

  const now = Date.now();

  return (data ?? [])
    .filter((f: Record<string, unknown>) => {
      const starts = f.starts_at ? new Date(f.starts_at as string).getTime() : 0;
      const ends = f.ends_at ? new Date(f.ends_at as string).getTime() : Infinity;
      return starts <= now && now < ends;
    })
    .map((f: Record<string, unknown>) => ({
      id: f.id as string,
      placement: f.placement as Placement,
      entityType: f.entity_type as FeaturedSlot['entityType'],
      // Live mode stores an id; resolve() below matches on either.
      entitySlug: (f.entity_id as string) ?? '',
      headline: (f.headline as string) ?? null,
      blurb: (f.blurb as string) ?? null,
      sortOrder: (f.sort_order as number) ?? 0,
      active: true,
    }));
}

export async function getFeatured(
  placement: Placement,
): Promise<FeaturedItem[]> {
  const slots = (await rawSlots())
    .filter((s) => s.placement === placement && s.active)
    .sort((a, b) => a.sortOrder - b.sortOrder);

  if (slots.length === 0) return [];

  const [stories, shelves, products] = await Promise.all([
    getStories(),
    getShelves(),
    getProducts(),
  ]);

  const resolved: FeaturedItem[] = [];

  for (const slot of slots) {
    const key = slot.entitySlug;
    const base = {
      id: slot.id,
      placement: slot.placement as Placement,
      entityType: slot.entityType,
      headline: slot.headline,
      blurb: slot.blurb,
    };

    if (slot.entityType === 'story') {
      // Match on slug or id, so the same code serves demo and live.
      const s = stories.find((x) => x.slug === key || x.id === key);
      if (!s) continue;
      resolved.push({
        ...base,
        slug: s.slug,
        title: s.title,
        subtitle: s.subtitle,
        href: `/story/${s.slug}` as Route,
        coverImage: s.coverImage ?? null,
        shelf: s.shelf,
        author: s.author,
        readingMinutes: s.readingMinutes,
        hasAudio: s.hasAudio,
      });
      continue;
    }

    if (slot.entityType === 'shelf') {
      const sh = shelves.find((x) => x.slug === key);
      if (!sh) continue;
      resolved.push({
        ...base,
        slug: sh.slug,
        title: sh.title,
        subtitle: sh.tagline,
        href: `/shelf/${sh.slug}` as Route,
        coverImage: null,
        shelf: sh.slug,
      });
      continue;
    }

    if (slot.entityType === 'product') {
      const p = products.find((x) => x.slug === key || x.id === key);
      if (!p) continue;
      resolved.push({
        ...base,
        slug: p.slug,
        title: p.title,
        subtitle: p.subtitle,
        href: `/shop/${p.slug}` as Route,
        coverImage: p.coverImage ?? null,
      });
      continue;
    }

    // Letters are not modelled in the demo yet; skip rather than guess.
  }

  return resolved;
}

/** Convenience for the placements that only ever show one thing. */
export async function getFeaturedOne(
  placement: Placement,
): Promise<FeaturedItem | null> {
  return (await getFeatured(placement))[0] ?? null;
}
