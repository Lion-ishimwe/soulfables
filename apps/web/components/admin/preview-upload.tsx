'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { uploadProductPreview, deleteProductPreview, type ProductActionResult } from '@/app/actions/products';
import { formatBytes } from '@/lib/format';

export type ProductPreviewRow = {
  id: string;
  kind: 'pdf' | 'image';
  title: string | null;
  publicUrl: string;
  sizeBytes: number | null;
};

function UploadButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Uploading…' : 'Add preview'}
    </button>
  );
}

/**
 * What a visitor may see before buying: a sample chapter as a PDF, or
 * pictures of pages. These go to the PUBLIC bucket by design, which is
 * exactly why the paid files never pass through here.
 */
export function PreviewUpload({ productId, previews }: { productId: string; previews: ProductPreviewRow[] }) {
  const [state, formAction] = useActionState<ProductActionResult, FormData>(uploadProductPreview, {});

  return (
    <section>
      <h2 className="sf-eyebrow mb-4">Previews</h2>
      <p className="mb-5 text-sm text-grey-muted">
        A free sample or a few page images, shown on the product page before purchase. Never upload the full book here: previews are public.
      </p>

      {state.error && (
        <p role="alert" className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          {state.error}
        </p>
      )}
      {state.message && (
        <p aria-live="polite" className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          {state.message}
        </p>
      )}

      {previews.length > 0 && (
        <ul className="mb-5 divide-y divide-rule border border-rule">
          {previews.map((p) => (
            <li key={p.id} className="flex flex-wrap items-center justify-between gap-4 px-5 py-3.5">
              <span className="min-w-0">
                <span className="flex items-center gap-3">
                  <span className="border border-gold/45 px-2 py-0.5 font-ui text-micro uppercase tracking-[0.12em] text-gold">
                    {p.kind === 'pdf' ? 'Sample PDF' : 'Image'}
                  </span>
                  <a href={p.publicUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-ivory hover:text-gold">
                    {p.title || (p.kind === 'pdf' ? 'Read a free sample' : 'Page image')}
                  </a>
                </span>
                <span className="mt-1 block text-xs text-grey-muted">{formatBytes(p.sizeBytes)}</span>
              </span>
              <form action={deleteProductPreview}>
                <input type="hidden" name="previewId" value={p.id} />
                <input type="hidden" name="productId" value={productId} />
                <button type="submit" className="font-ui text-xs text-grey-muted transition-colors hover:text-state-danger">
                  Remove
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <form action={formAction} className="border border-rule p-5">
        <input type="hidden" name="productId" value={productId} />
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div>
            <label htmlFor="preview-file" className="sf-eyebrow mb-2 block">
              File
            </label>
            <input
              id="preview-file"
              name="file"
              type="file"
              required
              accept=".pdf,image/png,image/jpeg,image/webp"
              className="w-full text-sm text-grey file:mr-4 file:border file:border-rule file:bg-ink-raised file:px-4 file:py-2 file:font-ui file:text-xs file:uppercase file:tracking-[0.14em] file:text-grey hover:file:text-ivory"
            />
          </div>
          <div>
            <label htmlFor="preview-title" className="sf-eyebrow mb-2 block">
              Label
            </label>
            <input
              id="preview-title"
              name="title"
              type="text"
              placeholder="Chapter One"
              className="w-full border border-rule bg-ink-raised px-3 py-2 text-sm text-ivory outline-none focus:border-gold/50"
            />
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-4">
          <p className="text-xs text-grey-muted">A PDF up to 20 MB, or a PNG, JPEG or WebP up to 8 MB.</p>
          <UploadButton />
        </div>
      </form>
    </section>
  );
}
