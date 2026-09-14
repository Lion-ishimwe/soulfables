'use client';

/** The name of the nudge the hero gives the player. */
export const LISTEN_EVENT = 'soulfables:listen';

/**
 * "Listen" in the hero: the narration as a way in, not something found
 * by scrolling. It brings the player into view and asks it to start —
 * the player itself owns the audio element, so the ask travels as an
 * event rather than a ref across the server/client line.
 */
export function ListenLink({ minutes }: { minutes: number | null }) {
  return (
    <button
      type="button"
      onClick={() => {
        document.getElementById('listen')?.scrollIntoView({ block: 'center', behavior: 'smooth' });
        window.dispatchEvent(new CustomEvent(LISTEN_EVENT));
      }}
      className="inline-flex items-center gap-2 border border-gold/50 px-5 py-2.5 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink"
    >
      <svg width="10" height="12" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
        <path d="M1 1.2v11.6a1 1 0 0 0 1.5.87l9.5-5.8a1 1 0 0 0 0-1.74L2.5.33A1 1 0 0 0 1 1.2Z" />
      </svg>
      Listen{minutes ? <span className="normal-case tracking-normal text-gold/80">· {minutes} min</span> : null}
    </button>
  );
}
