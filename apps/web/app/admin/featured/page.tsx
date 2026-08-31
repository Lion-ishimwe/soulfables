import { permanentRedirect } from 'next/navigation';

/**
 * Featured moved under Settings.
 *
 * A redirect rather than a deletion: this URL has been in the navigation
 * for weeks, it is in browser histories and probably in somebody's
 * bookmarks, and a 404 would tell them the feature was removed rather
 * than moved.
 */
export default function FeaturedMoved(): never {
  permanentRedirect('/admin/settings/featured');
}
