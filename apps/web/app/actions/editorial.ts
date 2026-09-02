'use server';

import type { Route } from 'next';
import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import {
  demoSaveShelf,
  demoDeleteShelf,
  demoGetShelf,
  demoSaveAuthor,
  demoDeleteAuthor,
  demoGetAuthor,
  demoSaveFeatured,
  demoDeleteFeatured,
} from '@/lib/demo/editorial';

/**
 * Shelves, authors, and what the front door features.
 *
 * One file because they share a shape: staff-only, slug-keyed, audited,
 * and each writes to Postgres in live mode or the editorial store in
 * demo. The pages calling them cannot tell which.
 *
 * Renaming is the interesting case. A shelf's slug is its URL, and
 * changing it breaks every link a reader has ever shared — so the forms
 * warn, and the journey graph is repaired here rather than left pointing
 * at a shelf that no longer answers.
 */

export type EditorialResult = { error?: string; message?: string };

function field(formData: FormData, name: string): string {
  const v = formData.get(name);
  return typeof v === 'string' ? v : '';
}

function checkboxes(formData: FormData, name: string): string[] {
  return formData.getAll(name).filter((v): v is string => typeof v === 'string');
}

async function audit(
  action: string,
  entityType: string,
  entityId: string,
  after: unknown,
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const viewer = await requireStaff();
    const h = await headers();
  } catch (e) {
    console.error('[audit] not logged', e);
  }
}

const slugRule = z
  .string()
  .trim()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.')
  .max(120);

// =====================================================================
// Shelves
// =====================================================================

const shelfSchema = z.object({
  slug: slugRule,
  label: z.string().trim().min(1, 'A shelf needs a label.').max(80),
  title: z.string().trim().min(1, 'A shelf needs a title.').max(200),
  emoji: z.string().trim().max(8).optional().or(z.literal('')),
  tagline: z.string().trim().max(300).optional().or(z.literal('')),
  librarianNote: z.string().trim().max(1000).optional().or(z.literal('')),
  entryStorySlug: z.string().trim().max(120).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(999).catch(0),
  status: z.enum(['draft', 'published']),
});

