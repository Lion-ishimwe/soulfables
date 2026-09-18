'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { saveCard, type CardResult } from '@/app/actions/questions';
import { Field, TextArea } from '@/components/admin/ui';
import type { AdminCard } from '@/lib/questions';

function Save({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
    >
      {pending ? 'Saving…' : editing ? 'Save the card' : 'Add it to the drawer'}
    </button>
  );
}

/**
 * One card, written or rewritten.
 *
 * The same form serves both: with a card it edits, without one it adds.
 * The parent keys it by the card's id so switching from one card to
 * another resets every field rather than leaving the last card's words
 * in the boxes.
 */
export function QuestionForm({ card, readOnly }: { card: AdminCard | null; readOnly: boolean }) {
  const [state, formAction] = useActionState<CardResult, FormData>(saveCard, {});

  return (
    <form action={formAction} className="border border-rule p-6">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-3">
        <p className="sf-eyebrow">{card ? `Editing “${card.title}”` : 'A new card'}</p>
        {card && (
          <Link
            href={'/admin/settings/questions' as Route}
            className="font-ui text-xs text-grey-muted transition-colors hover:text-ivory"
          >
            Cancel
          </Link>
        )}
      </div>

      {state.error && (
        <p role="alert" className="mb-5 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          {state.error}
        </p>
      )}

      {card && <input type="hidden" name="id" value={card.id} />}

      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field
          label="Name"
          name="title"
          required
          defaultValue={card?.title}
          placeholder="The Empty Room"
          hint="What the card is called. Readers see it in gold above the question."
        />
        <Field
          label="Feeling"
          name="feeling"
          required
          defaultValue={card?.feeling}
          placeholder="Grief"
          hint="The one word under the name. A feeling, not a shelf — though it may match one."
        />
      </div>

      <TextArea
        label="Whisper"
        name="whisper"
        rows={2}
        defaultValue={card?.whisper}
        placeholder="Some rooms never stop remembering."
        hint="One line said before the question. Optional; the card stands without it."
      />

      <TextArea
        label="The question"
        name="body"
        rows={3}
        defaultValue={card?.body}
        placeholder="What lived in the room with you, long after they were gone?"
        hint="Signed by the Librarian. Ask one thing, and leave it open."
      />

      <div className="grid gap-x-6 sm:grid-cols-2">
        <Field
          label="Mark"
          name="glyph"
          defaultValue={card?.glyph}
          placeholder="Leave empty for the House’s star"
          hint="A single character, if you want one. Empty shows the star."
        />
        <Field
          label="Order"
          name="sortOrder"
          type="number"
          defaultValue={card?.sortOrder ?? 0}
          hint="Only the order of this list. The drawer shuffles."
        />
      </div>

      <div className="mt-2 flex items-center gap-4">
        {readOnly ? (
          <p className="font-ui text-xs text-grey-muted">The demo keeps its cards as they are.</p>
        ) : (
          <Save editing={Boolean(card)} />
        )}
      </div>
    </form>
  );
}
