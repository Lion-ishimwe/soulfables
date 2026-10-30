'use server';

import type { Route } from 'next';

import { revalidatePath, revalidateTag } from 'next/cache';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { createHash } from 'node:crypto';
import { z } from 'zod';
import { field, file as fileField } from '@/lib/form';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth';

/**
 * Product and file management.
 *
 * The upload path is the one that matters. Files go straight into the
 * PRIVATE bucket — there is no public bucket a paid file could reach by
 * mistake, because `private-files` is the only bucket this action names
 * and the storage policies grant no read to anyone.
 */

export type ProductActionResult = { error?: string; message?: string };

const productSchema = z.object({
  title: z.string().trim().min(1, 'A product needs a title.').max(200),
  slug: z
    .string()
    .trim()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and hyphens.')
    .max(120),
  subtitle: z.string().trim().max(300).optional().or(z.literal('')),
  description: z.string().trim().max(4000).optional().or(z.literal('')),
  kind: z.enum(['ebook', 'anthology', 'journal', 'deck', 'audio', 'bundle']),
  eyebrow: z.string().trim().max(120).optional().or(z.literal('')),
  pullQuote: z.string().trim().max(500).optional().or(z.literal('')),
  ctaLabel: z.string().trim().max(60).optional().or(z.literal('')),
  pageCount: z.coerce.number().int().min(0).max(100000).optional(),
  idealFor: z.string().trim().max(1000).optional().or(z.literal('')),
  coverImage: z.string().trim().max(600).optional().or(z.literal('')),
  status: z.enum(['draft', 'in_review', 'published', 'archived']),
  currency: z.string().trim().length(3),
  // Entered in major units by a human, stored in minor units.
  price: z.coerce.number().min(0).max(100000),
});

async function audit(
  actorId: string,
  actorEmail: string | null,
  action: string,
  entityType: string,
  entityId: string,
  before: unknown,
  after: unknown,
) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return;
  try {
    const h = await headers();
  } catch (e) {
    console.error('[audit] not logged', e);
  }
}

export async function saveProduct(
  _prev: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  const viewer = await requireStaff();
  const id = field(formData, 'id') || null;

  const parsed = productSchema.safeParse({
    title: field(formData, 'title'),
    slug: field(formData, 'slug'),
    subtitle: field(formData, 'subtitle'),
    description: field(formData, 'description'),
    kind: field(formData, 'kind'),
    eyebrow: field(formData, 'eyebrow'),
    pullQuote: field(formData, 'pullQuote'),
    ctaLabel: field(formData, 'ctaLabel'),
    pageCount: field(formData, 'pageCount') || 0,
    idealFor: field(formData, 'idealFor'),
    coverImage: field(formData, 'coverImage'),
    status: field(formData, 'status'),
    currency: field(formData, 'currency'),
    price: field(formData, 'price'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const d = parsed.data;
  const supabase = await createClient();

  const row = {
    title: d.title,
    slug: d.slug,
    subtitle: d.subtitle || null,
    description: d.description || null,
    kind: d.kind,
    eyebrow: d.eyebrow || null,
    pull_quote: d.pullQuote || null,
    cta_label: d.ctaLabel || null,
    page_count: d.pageCount ? d.pageCount : null,
    ideal_for: d.idealFor || null,
    cover_image: d.coverImage || null,
    status: d.status,
  };

  // The owner's choices of what sits near this product: the related
  // titles, and, for a collection, what is inside it. Both lists are
  // replaced whole, so an unticked box means "no longer".
  const relatedIds = formData.getAll('related').map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));
  const childIds = formData.getAll('contents').map(String).filter((v) => /^[0-9a-f-]{36}$/i.test(v));

  let productId = id;

  if (id) {
    const { error } = await supabase.from('products').update(row).eq('id', id);
    if (error) {
      return {
        error:
          error.code === '23505'
            ? 'Another product already uses that web address.'
            : error.message,
      };
    }
  } else {
    const { data, error } = await supabase
      .from('products')
      .insert(row)
      .select('id')
      .single();
    if (error) {
      return {
        error:
          error.code === '23505'
            ? 'Another product already uses that web address.'
            : error.message,
      };
    }
    productId = data.id;
  }

  if (!productId) return { error: 'The product could not be saved.' };

  {
    const self = productId;
    await supabase.from('product_related').delete().eq('product_id', self);
    const related = relatedIds.filter((rid) => rid !== self).map((rid, i) => ({ product_id: self, related_id: rid, sort_order: i }));
    if (related.length) {
      const { error } = await supabase.from('product_related').insert(related);
      if (error) return { error: `Saved, but the related products did not: ${error.message}` };
    }
    if (d.kind === 'bundle') {
      await supabase.from('product_bundle_items').delete().eq('bundle_id', self);
      const children = childIds.filter((cid) => cid !== self).map((cid, i) => ({ bundle_id: self, child_id: cid, sort_order: i }));
      if (children.length) {
        const { error } = await supabase.from('product_bundle_items').insert(children);
        if (error) return { error: `Saved, but the collection's contents did not: ${error.message}` };
      }
    }
  }

  // Price in minor units. Rounded rather than truncated so 7.99 does not
  // silently become 798.
  const unitAmount = Math.round(d.price * 100);
  const currency = d.currency.toUpperCase();

  const { data: existingPrice } = await supabase
    .from('product_prices')
    .select('id')
    .eq('product_id', productId)
    .eq('currency', currency)
    .eq('is_default', true)
    .maybeSingle();

  if (existingPrice) {
    await supabase
      .from('product_prices')
      .update({ unit_amount: unitAmount, is_active: true })
      .eq('id', existingPrice.id);
  } else {
    await supabase.from('product_prices').insert({
      product_id: productId,
      currency,
      unit_amount: unitAmount,
      is_default: true,
      is_active: true,
    });
  }

  await audit(
    viewer.id,
    viewer.email,
    id ? 'product.update' : 'product.create',
    'product',
    productId,
    null,
    { slug: d.slug, status: d.status, unitAmount, currency },
  );

  revalidatePath('/shop');

  revalidateTag('content');
  revalidatePath(`/shop/${d.slug}`);
  revalidateTag('content');

  redirect(`/admin/products/${productId}?saved=1` as Route);
}

/** Files a customer pays for. Private bucket only. */
const MAX_UPLOAD_BYTES = 200 * 1024 * 1024;

const FORMAT_BY_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'application/epub+zip': 'epub',
  'application/zip': 'zip',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4b',
};

