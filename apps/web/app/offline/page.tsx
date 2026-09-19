import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Offline', robots: { index: false, follow: false } };

/** What the service worker shows when there is no network and nothing kept for this address. */
export default function OfflinePage() {
  return (
    <section className="mx-auto max-w-content px-5 py-32 text-center sm:px-8 sm:py-44">
      <p className="text-gold" aria-hidden="true">✦</p>
      <p className="sf-eyebrow mt-6">The House</p>
      <h1 className="mt-5 font-display text-4xl font-light leading-tight text-ivory sm:text-5xl">You are offline.</h1>
      <p className="mx-auto mt-6 max-w-measure text-base leading-normal text-grey-muted">
        This page was not kept. Stories you chose to keep offline are still here; open one from
        your library once the network is back, or wait — the lamp is on.
      </p>
    </section>
  );
}
