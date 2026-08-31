import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';
import { myAuthor } from '@/lib/author-accounts';
import { createClient } from '@/lib/supabase/server';
import { isDemoMode } from '@/lib/demo/mode';
import { AdminPageHeader } from '@/components/admin/dashboard';
import { SettingsTabs } from '@/components/admin/settings-tabs';
import { AccountForm } from '@/components/account/account-form';

export const metadata: Metadata = { title: 'Account' };
export const dynamic = 'force-dynamic';

/**
 * Your own account, from inside the admin.
 *
 * Staff only, because /admin is staff only — middleware never lets an
 * author this far. Authors get the same form in the Writing Room and
 * readers get it on /account/settings; one component, three doors, each
 * behind the guard that suits who comes through it.
 */
export default async function AccountSettingsPage() {
  const viewer = await requireStaff();
  const author = await myAuthor();

  /*
   * A non-author's biography lives on their profile, which only they and
   * staff can read. An author's is public and lives on the author record.
   * Read whichever applies rather than showing an empty box.
   */
  let profileBio: string | null = null;
  if (!author && !isDemoMode()) {
    const supabase = await createClient();
    const { data } = await supabase
      .from('profiles')
      .select('bio')
      .eq('id', viewer.id)
      .maybeSingle();
    profileBio = (data?.bio as string) ?? null;
  }

  return (
    <>
      <AdminPageHeader
        title="Settings"
        subtitle="What the House says about itself, and what it is connected to."
      />
      <SettingsTabs />

      <AccountForm
        displayName={viewer.displayName ?? ''}
        bio={author ? author.bio : profileBio}
        email={viewer.email}
        isAuthor={Boolean(author)}
        authorSlug={author?.slug ?? null}
      />
    </>
  );
}