export async function uploadProductFile(
  _prev: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  const viewer = await requireStaff();

  const productId = field(formData, 'productId') ?? '';
  const file = fileField(formData, 'file');

  if (!productId || !file) {
    return { error: 'Choose a file to upload.' };
  }

  if (file.size > MAX_UPLOAD_BYTES) {
    return { error: 'That file is larger than 200 MB.' };
  }

  // Trust the extension over the browser-supplied MIME type, which is
  // unreliable for EPUB in particular.
  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const format =
    ['pdf', 'epub', 'zip', 'mp3', 'm4b'].includes(ext)
      ? ext
      : FORMAT_BY_MIME[file.type];

  if (!format) {
    return {
      error: `Soulfables ships PDF, EPUB, ZIP, MP3 and M4B. "${ext || file.type}" is not one of them.`,
    };
  }

  const bytes = Buffer.from(await file.arrayBuffer());

  // Proves later that the file a customer downloaded is the file we
  // shipped, and catches a botched re-upload before customers do.
  const checksum = createHash('sha256').update(bytes).digest('hex');

  const db = createAdminClient();

  // Version rather than overwrite: an existing download link keeps
  // working while the new file goes live.
  const { data: prior } = await db
    .from('product_files')
    .select('version')
    .eq('product_id', productId)
    .eq('format', format)
    .order('version', { ascending: false })
    .limit(1)
    .maybeSingle();

  const version = (prior?.version ?? 0) + 1;
  const storagePath = `${productId}/${format}/v${version}/${file.name}`;

  const { error: uploadError } = await db.storage
    .from('private-files')
    .upload(storagePath, bytes, {
      contentType: file.type || 'application/octet-stream',
      upsert: false,
    });

  if (uploadError) {
    console.error('[upload] failed', uploadError);
    return { error: `Upload failed: ${uploadError.message}` };
  }

  // Retire the previous version of this format so My Library shows one
  // link per format, not a history.
  await db
    .from('product_files')
    .update({ is_active: false })
    .eq('product_id', productId)
    .eq('format', format);

  const { error: insertError } = await db.from('product_files').insert({
    product_id: productId,
    format,
    storage_path: storagePath,
    original_name: file.name,
    file_size_bytes: bytes.byteLength,
    checksum,
    version,
    is_active: true,
  });

  if (insertError) {
    // Roll back the object so storage and the table cannot disagree.
    await db.storage.from('private-files').remove([storagePath]);
    return { error: `Could not record the file: ${insertError.message}` };
  }

  await audit(viewer.id, viewer.email, 'product_file.upload', 'product', productId, null, {
    format,
    version,
    bytes: bytes.byteLength,
    checksum,
  });

  revalidatePath(`/admin/products/${productId}`);

  revalidateTag('content');

  return {
    message: `${format.toUpperCase()} uploaded as version ${version}. Everyone who owns this product can download it now.`,
  };
}

