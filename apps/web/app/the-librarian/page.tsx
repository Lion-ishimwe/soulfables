import { permanentRedirect } from 'next/navigation';

/** The Librarian lives at /companion. This address is kept so old links still arrive. */
export default function Page() {
  permanentRedirect('/companion');
}
