'use client';

import { useState, useTransition } from 'react';
import Image from 'next/image';
import { uploadImage } from '@/app/actions/media';
import { saveBackdrop, clearBackdrop } from '@/app/actions/editorial';

/**
 * The picture behind the front door.
 *
 * The home page draws its own backdrop in SVG, which is why it has never
 * needed a file — and why it has never been changeable without a deploy.
 * This puts one image in front of it.
 *
 * Upload or paste, because both are real: a photograph comes off a
 * machine, and an image already on a CDN has an address. The upload path
 * writes to the public bucket, which is correct here — a backdrop is the
 * first thing an anonymous visitor sees — and wrong for anything a reader
 * has paid for.
 */
export function BackdropForm({ current }: { current: string | null }) {
  const [url, setUrl] = useState(current ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();
  const [uploading, setUploading] = useState(false);

  async function onFile(file: File) {
    setError(null);
    setUploading(true);
    const body = new FormData();
    body.set('file', file);
    body.set('folder', 'backdrops');
    const result = await uploadImage(body);
    setUploading(false);
    if (result.error) setError(result.error);
    else if (result.url) setUrl(result.url);
  }

  return (
    <section className="rounded-lg border border-rule bg-ink-raised">
      <header className="border-b border-rule px-5 py-4">
        <h2 className="font-ui text-sm text-ivory">Front door backdrop</h2>
        <p className="mt-0.5 font-ui text-micro text-grey-faint">
          The image behind the first thing anybody sees. Leave it empty and the
          House draws its own.
        </p>
      </header>

      <div className="p-5">
        {error && (
          <p
            role="alert"
            className="mb-4 rounded border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory"
          >
            {error}
          </p>
        )}

        <div className="grid gap-5 lg:grid-cols-[16rem_1fr]">
          {/*
            Shown at the shape it will actually be used at, so a portrait
            photograph that will be cropped to a letterbox looks wrong here
            rather than looking wrong on the front page.
          */}
          <div className="relative aspect-[16/9] overflow-hidden rounded border border-rule bg-ink">
            {url ? (
              <Image src={url} alt="" fill sizes="16rem" className="object-cover" unoptimized />
            ) : (
              <span className="absolute inset-0 flex items-center justify-center text-center font-ui text-xs text-grey-faint">
                The drawn backdrop
              </span>
            )}
          </div>

          <div className="min-w-0">
            <label htmlFor="bd-file" className="mb-2 block font-ui text-sm text-ivory">
              Upload an image
            </label>
            <input
              id="bd-file"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/avif"
              disabled={uploading || busy}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
              className="w-full cursor-pointer rounded border border-rule bg-ink px-3 py-2.5 font-ui text-xs text-grey file:mr-3 file:rounded file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:font-ui file:text-xs file:text-gold"
            />
            <p className="mt-2 font-ui text-xs text-grey-muted">
              JPEG, PNG, WebP or AVIF, up to 8MB. Wide images work best.
              {uploading && <span className="ml-2 text-gold">Uploading…</span>}
            </p>

            <label htmlFor="bd-url" className="mb-2 mt-5 block font-ui text-sm text-ivory">
              Or paste an address
            </label>
            <input
              id="bd-url"
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded border border-rule bg-ink px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
            />

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={busy || uploading || !url}
                onClick={() =>
                  startTransition(async () => {
                    setError(null);
                    const r = await saveBackdrop(url);
                    if (r?.error) setError(r.error);
                  })
                }
                className="rounded bg-gold px-5 py-2.5 font-ui text-sm text-ink transition-opacity hover:opacity-90 disabled:opacity-50"
              >
                {busy ? 'Saving…' : 'Use this backdrop'}
              </button>

              {current && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    startTransition(async () => {
                      await clearBackdrop();
                      setUrl('');
                    })
                  }
                  className="rounded border border-rule px-5 py-2.5 font-ui text-sm text-grey transition-colors hover:text-ivory"
                >
                  Go back to the drawn one
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