export async function deleteProductFile(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  const fileId = field(formData, 'fileId') ?? '';
  const productId = field(formData, 'productId') ?? '';
  if (!fileId) return;

  const db = createAdminClient();
  const { data: file } = await db
    .from('product_files')
    .select('storage_path, format, version')
    .eq('id', fileId)
    .single();

  if (file) {
    await db.storage.from('private-files').remove([file.storage_path]);
    await db.from('product_files').delete().eq('id', fileId);
    await audit(viewer.id, viewer.email, 'product_file.delete', 'product', productId, file, null);
  }

  revalidatePath(`/admin/products/${productId}`);

  revalidateTag('content');
  redirect(`/admin/products/${productId}?deleted=1` as Route);
}

// ---------------------------------------------------------------------
// Previews: what may be seen before buying. PUBLIC bucket, by design.
// ---------------------------------------------------------------------

const PREVIEW_PDF_BYTES = 20 * 1024 * 1024;
const PREVIEW_IMAGE_BYTES = 8 * 1024 * 1024;
const PREVIEW_IMAGE_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function uploadProductPreview(
  _prev: ProductActionResult,
  formData: FormData,
): Promise<ProductActionResult> {
  const viewer = await requireStaff();
  const productId = field(formData, 'productId') ?? '';
  const title = (field(formData, 'title') ?? '').trim().slice(0, 120);
  const file = fileField(formData, 'file');
  if (!productId || !file) return { error: 'Choose a file to upload.' };

  const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
  const isPdf = ext === 'pdf' || file.type === 'application/pdf';
  const imageExt = PREVIEW_IMAGE_TYPES[file.type] ?? (['png', 'jpg', 'jpeg', 'webp'].includes(ext) ? ext : null);
  if (!isPdf && !imageExt) return { error: 'A preview is a PDF, or a PNG, JPEG or WebP image.' };
  if (isPdf && file.size > PREVIEW_PDF_BYTES) return { error: 'That PDF is larger than 20 MB. A sample should be a chapter, not the book.' };
  if (!isPdf && file.size > PREVIEW_IMAGE_BYTES) return { error: 'That image is larger than 8 MB.' };

  const bytes = Buffer.from(await file.arrayBuffer());
  const db = createAdminClient();
  const safeName = file.name.replace(/[^A-Za-z0-9._-]+/g, '-').slice(0, 80);
  const storagePath = `previews/${productId}/${Date.now()}-${safeName}`;
  const { error: uploadError } = await db.storage
    .from('public-media')
    .upload(storagePath, bytes, { contentType: file.type || (isPdf ? 'application/pdf' : 'application/octet-stream'), upsert: false });
  if (uploadError) return { error: `Upload failed: ${uploadError.message}` };

  const { data: pub } = db.storage.from('public-media').getPublicUrl(storagePath);
  const { data: last } = await db.from('product_previews').select('sort_order').eq('product_id', productId).order('sort_order', { ascending: false }).limit(1).maybeSingle();
  const { error: insertError } = await db.from('product_previews').insert({
    product_id: productId,
    kind: isPdf ? 'pdf' : 'image',
    title: title || null,
    storage_path: storagePath,
    public_url: pub.publicUrl,
    file_size_bytes: bytes.byteLength,
    sort_order: (last?.sort_order ?? -1) + 1,
  });
  if (insertError) {
    await db.storage.from('public-media').remove([storagePath]);
    return { error: `Could not record the preview: ${insertError.message}` };
  }

  await audit(viewer.id, viewer.email, 'product_preview.upload', 'product', productId, null, { kind: isPdf ? 'pdf' : 'image', bytes: bytes.byteLength });
  revalidatePath(`/admin/products/${productId}`);
  revalidateTag('content');
  return { message: isPdf ? 'Sample added. Visitors can read it from the product page.' : 'Image added to the preview.' };
}

export async function deleteProductPreview(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  const previewId = field(formData, 'previewId') ?? '';
  const productId = field(formData, 'productId') ?? '';
  if (!previewId) return;
  const db = createAdminClient();
  const { data: row } = await db.from('product_previews').select('storage_path').eq('id', previewId).single();
  if (row) {
    await db.storage.from('public-media').remove([row.storage_path]);
    await db.from('product_previews').delete().eq('id', previewId);
    await audit(viewer.id, viewer.email, 'product_preview.delete', 'product', productId, row, null);
  }
  revalidatePath(`/admin/products/${productId}`);
  revalidateTag('content');
  redirect(`/admin/products/${productId}?deleted=1` as Route);
}
