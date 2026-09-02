import { permanentRedirect } from 'next/navigation';

/**
 * Moved into Settings.
 *
 * A redirect rather than a deletion: these were in the navigation for
 * weeks and are in browser histories. Analytics and Readers became one
 * Report, because they were answering halves of the same question.
 */
export default function Moved(): never {
  permanentRedirect('/admin/settings/report');
}