export async function saveShelf(
  _prev: EditorialResult,
  formData: FormData,
): Promise<EditorialResult> {
  await requireStaff();

  const original = field(formData, 'originalSlug') || null;
  const parsed = shelfSchema.safeParse({
    slug: field(formData, 'slug'),
    label: field(formData, 'label'),
    title: field(formData, 'title'),
    emoji: field(formData, 'emoji'),
    tagline: field(formData, 'tagline'),
    librarianNote: field(formData, 'librarianNote'),
    entryStorySlug: field(formData, 'entryStorySlug'),
    sortOrder: field(formData, 'sortOrder'),
    status: field(formData, 'status'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;

  const arrivesFrom = checkboxes(formData, 'arrivesFrom').filter((x) => x !== d.slug);
  const continuesTo = checkboxes(formData, 'continuesTo').filter((x) => x !== d.slug);

  if (isDemoMode()) {
    const existing = original ? demoGetShelf(original) : null;
    const result = demoSaveShelf(original, {
      slug: d.slug,
      label: d.label,
      title: d.title,
      emoji: d.emoji || '',
      tagline: d.tagline || '',
      librarianNote: d.librarianNote || null,
      entryStorySlug: d.entryStorySlug || null,
      accentColor: existing?.accentColor ?? null,
      sortOrder: d.sortOrder,
      status: d.status,
      arrivesFrom,
      continuesTo,
    });
    if (result.error) return { error: result.error };
  } else {
    const supabase = await createClient();
    const row = {
      slug: d.slug,
      label: d.label,
      title: d.title,
      emoji: d.emoji || null,
      tagline: d.tagline || null,
      librarian_note: d.librarianNote || null,
      sort_order: d.sortOrder,
      status: d.status,
    };

    const { error } = original
      ? await supabase.from('shelves').update(row).eq('slug', original)
      : await supabase.from('shelves').insert(row);

    if (error) {
      return {
        error:
          error.code === '23505'
            ? 'Another shelf already uses that web address.'
            : error.message,
      };
    }

    // Journey edges are rows; replace them wholesale for this shelf.
    const { data: shelfRow } = await supabase
      .from('shelves')
      .select('id')
      .eq('slug', d.slug)
      .single();

    if (shelfRow) {
      await supabase.from('shelf_journeys').delete().eq('shelf_id', shelfRow.id);

      const { data: related } = await supabase
        .from('shelves')
        .select('id, slug')
        .in('slug', [...arrivesFrom, ...continuesTo]);

      const idOf = (slug: string) =>
        (related ?? []).find((r) => r.slug === slug)?.id;

      const edges = [
        ...arrivesFrom.map((slug, i) => ({
          shelf_id: shelfRow.id,
          related_shelf_id: idOf(slug),
          direction: 'arrives_from' as const,
          sort_order: i,
        })),
        ...continuesTo.map((slug, i) => ({
          shelf_id: shelfRow.id,
          related_shelf_id: idOf(slug),
          direction: 'continues_to' as const,
          sort_order: i,
        })),
      ].filter((e) => e.related_shelf_id);

      if (edges.length) await supabase.from('shelf_journeys').insert(edges);
    }
  }

  await audit(original ? 'shelf.update' : 'shelf.create', 'shelf', d.slug, {
    slug: d.slug,
    status: d.status,
  });

  revalidatePath('/', 'layout');

  revalidateTag('content');
  revalidatePath(`/shelf/${d.slug}`);
  revalidateTag('content');
  if (original && original !== d.slug) revalidatePath(`/shelf/${original}`);

  redirect(`/admin/shelves?saved=${encodeURIComponent(d.label)}` as Route);
}

export async function deleteShelf(formData: FormData): Promise<void> {
  await requireStaff();
  const slug = field(formData, 'slug');
  if (!slug) return;

  if (isDemoMode()) {
    demoDeleteShelf(slug);
  } else {
    const supabase = await createClient();
    await supabase.from('shelves').delete().eq('slug', slug);
  }

  await audit('shelf.delete', 'shelf', slug, null);

  revalidatePath('/', 'layout');

  revalidateTag('content');
  redirect('/admin/shelves?deleted=1' as Route);
}

// =====================================================================
// Authors
// =====================================================================

const authorSchema = z.object({
  slug: slugRule,
  name: z.string().trim().min(1, 'An author needs a name.').max(120),
  bio: z.string().trim().max(1000).optional().or(z.literal('')),
  avatarUrl: z.string().trim().max(600).optional().or(z.literal('')),
  isPersona: z.string().optional(),
  sortOrder: z.coerce.number().int().min(0).max(999).catch(0),
});

export async function saveAuthor(
  _prev: EditorialResult,
  formData: FormData,
): Promise<EditorialResult> {
  await requireStaff();

  const original = field(formData, 'originalSlug') || null;
  const parsed = authorSchema.safeParse({
    slug: field(formData, 'slug'),
    name: field(formData, 'name'),
    bio: field(formData, 'bio'),
    avatarUrl: field(formData, 'avatarUrl'),
    isPersona: field(formData, 'isPersona'),
    sortOrder: field(formData, 'sortOrder'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const isPersona = d.isPersona === 'on';

  if (isDemoMode()) {
    const result = demoSaveAuthor(original, {
      slug: d.slug,
      name: d.name,
      bio: d.bio || null,
      avatarUrl: d.avatarUrl || null,
      isPersona,
      sortOrder: d.sortOrder,
    });
    if (result.error) return { error: result.error };
  } else {
    const supabase = await createClient();
    const row = {
      slug: d.slug,
      name: d.name,
      bio: d.bio || null,
      avatar_url: d.avatarUrl || null,
      is_persona: isPersona,
      sort_order: d.sortOrder,
    };

    const { error } = original
      ? await supabase.from('authors').update(row).eq('slug', original)
      : await supabase.from('authors').insert(row);

    if (error) {
      return {
        error:
          error.code === '23505'
            ? 'Another author already uses that web address.'
            : error.message,
      };
    }
  }

  await audit(original ? 'author.update' : 'author.create', 'author', d.slug, {
    slug: d.slug,
    isPersona,
  });

  revalidatePath('/', 'layout');

  revalidateTag('content');
  redirect(`/admin/authors?saved=${encodeURIComponent(d.name)}` as Route);
}

export async function deleteAuthor(formData: FormData): Promise<void> {
  await requireStaff();
  const slug = field(formData, 'slug');
  if (!slug) return;

  if (isDemoMode()) {
    demoDeleteAuthor(slug);
  } else {
    const supabase = await createClient();
    // Stories keep their row; author_id is set null by the FK.
    await supabase.from('authors').delete().eq('slug', slug);
  }

  await audit('author.delete', 'author', slug, null);

  revalidatePath('/', 'layout');

  revalidateTag('content');
  redirect('/admin/authors?deleted=1' as Route);
}

// =====================================================================
// Featured
// =====================================================================

/**
 * Placements that show exactly one thing.
 *
 * Placing a second item in one of these used to queue silently behind the
 * first, so an editor would place something, see the admin list grow, and
 * find the front door unchanged. These replace instead.
 */
const SINGULAR: ReadonlySet<string> = new Set(['home_hero', 'shop_hero']);

const featuredSchema = z.object({
  id: z.string().trim().max(80).optional().or(z.literal('')),
  placement: z.enum(['home_hero', 'librarian_pick', 'shop_hero', 'shelf_spotlight']),
  entityType: z.enum(['story', 'shelf', 'product', 'letter']),
  entitySlug: z.string().trim().min(1, 'Choose what to feature.').max(120),
  headline: z.string().trim().max(200).optional().or(z.literal('')),
  blurb: z.string().trim().max(500).optional().or(z.literal('')),
  sortOrder: z.coerce.number().int().min(0).max(99).catch(0),
  active: z.string().optional(),
});

export async function saveFeatured(
  _prev: EditorialResult,
  formData: FormData,
): Promise<EditorialResult> {
  await requireStaff();

  const parsed = featuredSchema.safeParse({
    id: field(formData, 'id'),
    placement: field(formData, 'placement'),
    entityType: field(formData, 'entityType'),
    entitySlug: field(formData, 'entitySlug'),
    headline: field(formData, 'headline'),
    blurb: field(formData, 'blurb'),
    sortOrder: field(formData, 'sortOrder'),
    active: field(formData, 'active'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const d = parsed.data;
  const id = d.id || `feat-${Date.now()}`;

  if (isDemoMode()) {
    if (SINGULAR.has(d.placement)) {
      const { demoListFeatured, demoDeleteFeatured: drop } = await import(
        '@/lib/demo/editorial'
      );
      for (const existing of demoListFeatured()) {
        if (existing.placement === d.placement && existing.id !== id) {
          drop(existing.id);
        }
      }
    }

    demoSaveFeatured({
      id,
      placement: d.placement,
      entityType: d.entityType,
      entitySlug: d.entitySlug,
      headline: d.headline || null,
      blurb: d.blurb || null,
      sortOrder: d.sortOrder,
      active: d.active === 'on',
    });
  } else {
    const supabase = await createClient();
    // featured_slots stores an entity id; resolve the slug to one.
    const table =
      d.entityType === 'story'
        ? 'stories'
        : d.entityType === 'shelf'
          ? 'shelves'
          : d.entityType === 'product'
            ? 'products'
            : 'letters';

    const { data: entity } = await supabase
      .from(table)
      .select('id')
      .eq('slug', d.entitySlug)
      .maybeSingle();

    if (!entity) {
      return { error: `Nothing called "${d.entitySlug}" exists to feature.` };
    }

    const row = {
      placement: d.placement,
      entity_type: d.entityType,
      entity_id: entity.id,
      headline: d.headline || null,
      blurb: d.blurb || null,
      sort_order: d.sortOrder,
      // An inactive slot is one whose window has already closed.
      ends_at: d.active === 'on' ? null : new Date().toISOString(),
    };

    if (SINGULAR.has(d.placement)) {
      // Close any other slot in this placement rather than leaving it to
      // compete on sort order.
      await supabase
        .from('featured_slots')
        .delete()
        .eq('placement', d.placement)
        .neq('id', d.id || '00000000-0000-0000-0000-000000000000');
    }

    const { error } = d.id
      ? await supabase.from('featured_slots').update(row).eq('id', d.id)
      : await supabase.from('featured_slots').insert(row);

    if (error) return { error: error.message };
  }

  await audit('featured.save', 'featured_slot', id, {
    placement: d.placement,
    entitySlug: d.entitySlug,
  });

  revalidatePath('/', 'layout');

  revalidateTag('content');
  redirect('/admin/featured?saved=1' as Route);
}

export async function deleteFeatured(formData: FormData): Promise<void> {
  await requireStaff();
  const id = field(formData, 'id');
  if (!id) return;

  if (isDemoMode()) {
    demoDeleteFeatured(id);
  } else {
    const supabase = await createClient();
    await supabase.from('featured_slots').delete().eq('id', id);
  }

  await audit('featured.delete', 'featured_slot', id, null);

  revalidatePath('/', 'layout');

  revalidateTag('content');
  redirect('/admin/featured?deleted=1' as Route);
}

// =====================================================================
// The front door backdrop
// =====================================================================

/**
 * A featured slot that carries a picture instead of a story.
 *
 * Singular by nature — there is one front door — so this replaces rather
 * than appends, the same way home_hero does. Migration 0022 made
 * entity_id optional and added image_url for exactly this.
 */
export async function saveBackdrop(url: string): Promise<{ error?: string } | void> {
  await requireStaff();

  const trimmed = url.trim();
  if (!trimmed) return { error: 'Choose or upload an image first.' };
  if (!/^https?:\/\//i.test(trimmed)) {
    return { error: 'That is not a web address. It should begin http:// or https://' };
  }

  if (isDemoMode()) {
    return { error: 'Demo mode keeps nothing. Connect a database and this sticks.' };
  }

  const supabase = await createClient();

  await supabase.from('featured_slots').delete().eq('placement', 'home_backdrop');

  const { error } = await supabase.from('featured_slots').insert({
    placement: 'home_backdrop',
    image_url: trimmed,
    sort_order: 0,
  });

  if (error) return { error: error.message };

  revalidateTag('content');
  revalidatePath('/');
  revalidatePath('/admin/settings/featured');
}

/** Back to the drawn backdrop. */
export async function clearBackdrop(): Promise<void> {
  await requireStaff();
  if (isDemoMode()) return;

  const supabase = await createClient();
  await supabase.from('featured_slots').delete().eq('placement', 'home_backdrop');

  revalidateTag('content');
  revalidatePath('/');
  revalidatePath('/admin/settings/featured');
}

/**
 * Move a placement up or down its list.
 *
 * Ordering is a swap, not a renumber. Rewriting every sort_order on each
 * click means two people arranging the same list at once produce a
 * sequence neither of them chose; swapping two rows touches only what
 * moved, and the worst case is that one move is lost rather than the
 * whole order scrambled.
 */
export async function moveFeatured(formData: FormData): Promise<void> {
  await requireStaff();

  const id = field(formData, 'id');
  const direction = field(formData, 'direction') === 'up' ? 'up' : 'down';
  if (!id) return;

  if (isDemoMode()) {
    const { demoMoveFeatured } = await import('@/lib/demo/editorial');
    demoMoveFeatured?.(id, direction);
  } else {
    const supabase = await createClient();

    const { data: self } = await supabase
      .from('featured_slots')
      .select('id, placement, sort_order')
      .eq('id', id)
      .maybeSingle();

    if (!self) return;

    // The nearest row on the side we are moving towards.
    const query = supabase
      .from('featured_slots')
      .select('id, sort_order')
      .eq('placement', self.placement as string)
      .limit(1);

    const { data: neighbours } =
      direction === 'up'
        ? await query.lt('sort_order', self.sort_order as number).order('sort_order', { ascending: false })
        : await query.gt('sort_order', self.sort_order as number).order('sort_order', { ascending: true });

    const neighbour = neighbours?.[0];
    // Already at the end. Nothing to swap with is not a failure.
    if (!neighbour) return;

    await Promise.all([
      supabase.from('featured_slots').update({ sort_order: neighbour.sort_order }).eq('id', self.id),
      supabase
        .from('featured_slots')
        .update({ sort_order: self.sort_order })
        .eq('id', neighbour.id as string),
    ]);
  }

  revalidateTag('content');
  revalidatePath('/');
  revalidatePath('/library');
  revalidatePath('/shop');
  revalidatePath('/admin/settings/featured');
}
