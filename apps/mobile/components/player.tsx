import { useAudioPlayer, useAudioPlayerStatus, setAudioModeAsync } from 'expo-audio';
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/constants/theme';
import { narrationUrl } from '@/lib/api';
import type { FullStory } from '@/lib/content';

/**
 * The narration player.
 *
 * The file's address is signed and short-lived, so it is fetched from
 * the site only when the reader presses Listen; the site counts the
 * listen against the Free allowance at that moment, exactly as the web
 * player does. Audio keeps playing with the screen off, and a sleep
 * timer stops it after the chosen minutes.
 */
export function Player({ slug, audio, signedIn }: { slug: string; audio: NonNullable<FullStory['audio']>; signedIn: boolean }) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [sleepMinutes, setSleepMinutes] = useState<number | null>(null);
  const player = useAudioPlayer(url ? { uri: url } : null);
  const status = useAudioPlayerStatus(player);

  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true, shouldPlayInBackground: true, interruptionMode: 'duckOthers' }).catch(() => {});
  }, []);

  useEffect(() => {
    if (url) player.play();
  }, [url, player]);

  useEffect(() => {
    if (!sleepMinutes) return;
    const t = setTimeout(() => {
      player.pause();
      setSleepMinutes(null);
    }, sleepMinutes * 60_000);
    return () => clearTimeout(t);
  }, [sleepMinutes, player]);

  async function listen() {
    setLoading(true);
    setError(null);
    try {
      const { url: signed } = await narrationUrl(slug);
      setUrl(signed);
    } catch {
      setError('The narration could not be opened just now.');
    } finally {
      setLoading(false);
    }
  }

  const minutes = audio.durationSeconds ? Math.max(1, Math.round(audio.durationSeconds / 60)) : null;

  if (audio.locked) {
    const why =
      audio.reason === 'sign_in'
        ? 'Sign in to listen.'
        : audio.reason === 'allowance'
          ? 'You have listened to your free stories for this month. Premium opens every narration.'
          : audio.reason === 'paid'
            ? 'The narration comes with the book.'
            : 'This narration is kept for Premium.';
    return (
      <View style={styles.box}>
        <Text style={styles.label}>NARRATION{minutes ? ` · ${minutes} MIN` : ''}</Text>
        <Text style={styles.muted}>{why}</Text>
      </View>
    );
  }

  const playing = status.playing;
  const pos = status.currentTime ?? 0;
  const dur = status.duration || (audio.durationSeconds ?? 0);

  return (
    <View style={styles.box}>
      <Text style={styles.label}>
        NARRATION{minutes ? ` · ${minutes} MIN` : ''}{audio.narrator ? ` · READ BY ${audio.narrator.toUpperCase()}` : ' · A GENERATED VOICE'}
      </Text>
      {!url ? (
        <Pressable style={[styles.button, loading && { opacity: 0.5 }]} disabled={loading} onPress={listen}>
          <Text style={styles.buttonText}>{loading ? 'OPENING…' : '▶  LISTEN'}</Text>
        </Pressable>
      ) : (
        <>
          <View style={styles.row}>
            <Pressable style={styles.button} onPress={() => (playing ? player.pause() : player.play())}>
              <Text style={styles.buttonText}>{playing ? '❚❚' : '▶'}</Text>
            </Pressable>
            <Pressable style={styles.small} onPress={() => player.seekTo(Math.max(0, pos - 15))}><Text style={styles.smallText}>−15s</Text></Pressable>
            <Pressable style={styles.small} onPress={() => player.seekTo(Math.min(dur, pos + 30))}><Text style={styles.smallText}>+30s</Text></Pressable>
            <Text style={styles.time}>{fmt(pos)} / {fmt(dur)}</Text>
          </View>
          <View style={styles.bar}><View style={[styles.fill, { width: `${dur ? Math.min(100, (pos / dur) * 100) : 0}%` }]} /></View>
          <View style={styles.row}>
            <Text style={styles.smallText}>Sleep timer</Text>
            {[15, 30, 45].map((m) => (
              <Pressable key={m} style={[styles.small, sleepMinutes === m && styles.smallOn]} onPress={() => setSleepMinutes(sleepMinutes === m ? null : m)}>
                <Text style={styles.smallText}>{m} min</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}
      {error && <Text style={styles.error}>{error}</Text>}
      {!signedIn && audio.reason === null && <Text style={styles.muted}>Listening counts toward the free stories a month.</Text>}
    </View>
  );
}

function fmt(s: number) {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  box: { borderColor: colors.rule, borderWidth: 1, backgroundColor: colors.inkRaised, padding: space.md, gap: space.sm, marginVertical: space.md },
  label: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  muted: { color: colors.greyMuted, fontSize: 13, lineHeight: 18 },
  error: { color: colors.danger, fontSize: 13 },
  button: { borderColor: colors.gold, borderWidth: 1, paddingVertical: 10, paddingHorizontal: 18, alignSelf: 'flex-start' },
  buttonText: { color: colors.gold, letterSpacing: 3, fontSize: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  small: { borderColor: colors.rule, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 10 },
  smallOn: { borderColor: colors.gold },
  smallText: { color: colors.grey, fontSize: 12 },
  time: { color: colors.greyMuted, fontSize: 12, marginLeft: 'auto' },
  bar: { height: 2, backgroundColor: colors.rule },
  fill: { height: 2, backgroundColor: colors.gold },
});
