import type { Metadata } from 'next';
import { PageHeader, EmptyState } from '@/components/admin/ui';

export const metadata: Metadata = { title: 'Authors' };

/* Scaffolded in Phase 1. Built out in the phase noted below. */
export default function Page() {
  return (
    <>
      <PageHeader title="Authors" />
      <EmptyState
        title="Not built yet."
        body="This section is scaffolded so the navigation is honest about what exists. It is filled in during a later phase — see the architecture document for which."
        action={{ href: '/admin', label: 'Back to overview' }}
      />
    </>
  );
}
