'use client';

import { useActionState, useRef, useState, useTransition } from 'react';
import {
  beginAudioUpload,
  finishAudioUpload,
  generateStoryAudio,
  removeStoryAudio,
  type AudioActionResult,
} from '@/app/actions/audio';

export type Narration = {
  narrator: string | null;
  format: string;
  durationSeconds: number | null;
  fileSizeBytes: number | null;
  access: 'free' | 'premium';
  generated: boolean;
  createdAt: string;
};

function clock(seconds: number | null): string {
  if (!seconds) return '—';
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/**
 * A story's narration, in the admin.
 *
 * Two ways to get one, honest about the difference. "Read it aloud"
 * asks a generated voice to read the story now, for a few cents, and
 * the player will say a synthetic voice is reading. "Upload a
 * recording" is for a person's voice: the file goes straight from the
 * browser to the private bucket — it is tens of megabytes, more than a
 * form can carry — and the server is told afterwards.
 */
export function AudioField({
  storySlug,
  narration,
  voices,
  defaultVoice,
  words,
}: {
  storySlug: string;
  narration: Narration | null;
  voices: { id: string; label: string }[];
  defaultVoice: string;
  words: number;
}) {
  const [genState, genAction, generating] = useActionState<AudioActionResult, FormData>(generateStoryAudio, {});
  const [finishState, finishAction] = useActionState<AudioActionResult, FormData>(finishAudioUpload, {});
  const [, startTransition] = useTransition();
  const [uploading, setUploading] = useState<null | { pct: number }>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const narratorRef = useRef<HTMLInputElement>(null);
  const accessRef = useRef<HTMLSelectElement>(null);

  // Rough cost, so the button says what it will spend before it is pressed.
  const cents = Math.max(1, Math.round((words * 6 * 16) / 1_000_000 * 100));

  async function upload(file: File) {
    setUploadError(null);
    setUploading({ pct: 0 });
    try {
      const begin = new FormData();
      begin.set('storySlug', storySlug);
      begin.set('filename', file.name);
      begin.set('size', String(file.size));
      const step = await beginAudioUpload({}, begin);
      if (step.error || !step.upload) {
        setUploadError(step.error ?? 'Could not start the upload.');
        setUploading(null);
        return;
      }

      // The file's own length, read by the browser before it travels.
      const durationSeconds = await new Promise<number | undefined>((resolve) => {
        const a = document.createElement('audio');
        a.preload = 'metadata';
        a.onloadedmetadata = () => resolve(Math.round(a.duration));
        a.onerror = () => resolve(undefined);
        a.src = URL.createObjectURL(file);
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', step.upload!.signedUrl);
        xhr.setRequestHeader('Content-Type', file.type || 'audio/mpeg');
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) setUploading({ pct: Math.round((e.loaded / e.total) * 100) });
        };
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Storage answered ${xhr.status}.`)));
        xhr.onerror = () => reject(new Error('The upload did not get through.'));
        xhr.send(file);
      });

      const finish = new FormData();
      finish.set('storySlug', storySlug);
      finish.set('path', step.upload.path);
      finish.set('size', String(file.size));
      if (durationSeconds) finish.set('durationSeconds', String(durationSeconds));
      finish.set('narrator', narratorRef.current?.value ?? '');
      finish.set('access', accessRef.current?.value ?? 'free');
      startTransition(() => finishAction(finish));
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : 'The upload did not get through.');
    } finally {
      setUploading(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  const field =
    'w-full border border-rule bg-ink-raised px-3.5 py-2.5 font-ui text-sm text-ivory outline-none transition-colors placeholder:text-grey-faint focus:border-gold/50';
  const message = genState.message ?? finishState.message;
  const error = genState.error ?? finishState.error ?? uploadError;

  return (
    <section className="mt-12 border-t border-rule pt-8">
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="sf-eyebrow">Narration</h2>
        {narration && (
          <form action={removeStoryAudio}>
            <input type="hidden" name="storySlug" value={storySlug} />
            <button type="submit" className="font-ui text-xs text-grey-muted transition-colors hover:text-state-danger">
              Remove the narration
            </button>
          </form>
        )}
      </div>

      {error && (
        <p role="alert" className="mb-4 border-l-2 border-state-danger bg-state-danger/10 px-4 py-3 text-sm text-ivory">
          {error}
        </p>
      )}
      {message && (
        <p aria-live="polite" className="mb-4 border-l-2 border-state-success bg-state-success/10 px-4 py-3 text-sm text-ivory">
          {message}
        </p>
      )}

      {narration ? (
        <div className="mb-6 flex flex-wrap items-center gap-x-6 gap-y-2 border border-rule px-5 py-4">
          <span className="font-ui text-sm text-ivory">
            {narration.generated ? 'Generated voice' : 'Recording'}
            {narration.narrator && <span className="text-grey-muted"> · {narration.narrator}</span>}
          </span>
          <span className="font-ui text-xs text-grey-muted">{narration.format.toUpperCase()} · {clock(narration.durationSeconds)}</span>
          <span className="font-ui text-xs text-grey-muted">{narration.access === 'premium' ? 'Residents only' : 'Free to hear'}</span>
        </div>
      ) : (
        <p className="mb-6 font-ui text-sm text-grey-muted">No narration yet. Readers see no player.</p>
      )}

      <div className="grid gap-px bg-rule sm:grid-cols-2">
        {/* Generated */}
        <form action={genAction} className="bg-ink p-6">
          <input type="hidden" name="storySlug" value={storySlug} />
          <p className="font-display text-xl text-ivory">Read it aloud</p>
          <p className="mt-2 font-ui text-xs leading-relaxed text-grey-muted">
            A generated voice reads the story as it stands, in a few minutes. The player
            tells readers a synthetic voice is reading. Around {cents}¢ for this story.
          </p>
          <label htmlFor="tts-voice" className="sf-eyebrow mb-2 mt-5 block">Voice</label>
          <select id="tts-voice" name="voice" defaultValue={defaultVoice} className={field}>
            {voices.map((v) => (
              <option key={v.id} value={v.id} className="bg-ink">{v.label}</option>
            ))}
          </select>
          <label htmlFor="tts-access" className="sf-eyebrow mb-2 mt-4 block">Who may hear it</label>
          <select id="tts-access" name="access" defaultValue="free" className={field}>
            <option value="free" className="bg-ink">Everyone</option>
            <option value="premium" className="bg-ink">Premium only</option>
          </select>
          <button
            type="submit"
            disabled={generating || words < 20}
            className="mt-5 border border-gold/50 px-6 py-2.5 font-ui text-xs uppercase tracking-[0.14em] text-gold transition-all hover:bg-gold hover:text-ink disabled:opacity-50"
          >
            {generating ? 'Reading…' : narration ? 'Read it again' : 'Read it aloud'}
          </button>
        </form>

        {/* Recorded */}
        <div className="bg-ink p-6">
          <p className="font-display text-xl text-ivory">Upload a recording</p>
          <p className="mt-2 font-ui text-xs leading-relaxed text-grey-muted">
            A person&rsquo;s voice, as MP3, M4A, AAC or OGG, up to 500 MB. It goes straight
            to the House&rsquo;s private store.
          </p>
          <label htmlFor="rec-narrator" className="sf-eyebrow mb-2 mt-5 block">Read by</label>
          <input id="rec-narrator" ref={narratorRef} placeholder="Apophia Kamwine" className={field} />
          <label htmlFor="rec-access" className="sf-eyebrow mb-2 mt-4 block">Who may hear it</label>
          <select id="rec-access" ref={accessRef} defaultValue="free" className={field}>
            <option value="free" className="bg-ink">Everyone</option>
            <option value="premium" className="bg-ink">Premium only</option>
          </select>
          <input
            ref={fileRef}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/aac,audio/ogg,.mp3,.m4a,.aac,.ogg"
            disabled={uploading !== null}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void upload(f);
            }}
            className="mt-5 w-full text-sm text-grey file:mr-4 file:border file:border-rule file:bg-ink-raised file:px-4 file:py-2 file:font-ui file:text-xs file:uppercase file:tracking-[0.14em] file:text-grey hover:file:text-ivory"
          />
          {uploading && (
            <p className="mt-3 font-ui text-xs text-grey-muted" aria-live="polite">
              Uploading… {uploading.pct}%
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
