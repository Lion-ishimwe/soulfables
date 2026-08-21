'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import type { CompanionMessage } from '@/lib/ai/companion';

/**
 * Talking to the Librarian.
 *
 * Two things this does that a generic chat UI does not:
 *
 *   - A safety-flagged reply is rendered differently and is not followed
 *     by a cheerful prompt to keep chatting. When the companion has said
 *     "please talk to a person", the interface should not immediately
 *     invite more conversation with itself.
 *   - Story suggestions render as real links into the library, because a
 *     recommendation you cannot click is a recommendation you have to
 *     retype.
 */

const OPENERS = [
  'I cannot sleep',
  'Recommend me something',
  'Give me a reflection prompt',
] as const;

export function CompanionChat({ signedIn }: { signedIn: boolean }) {
  const [messages, setMessages] = useState<CompanionMessage[]>([
    {
      role: 'assistant',
      content:
        'Tell me how the evening is going, and I will find you something.\n\nYou can say a feeling — heartbroken, sleepless, hopeful — or describe it however it actually is. I will listen for the shelf.',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [messages, thinking]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    const next: CompanionMessage[] = [...messages, { role: 'user', content: trimmed }];
    setMessages(next);
    setInput('');
    setThinking(true);

    try {
      const res = await fetch('/api/companion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map(({ role, content }) => ({ role, content })),
        }),
      });

      if (!res.ok) throw new Error(String(res.status));
      setMessages([...next, (await res.json()) as CompanionMessage]);
    } catch {
      setMessages([
        ...next,
        {
          role: 'assistant',
          content:
            'Something went wrong reaching me just then. Try again in a moment.',
        },
      ]);
    } finally {
      setThinking(false);
    }
  }

  if (!signedIn) {
    return (
      <div className="border border-rule p-10 text-center">
        <p className="font-display text-2xl text-ivory">
          The Librarian keeps counsel with residents.
        </p>
        <p className="mx-auto mt-3 max-w-measure text-sm leading-normal text-grey-muted">
          Sign in and tell them how the evening is going.
        </p>
        <Link
          href="/signin?next=/companion"
          className="mt-6 inline-block border border-gold/50 px-8 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink"
        >
          Sign in
        </Link>
      </div>
    );
  }

  const lastWasCrisis = messages[messages.length - 1]?.safety === 'crisis';

  return (
    <div className="border border-rule">
      <div className="max-h-[28rem] space-y-6 overflow-y-auto p-6 sm:p-8">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'text-right' : ''}>
            {m.role === 'assistant' && (
              <p className="sf-eyebrow mb-2">
                {m.safety === 'crisis' ? 'Please read this' : 'The Librarian'}
              </p>
            )}

            <div
              className={
                m.role === 'user'
                  ? 'inline-block max-w-[85%] border border-rule bg-ink-raised px-5 py-3 text-left font-ui text-sm text-ivory'
                  : m.safety === 'crisis'
                    ? 'border-l-2 border-state-danger bg-state-danger/10 px-5 py-4'
                    : ''
              }
            >
              {m.content.split('\n\n').map((para, j) => (
                <p
                  key={j}
                  className={
                    m.role === 'assistant'
                      ? 'mb-3 font-reading text-base leading-relaxed text-grey last:mb-0'
                      : ''
                  }
                >
                  {renderInline(para)}
                </p>
              ))}
            </div>

            {m.suggestions && m.suggestions.length > 0 && (
              <ul className="mt-3 flex flex-wrap gap-2.5">
                {m.suggestions.map((s) => (
                  <li key={s.slug}>
                    <Link
                      href={`/story/${s.slug}`}
                      className="inline-block border border-rule px-4 py-2 font-ui text-sm text-grey-muted transition-colors hover:border-gold/40 hover:text-ivory"
                    >
                      {s.title} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {thinking && (
          <p aria-live="polite" className="font-display text-lg italic text-grey-muted">
            The Librarian is thinking…
          </p>
        )}

        <div ref={endRef} />
      </div>

      {!lastWasCrisis && (
        <div className="border-t border-rule p-5 sm:p-6">
          <div className="mb-4 flex flex-wrap gap-2">
            {OPENERS.map((o) => (
              <button
                key={o}
                type="button"
                onClick={() => send(o)}
                disabled={thinking}
                className="border border-rule px-3.5 py-1.5 font-ui text-xs text-grey-muted transition-colors hover:border-gold/40 hover:text-ivory disabled:opacity-40"
              >
                {o}
              </button>
            ))}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-end gap-3"
          >
            <label htmlFor="companion-input" className="sr-only">
              Message the Librarian
            </label>
            <textarea
              id="companion-input"
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void send(input);
                }
              }}
              placeholder="However it actually is."
              className="min-w-0 flex-1 resize-none border border-rule bg-ink-raised px-4 py-3 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50"
            />
            <button
              type="submit"
              disabled={thinking || !input.trim()}
              className="flex-none border border-gold/50 px-6 py-3 font-ui text-xs uppercase tracking-[0.18em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-40"
            >
              Send
            </button>
          </form>

          <p className="mt-3 text-xs leading-normal text-grey-muted">
            A companion for reflection, not a therapist. It does not diagnose
            or advise, and it never reads your journal unless you tick that box
            on an entry.
          </p>
        </div>
      )}
    </div>
  );
}

/** Bold only. The companion writes prose, not markup. */
function renderInline(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|https?:\/\/\S+)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="text-ivory">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (/^https?:\/\//.test(part)) {
      return (
        <a
          key={i}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gold underline underline-offset-2"
        >
          {part}
        </a>
      );
    }
    return part;
  });
}
