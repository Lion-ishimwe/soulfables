'use client';

import { useState } from 'react';
import { uploadImage } from '@/app/actions/media';
import { Cover } from '@/components/cover-art';

/** Eight megabytes, the same as uploadImage. */
const MAX_BYTES = 8 * 1024 * 1024;

/**
 * A story's cover, uploaded or pasted.
 *
 * Both, because both are real: a designed cover arrives as a file, and a
 * cover already on a CDN arrives as an address. Until now the admin had
 * only the second and authors had neither — the field did not exist in
 * the writing room at all, and the save path set it to null.
 *
 * The preview is the actual <Cover>, at the actual aspect ratio, which
 * matters more here than anywhere else on the surface: leave it empty and
 * the House draws a cover from the title and the shelf, so "no image" is
 * a real choice with a real result rather than a hole. Somebody should be
 * able to see what they are choosing between.
 */
export function CoverField({
  name = 'coverImage',
  defaultValue,
  title,
  author,
  shelf,
}: {
  name?: string;
  defaultValue?: string | null;
  title: string;
  author?: string;
  shelf?: string;
}) {
  const [url, setUrl] = useState(defaultValue ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File) {
    setError(null);

    /*
     * The same ceiling the action enforces, checked here first: a file
     * that is going to be refused should be refused before it travels,
     * with the reason on screen rather than in a server log.
     */
    if (file.size > MAX_BYTES) {
      setError(
        `That image is ${(file.size / 1024 / 1024).toFixed(1)} MB. The limit is ${MAX_BYTES / 1024 / 1024} MB — an image that heavy makes the page slow to open.`,
      );
      return;
    }

    setBusy(true);
    try {
      const body = new FormData();
      body.set('file', file);
      body.set('folder', 'covers');
      const result = await uploadImage(body);
      if (result.error) setError(result.error);
      else if (result.url) setUrl(result.url);
    } catch {
      /*
       * A thrown action — a body the server refused, a dropped
       * connection — used to leave "Uploading…" on screen for good,
       * because nothing ever cleared it. Now it says what it can.
       */
      setError('The upload did not get through. Try a smaller image, or check the connection.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <span className="sf-eyebrow mb-2 block">Cover</span>

      {/* The value the form posts, however it was arrived at. */}
      <input type="hidden" name={name} value={url} />

      {error && (
        <p
          role="alert"
          className="mb-3 rounded border-l-2 border-state-danger bg-state-danger/10 px-3 py-2 font-ui text-xs text-ivory"
        >
          {error}
        </p>
      )}

      <div className="flex gap-4">
        <span className="block aspect-[2/3] w-24 shrink-0 overflow-hidden rounded shadow-cover">
          <Cover
            src={url || null}
            title={title || 'Untitled'}
            author={author ?? ''}
            shelf={shelf ?? ''}
            sizes="6rem"
          />
        </span>

        <div className="min-w-0 flex-1">
          <input
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif"
            disabled={busy}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
              // So choosing the same file again after a failure counts
              // as a change, and fires again.
              e.target.value = '';
            }}
            className="w-full cursor-pointer rounded border border-rule bg-ink px-3 py-2 font-ui text-xs text-grey file:mr-3 file:rounded file:border-0 file:bg-gold/15 file:px-3 file:py-1.5 file:font-ui file:text-xs file:text-gold"
          />

          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="…or paste an address"
            className="mt-2 w-full rounded border border-rule bg-ink px-3 py-2 font-ui text-xs text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
          />

          <p className="mt-2 font-ui text-xs text-grey-muted">
            {busy
              ? 'Uploading…'
              : url
                ? 'Leave it empty and the House draws one from the title.'
                : 'Optional — the House is drawing this one.'}
          </p>

          {url && (
            <button
              type="button"
              onClick={() => setUrl('')}
              className="mt-1 font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
            >
              Use the drawn cover instead
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
