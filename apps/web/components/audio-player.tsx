'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { recordListening } from '@/app/actions/reading';
import { LISTEN_EVENT } from '@/components/listen-link';

/**
 * The narration player.
 *
 * Built as part of the page rather than as a floating bar, for the same
 * reason the reader controls are: nothing should hover over the prose
 * while someone is reading it.
 *
 * Position is remembered separately from reading progress. Brief §12 asks
 * for "resume listening", and a reader who listens in the car and reads
 * at night should not have one clobber the other — the schema keeps
 * `audio_position_seconds` distinct from `percent` for exactly this.
 */

const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
const SAVE_INTERVAL_MS = 10_000;

function clock(seconds: number): string {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function AudioPlayer({
  storyId,
  src,
  narrator,
  isPlaceholder = false,
  generated = false,
  resumeAt = 0,
}: {
  storyId: string;
  src: string;
  narrator?: string | null;
  isPlaceholder?: boolean;
  /** A synthetic voice is reading. Said plainly; never passed off as a person. */
  generated?: boolean;
  resumeAt?: number;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSaved = useRef(0);

  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(resumeAt);
  const [duration, setDuration] = useState(0);
  const [speed, setSpeed] = useState<number>(1);
  const [resumed, setResumed] = useState(false);

  const save = useCallback(
    (seconds: number, force = false) => {
      const now = Date.now();
      if (!force && now - lastSaved.current < SAVE_INTERVAL_MS) return;
      lastSaved.current = now;
      void recordListening({ storyId, seconds });
    },
    [storyId],
  );

  // Restore the saved position once metadata is available — seeking
  // before the browser knows the duration silently does nothing.
  useEffect(() => {
    const el = audioRef.current;
    if (!el || !ready || resumed || resumeAt <= 0) return;
    el.currentTime = resumeAt;
    setResumed(true);
  }, [ready, resumed, resumeAt]);

  useEffect(() => {
    const el = audioRef.current;
    if (!el) return;
    el.playbackRate = speed;
  }, [speed]);

  // The hero's Listen button asks for a start; oblige once the file is ready.
  useEffect(() => {
    const onListen = () => {
      const el = audioRef.current;
      if (!el) return;
      const start = () => void el.play();
      if (el.readyState >= 1) start();
      else el.addEventListener('loadedmetadata', start, { once: true });
    };
    window.addEventListener(LISTEN_EVENT, onListen);
    return () => window.removeEventListener(LISTEN_EVENT, onListen);
  }, []);

  // Save on the way out, whatever the reason.
  useEffect(() => {
    const flush = () => save(audioRef.current?.currentTime ?? 0, true);
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [save]);

  function toggle() {
    const el = audioRef.current;
    if (!el) return;
    if (el.paused) {
      void el.play();
    } else {
      el.pause();
      save(el.currentTime, true);
    }
  }

  function skip(by: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = Math.max(0, Math.min(el.duration || 0, el.currentTime + by));
  }

  const progress = duration > 0 ? (current / duration) * 100 : 0;

  /*
   * The keys a listener reaches for: space to pause, arrows to skip. Only
   * while the player has focus, so a reader scrolling with the space bar
   * is not surprised by narration starting.
   */
  function onKey(e: React.KeyboardEvent) {
    if ((e.target as HTMLElement).tagName === 'BUTTON' && e.key === ' ') return;
    if (e.key === ' ' || e.key === 'k') {
      e.preventDefault();
      toggle();
    } else if (e.key === 'ArrowLeft' || e.key === 'j') {
      e.preventDefault();
      skip(-15);
    } else if (e.key === 'ArrowRight' || e.key === 'l') {
      e.preventDefault();
      skip(30);
    }
  }

  const label = isPlaceholder
    ? 'Narration — sample track'
    : generated
      ? 'Read aloud — generated voice'
      : 'Narrated';

  return (
    <section
      id="listen"
      aria-label="Listen to this story"
      tabIndex={0}
      onKeyDown={onKey}
      className="mx-auto max-w-measure border border-rule bg-ink-raised p-5 outline-none focus-visible:border-gold/50"
    >
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onLoadedMetadata={(e) => {
          setDuration(e.currentTarget.duration);
          setReady(true);
        }}
        onTimeUpdate={(e) => {
          setCurrent(e.currentTarget.currentTime);
          save(e.currentTarget.currentTime);
        }}
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => {
          setPlaying(false);
          save(0, true);
        }}
      />

      <div className="flex items-center justify-between gap-4">
        <p className="sf-eyebrow">{label}</p>
        {narrator && !generated && (
          <p className="font-ui text-xs text-grey-muted">Read by {narrator}</p>
        )}
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          type="button"
          onClick={toggle}
          disabled={!ready}
          aria-label={playing ? 'Pause' : 'Play'}
          className="flex h-12 w-12 flex-none items-center justify-center rounded-full border border-gold/50 text-gold transition-all duration-base ease-house hover:bg-gold hover:text-ink disabled:opacity-40"
        >
          {playing ? (
            <svg width="14" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
              <rect x="0" y="0" width="4" height="14" rx="1" />
              <rect x="8" y="0" width="4" height="14" rx="1" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 12 14" fill="currentColor" aria-hidden="true">
              <path d="M1 1.2v11.6a1 1 0 0 0 1.5.87l9.5-5.8a1 1 0 0 0 0-1.74L2.5.33A1 1 0 0 0 1 1.2Z" />
            </svg>
          )}
        </button>

        <div className="min-w-0 flex-1">
          <label htmlFor="audio-scrub" className="sr-only">
            Position
          </label>
          <input
            id="audio-scrub"
            type="range"
            min={0}
            max={duration || 0}
            step={1}
            value={current}
            disabled={!ready}
            aria-valuetext={`${clock(current)} of ${clock(duration)}`}
            onChange={(e) => {
              const el = audioRef.current;
              if (!el) return;
              el.currentTime = Number(e.target.value);
              setCurrent(Number(e.target.value));
            }}
            className="w-full accent-[#C89528]"
          />
          <div className="mt-1 flex justify-between font-ui text-xs tabular-nums text-grey-muted">
            <span>{clock(current)}</span>
            <span>{clock(duration)}</span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => skip(-15)}
            disabled={!ready}
            className="border border-rule px-3 py-1.5 font-ui text-xs text-grey-muted transition-colors hover:text-ivory disabled:opacity-40"
          >
            ← 15s
          </button>
          <button
            type="button"
            onClick={() => skip(30)}
            disabled={!ready}
            className="border border-rule px-3 py-1.5 font-ui text-xs text-grey-muted transition-colors hover:text-ivory disabled:opacity-40"
          >
            30s →
          </button>
        </div>

        <div className="flex items-center gap-1.5" role="group" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setSpeed(s)}
              aria-pressed={speed === s}
              className={`px-2 py-1 font-ui text-xs tabular-nums transition-colors ${
                speed === s ? 'text-gold' : 'text-grey-muted hover:text-ivory'
              }`}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Progress as form as well as number, for a glance. */}
      <div className="mt-4 h-px w-full bg-rule" aria-hidden="true">
        <div className="h-px bg-gold" style={{ width: `${progress}%` }} />
      </div>

      {isPlaceholder && (
        <p className="mt-4 text-xs leading-normal text-grey-muted">
          Narration for this story has not been recorded yet. This is a tone
          track so the player can be tried — the transport, speed, skip and
          resume-where-you-left-off all behave as they will with real audio.
        </p>
      )}
    </section>
  );
}
