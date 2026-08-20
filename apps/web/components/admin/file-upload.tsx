'use client';

import { useActionState, useRef } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadProductFile, deleteProductFile, type ProductActionResult } from '@/app/actions/products';
import { formatBytes } from '@/lib/format';

export type ProductFileRow = {
  id: string;
  format: string;
  originalName: string | null;
  sizeBytes: number | null;
  version: number;
  checksum: string | null;
  createdAt: string;
};

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Uploading…' : 'Upload'}
    </button>
  );
}

/**
 * Upload the thing the customer actually pays for.
 *
 * Files go into the private bucket and are never given a public URL.
 * Uploading a format that already exists creates a new version and
 * retires the old one, so an in-flight download keeps working while the
 * replacement goes live.
 */
export function FileUpload({
  productId,
  files,
}: {
  productId: string;
  files: ProductFileRow[];
}) {
  const [state, formAction] = useActionState<ProductActionResult, FormData>(
    uploadProductFile,
    {},
  );
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <section>
      <h2 className="sf-eyebrow mb-4">Files</h2>

      {state.error && (
        <p
          role="alert"
          className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory"
        >
          {state.error}
        </p>
      )}
      {state.message && (
        <p
          aria-live="polite"
          className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory"
        >
          {state.message}
        </p>
      )}

      {files.length === 0 ? (
        <p className="mb-5 border border-state-danger/40 bg-state-danger/10 px-5 py-4 text-sm text-grey">
          Nothing to deliver yet. A customer who buys this product would
          receive an empty library entry.
        </p>
      ) : (
        <ul className="mb-5 divide-y divide-rule border border-rule">
          {files.map((f) => (
            <li
              key={f.id}
              className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5"
            >
              <span className="min-w-0">
                <span className="flex items-center gap-3">
                  <span className="border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold">
                    {f.format}
                  </span>
                  <span className="truncate text-sm text-ivory">
                    {f.originalName ?? 'file'}
                  </span>
                </span>
                <span className="mt-1 block text-xs text-grey-muted">
                  v{f.version} · {formatBytes(f.sizeBytes)}
                  {f.checksum && (
                    <>
                      {' '}
                      · sha256 <code className="text-grey">{f.checksum.slice(0, 12)}</code>
                    </>
                  )}
                </span>
              </span>

              <form action={deleteProductFile}>
                <input type="hidden" name="fileId" value={f.id} />
                <input type="hidden" name="productId" value={productId} />
                <button
                  type="submit"
                  className="font-ui text-xs text-grey-muted transition-colors hover:text-state-danger"
                >
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="border border-rule p-5">
        <input type="hidden" name="productId" value={productId} />
        <label htmlFor="file" className="sf-eyebrow mb-2 block">
          Add a file
        </label>
        <div className="flex flex-wrap items-center gap-4">
          <input
            ref={inputRef}
            id="file"
            name="file"
            type="file"
            required
            accept=".pdf,.epub,.zip,.mp3,.m4b"
            className="flex-1 text-sm text-grey file:mr-4 file:border file:border-rule file:bg-ink-raised file:px-4 file:py-2 file:font-ui file:text-xs file:uppercase file:tracking-[0.14em] file:text-grey hover:file:text-ivory"
          />
          <UploadButton />
        </div>
        <p className="mt-3 text-xs text-grey-muted">
          PDF, EPUB, ZIP, MP3 or M4B, up to 200 MB. Uploading a format that
          already exists creates a new version and retires the old one.
        </p>
      </form>
    </section>
  );
}
