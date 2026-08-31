'use server';

import { revalidatePath, revalidateTag } from 'next/cache';
import { headers } from 'next/headers';
import { z } from 'zod';
import { checkbox, field } from '@/lib/form';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireStaff } from '@/lib/auth';
import { sendDeliveryEmail } from '@/lib/email';

/**
 * Granting access by hand.
 *
 * This is how customers who bought before this platform existed get their
 * books — the clean-start decision (D2) says nothing is imported, so the
 * House hands out access deliberately, one person at a time, with a
 * record of who did it and why.
 *
 * Every grant here is `source = 'manual'` and carries `granted_by` and a
 * note. That distinction matters: a manual grant is a judgement someone
 * made, and six months from now the audit trail should say whose.
 *
 * Note there is still no path by which a client writes to `entitlements`.
 * This runs server-side under the service role, behind requireStaff().
 */

export type GrantResult = { error?: string; message?: string };

const grantSchema = z.object({
  email: z.string().trim().toLowerCase().email('That does not look like an email address.'),
  productId: z.string().uuid('Choose a product.'),
  note: z.string().trim().max(500).optional().or(z.literal('')),
  notify: z.boolean().default(false),
});

export async function grantEntitlement(
  _prev: GrantResult,
  formData: FormData,
): Promise<GrantResult> {
  const viewer = await requireStaff();

  const parsed = grantSchema.safeParse({
    email: field(formData, 'email'),
    productId: field(formData, 'productId'),
    note: field(formData, 'note'),
    notify: checkbox(formData, 'notify'),
  });

  if (!parsed.success) return { error: parsed.error.issues[0].message };

  const { email, productId, note } = parsed.data;
  const notify = parsed.data.notify;
  const db = createAdminClient();

  const { data: product } = await db
    .from('products')
    .select('id, title')
    .eq('id', productId)
    .single();

  if (!product) return { error: 'That product no longer exists.' };

  // Find the account. listUsers is paginated, so filter server-side.
  const { data: userList, error: listError } = await db.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listError) {
    console.error('[grant] listUsers failed', listError);
    return { error: 'Could not look up that account.' };
  }

  const user = userList.users.find(
    (u) => u.email?.toLowerCase() === email,
  );

  if (!user) {
    return {
      error: `No Soulfables account uses ${email}. Ask them to create one with that exact address first — then grant it, and it will be waiting for them.`,
    };
  }

  const { data: alreadyOwns } = await db.rpc('has_entitlement', {
    p_user: user.id,
    p_product: productId,
  });

  if (alreadyOwns) {
    return { error: `${email} already has access to “${product.title}”.` };
  }

  const { error: insertError } = await db.from('entitlements').insert({
    user_id: user.id,
    product_id: productId,
    source: 'manual',
    granted_by: viewer.id,
    notes: note || `Granted by ${viewer.email ?? viewer.id}`,
  });

  if (insertError) {
    console.error('[grant] insert failed', insertError);
    return { error: `Could not grant access: ${insertError.message}` };
  }

  const h = await headers();

  if (notify) {
    await sendDeliveryEmail({
      to: email,
      orderReference: 'added by Soulfables',
      orderId: productId,
      isGuest: false,
    });
  }

  revalidatePath('/admin/entitlements');

  return {
    message: `“${product.title}” is now in ${email}'s library.${
      notify ? ' They have been emailed.' : ''
    }`,
  };
}

export async function revokeEntitlement(formData: FormData): Promise<void> {
  const viewer = await requireStaff();
  const id = field(formData, 'entitlementId') ?? '';
  const reason = field(formData, 'reason') || 'revoked_by_staff';
  if (!id) return;

  const db = createAdminClient();

  const { data: before } = await db
    .from('entitlements')
    .select('user_id, product_id, source')
    .eq('id', id)
    .single();

  await db
    .from('entitlements')
    .update({ revoked_at: new Date().toISOString(), revoked_reason: reason })
    .eq('id', id);


  revalidatePath('/admin/entitlements');
}
