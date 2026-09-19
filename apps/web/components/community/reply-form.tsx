'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { submitReply, type CommunityResult } from '@/app/actions/community';

function Send() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Sending…' : 'Reply'}
    </button>
  );
}

/** A supportive word under a post. Read by the House first, unless the reader is trusted. */
export function ReplyForm({ postId }: { postId: string }) {
  const [state, formAction] = useActionState<CommunityResult, FormData>(submitReply, {});
  return (
    <form action={formAction} className="mt-6">
      <input type="hidden" name="postId" value={postId} />
      <label htmlFor="r-body" className="sr-only">
        Your reply
      </label>
      <textarea
        id="r-body"
        name="body"
        required
        minLength={2}
        maxLength={1500}
        rows={3}
        placeholder="A few kind lines. Not advice; company."
        className="w-full border border-rule bg-ink-raised/60 px-4 py-3 font-display text-base italic text-ivory outline-none transition-colors placeholder:text-grey-muted focus:border-gold/50"
      />
      {state.error && (
        <p role="alert" className="mt-3 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 font-ui text-sm text-ivory">
          {state.error}
        </p>
      )}
      {state.message && (
        <p aria-live="polite" className="mt-3 border-l-2 border-gold bg-gold-dim px-4 py-3 font-ui text-sm text-ivory">
          {state.message}
        </p>
      )}
      <div className="mt-3 flex items-center justify-between gap-4">
        <p className="font-ui text-xs text-grey-faint">Replies are read by the House before they appear.</p>
        <Send />
      </div>
    </form>
  );
}
