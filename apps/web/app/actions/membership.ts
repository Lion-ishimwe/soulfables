'use server';

import { revalidatePath } from 'next/cache';
import { setPlanForDemo, type Plan } from '@/lib/membership';
import { isDemoMode } from '@/lib/demo/mode';
import { requireViewer } from '@/lib/auth';

export type PlanResult = { error?: string; message?: string };

/**
 * Change tier.
 *
 * Only ever reachable in demo mode. In live mode a subscription begins
 * with a payment and is written back by the provider's webhook — there is
 * no client-side path that grants access, for the same reason there is
 * none for entitlements.
 */
export async function changePlan(
  _prev: PlanResult,
  formData: FormData,
): Promise<PlanResult> {
  await requireViewer('/membership');

  if (!isDemoMode()) {
    return {
      error:
        'Residency begins with a payment. Checkout is the next milestone.',
    };
  }

  const target = String(formData.get('plan') ?? '') as Plan;
  if (target !== 'free' && target !== 'resident') {
    return { error: 'Unknown tier.' };
  }

  await setPlanForDemo(target);

  revalidatePath('/membership');
  revalidatePath('/', 'layout');

  return {
    message:
      target === 'resident'
        ? 'You are a Resident. The premium shelves and the narrated editions are open.'
        : 'Back to Reader. Everything you own is still yours.',
  };
}
