import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StoryRow } from '@/components/story-row';
import { ErrorLine, Loading, Muted, SectionHead, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { finishedIds, listShelves, listStories, savedIds, setSaved, type Shelf, type StoryCard } from '@/lib/content';
import { getMoods, type Mood } from '@/lib/journal';
import { setMoodToday } from '@/lib/prefs';
import { useSession } from '@/lib/session';

/**
 * Your mood today, and what the House has for it.
 *
 * The same rule the website's Wander page uses: a mood lives on a
 * shelf; the shelf's stories are handed over, the ones already finished
 * left out, the quiet ones first. No model, and every pick has a reason.
 */
export default function MoodScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useSession();
  const [mood, setMood] = useState<Mood | null | undefined>(undefined);
  const [shelf, setShelf] = useState<Shelf | null>(null);
  const [stories, setStories] = useState<StoryCard[]>([]);
  const [saved, setSavedSet] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [moods, shelves, all, done, kept] = await Promise.all([
        getMoods(),
        listShelves(),
        listStories(),
        session ? finishedIds() : Promise.resolve(new Set<string>()),
        session ? savedIds() : Promise.resolve(new Set<string>()),
      ]);
      const m = moods.find((x) => x.slug === slug) ?? null;
      setMood(m);
      setSavedSet(kept);
      const sh = m?.shelfId ? (shelves.find((s) => s.id === m.shelfId) ?? null) : null;
      setShelf(sh);
      const onShelf = sh ? all.filter((s) => s.shelf?.slug === sh.slug) : all;
      const fresh = onShelf.filter((s) => !done.has(s.id));
      setStories((fresh.length ? fresh : onShelf).slice(0, 12));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [slug, session]);

  useEffect(() => {
    load();
  }, [load]);

  if (mood === undefined) return <Loading />;

  const toggleSave = async (s: StoryCard) => {
    if (!session) return router.push('/signin');
    const on = !saved.has(s.id);
    setSavedSet((set) => {
      const next = new Set(set);
      if (on) next.add(s.id);
      else next.delete(s.id);
      return next;
    });
    await setSaved(s.id, session.user.id, on).catch(() => load());
  };

  return (
    <>
      <Stack.Screen options={{ title: 'Your mood today' }} />
      <ScrollView contentContainerStyle={ui.page}>
        <View style={styles.moodCard}>
          <View style={styles.circle}>
            <Text style={{ fontSize: 28 }}>{mood?.emoji ?? '✦'}</Text>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={styles.moodLabel}>{mood?.label ?? 'However you are'}</Text>
            <Text style={styles.moodLine}>{shelf?.tagline ?? 'The whole House is open to you tonight.'}</Text>
          </View>
          <Pressable onPress={async () => { await setMoodToday(null); router.back(); }} hitSlop={8}>
            <Text style={ui.link}>Edit</Text>
          </Pressable>
        </View>
        <ErrorLine>{error}</ErrorLine>

        <SectionHead title="For You" action={shelf ? 'See all' : undefined} onAction={() => router.navigate({ pathname: '/(tabs)/library', params: { shelf: shelf?.slug } })} />
        {shelf && <Muted>From the {shelf.label} shelf{session ? ', leaving out what you have finished' : ''}.</Muted>}
        <View style={{ gap: space.sm, marginTop: space.sm }}>
          {stories.map((s) => (
            <StoryRow key={s.id} item={s} saved={saved.has(s.id)} onSave={() => toggleSave(s)} />
          ))}
          {stories.length === 0 && <Muted>The shelf is being filled.</Muted>}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  moodCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 16, padding: space.md },
  circle: { width: 56, height: 56, borderRadius: 28, backgroundColor: colors.ink, borderColor: colors.gold, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  moodLabel: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 20 },
  moodLine: { color: colors.grey, fontSize: 13, lineHeight: 18 },
});
