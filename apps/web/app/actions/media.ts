'use server';

import { randomUUID } from 'node:crypto';
import { requireStaff } from '@/lib/auth';
import { isDemoMode } from '@/lib/demo/mode';
import { createAdminClient } from '@/lib/supabase/admin';

export type UploadResult = { url?: string; error?: string };

/** Pictures only, and only ones a browser will actually render. */
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/avif']);
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * Put a picture in the public bucket and hand back its address.
 *
 * The service role is needed to write to storage, which is why this lives
 * behind requireStaff() and checks the file itself rather than trusting
 * the form. A content type is asserted by the browser, so it is checked
 * against a list here as well — an upload endpoint that accepts whatever
 * it is handed is a file host for somebody else.
 *
 * public-media is public by design: a backdrop is on the front page. Do
 * not use this for anything a reader has paid for; that is what
 * protected-media and signed URLs are for.
 */
export async function uploadImage(formData: FormData): Promise<UploadResult> {
  await requireStaff();

  if (isDemoMode()) {
    return { error: 'Demo mode has nowhere to put a file. Connect a database first.' };
  }

  const file = formData.get('file');
  if (!(file instanceof File) || file.size === 0) {
    return { error: 'Choose an image first.' };
  }

  if (!ALLOWED.has(file.type)) {
    return { error: 'Images only — JPEG, PNG, WebP or AVIF.' };
  }

  if (file.size > MAX_BYTES) {
    return {
      error: `That is ${(file.size / 1024 / 1024).toFixed(1)}MB. Eight is the limit — a backdrop that heavy makes the front page slow.`,
    };
  }

  const extension = file.name.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  // A random name, not the original: two people uploading "hero.jpg"
  // should not overwrite each other, and a filename is user input.
  const path = `backdrops/${randomUUID()}.${extension}`;

  const admin = createAdminClient();
  const { error } = await admin.storage
    .from('public-media')
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) return { error: error.message };

  const { data } = admin.storage.from('public-media').getPublicUrl(path);
  return { url: data.publicUrl };
}
