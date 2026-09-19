'use client';

import { useState } from 'react';
import { reportContent } from '@/app/actions/community';

/** Tell the House about something on the wall. Two clicks, one reason. */
export function ReportButton({ targetType, targetId, postId }: { targetType: 'post' | 'reply'; targetId: string; postId: string }) {
  const [open, setOpen] = useState(false);
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="font-ui text-xs text-grey-faint transition-colors hover:text-ivory">
        Report
      </button>
    );
  }
  return (
    <form action={reportContent} className="mt-2 flex flex-wrap items-center gap-2 border border-rule bg-ink-raised/60 px-3 py-2">
      <input type="hidden" name="targetType" value={targetType} />
      <input type="hidden" name="targetId" value={targetId} />
      <input type="hidden" name="postId" value={postId} />
      <select name="reason" className="border border-rule bg-ink px-2 py-1 font-ui text-xs text-ivory">
        <option value="unkind">Unkind</option>
        <option value="unsafe">Someone may be in danger</option>
        <option value="spam">Spam or selling</option>
        <option value="other">Something else</option>
      </select>
      <input name="note" maxLength={500} placeholder="A word about why, if it helps" className="min-w-0 flex-1 border border-rule bg-ink px-2 py-1 font-ui text-xs text-ivory" />
      <button type="submit" className="font-ui text-xs uppercase tracking-[0.14em] text-gold hover:text-gold-soft">
        Send
      </button>
      <button type="button" onClick={() => setOpen(false)} className="font-ui text-xs text-grey-muted hover:text-ivory">
        Cancel
      </button>
    </form>
  );
}
