'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/components/report-client-error';

/*
 * The last net: an error in the root layout itself, where no styles,
 * fonts or components can be trusted to load. Plain markup, the House's
 * colours written by hand, and one button.
 */
export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  useEffect(() => {
    reportClientError(error, false);
  }, [error]);

  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: '100vh', background: '#0f0e0c', color: '#d9d2c5', fontFamily: 'Georgia, serif', display: 'grid', placeItems: 'center', textAlign: 'center', padding: '0 16px' }}>
        <div>
          <p style={{ color: '#c9a961', margin: 0 }}>✦</p>
          <h1 style={{ fontWeight: 300, fontSize: '2rem', margin: '1.5rem 0 1rem', color: '#f3ede2' }}>
            The House could not open this page.
          </h1>
          <p style={{ maxWidth: '36rem', margin: '0 auto', lineHeight: 1.6 }}>
            A note has been made. Reloading usually mends it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: '2rem', background: 'transparent', color: '#c9a961', border: '1px solid rgba(201,169,97,.5)', padding: '10px 20px', fontSize: '12px', letterSpacing: '.18em', textTransform: 'uppercase', cursor: 'pointer' }}
          >
            Reload
          </button>
        </div>
      </body>
    </html>
  );
}
