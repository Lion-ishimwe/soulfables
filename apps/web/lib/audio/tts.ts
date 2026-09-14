import 'server-only';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';

/**
 * A generated voice reading a story.
 *
 * Amazon Polly, chosen because the House already lives on AWS: the
 * instance's own role can be given permission to speak, and no new
 * secret has to exist anywhere. A neural voice costs about sixteen
 * dollars per million characters, which is ten cents for a long story.
 *
 * Polly reads at most a few thousand characters per request, so the
 * story is cut at paragraph edges into pieces under that limit, each
 * piece is spoken, and the MP3 frames are joined. MP3 concatenates
 * cleanly when every piece is encoded the same way, which they are.
 *
 * This is a synthetic voice, and the player says so. It is not the
 * narrated edition the brief describes; it is the story read aloud on
 * the day it is published, for readers who would rather listen.
 */

/** Polly's ceiling is 3,000 billed characters; stay under it with room. */
const CHUNK_LIMIT = 2800;

export const VOICES: { id: string; label: string; language: string }[] = [
  { id: 'Amy', label: 'Amy — British, warm', language: 'en-GB' },
  { id: 'Brian', label: 'Brian — British, low', language: 'en-GB' },
  { id: 'Joanna', label: 'Joanna — American, clear', language: 'en-US' },
  { id: 'Matthew', label: 'Matthew — American, even', language: 'en-US' },
];

export function defaultVoice(): string {
  return process.env.TTS_VOICE || 'Amy';
}

/**
 * What the voice should say, from what the writer wrote.
 *
 * The body is the House's small Markdown: `::` section titles, `>`
 * pull quotes, emphasis marks. Section titles are read with a pause on
 * either side; quotes are read as sentences; the marks themselves are
 * not read.
 */
export function speakable(body: string): string {
  return body
    .replace(/\r\n/g, '\n')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/^::\s*(.+)$/gm, '\n\n$1.\n\n')
    .replace(/^>\s?/gm, '')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/_([^_]+)_/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Cut at paragraph edges; a paragraph longer than the limit is cut at sentences. */
export function chunk(text: string, limit = CHUNK_LIMIT): string[] {
  const out: string[] = [];
  let current = '';

  const push = () => {
    if (current.trim()) out.push(current.trim());
    current = '';
  };

  for (const para of text.split(/\n\s*\n/)) {
    const p = para.trim();
    if (!p) continue;
    if (p.length > limit) {
      push();
      let piece = '';
      for (const sentence of p.split(/(?<=[.!?…]["”')\]]?)\s+/)) {
        if ((piece + ' ' + sentence).length > limit && piece) {
          out.push(piece.trim());
          piece = sentence;
        } else {
          piece = piece ? `${piece} ${sentence}` : sentence;
        }
      }
      if (piece.trim()) out.push(piece.trim());
      continue;
    }
    if ((current + '\n\n' + p).length > limit && current) push();
    current = current ? `${current}\n\n${p}` : p;
  }
  push();
  return out;
}

export type Synthesised = {
  audio: Buffer;
  /** Estimated: Polly does not report it, and the player reads the real one from the file. */
  durationSeconds: number;
  characters: number;
  voice: string;
};

/** Injected for tests; the real client otherwise. */
export type Speaker = (text: string, voice: string) => Promise<Uint8Array>;

function pollySpeaker(): Speaker {
  const client = new PollyClient({ region: process.env.TTS_REGION || 'eu-west-1' });
  return async (text, voice) => {
    const res = await client.send(
      new SynthesizeSpeechCommand({
        Text: text,
        TextType: 'text',
        VoiceId: voice as never,
        Engine: 'neural',
        OutputFormat: 'mp3',
        SampleRate: '24000',
      }),
    );
    if (!res.AudioStream) throw new Error('Polly returned no audio.');
    return res.AudioStream.transformToByteArray();
  };
}

export async function synthesise(
  body: string,
  voice = defaultVoice(),
  speak: Speaker = pollySpeaker(),
): Promise<Synthesised> {
  const text = speakable(body);
  if (!text) throw new Error('There is nothing to read.');

  const pieces = chunk(text);
  const parts: Uint8Array[] = [];
  for (const piece of pieces) parts.push(await speak(piece, voice));

  const audio = Buffer.concat(parts.map((p) => Buffer.from(p)));
  const characters = pieces.reduce((n, p) => n + p.length, 0);

  // Polly's neural MP3 at 24 kHz is about 48 kbit/s. Close enough for a
  // badge; the player shows the file's own duration once it loads.
  const durationSeconds = Math.round((audio.byteLength * 8) / 48_000);

  return { audio, durationSeconds, characters, voice };
}
