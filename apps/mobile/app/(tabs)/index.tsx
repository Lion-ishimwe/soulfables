import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { ScreenHeader } from '@/components/screen-header';
import { ErrorLine, Muted, SectionHead, greeting, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { listReading, type ReadingRow } from '@/lib/account';
import { getStoryOfTheDay, latestLetter, listStories, type LetterCard, type StoryCard } from '@/lib/content';
import { SITE_URL } from '@/lib/config';
import { getAffirmation, getMoods, type Affirmation, type Mood } from '@/lib/journal';
import { getMoodToday, setMoodToday } from '@/lib/prefs';
import { useSession } from '@/lib/session';

/**
 * Home: the daily return.
 *
 * The greeting, how the reader is arriving (the House's moods), the
 * story of the day from the same featured slot the website's front
 * page reads, the affirmation of the day, where they left off, and the
 * latest Weekly Letter. Choosing a mood opens the feed for it.
 */
export default function HomeScreen() {
  const { session } = useSession();
  const [moods, setMoods] = useState<Mood[]>([]);
  const [moodToday, setMood] = useState<string | null>(null);
  const [story, setStory] = useState<StoryCard | null>(null);
  const [affirmation, setAffirmation] = useState<Affirmation | null>(null);
  const [reading, setReading] = useState<ReadingRow[]>([]);
  const [letter, setLetter] = useState<LetterCard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [m, all, a, l, chosen] = await Promise.all([getMoods(), listStories(), getAffirmation(), latestLetter().catch(() => null), getMoodToday()]);
      setMoods(m);
      setAffirmation(a);
      setLetter(l);
      setMood(chosen);
      setStory(await getStoryOfTheDay(all));
      if (session) setReading((await listReading()).filter((r) => !r.completedAt).slice(0, 3));
      else setReading([]);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const choose = async (m: Mood) => {
    setMood(m.slug);
    await setMoodToday(m.slug);
    router.push({ pathname: '/mood', params: { slug: m.slug } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <ScreenHeader wordmark actions={[{ glyph: '⌕', label: 'Search', onPress: () => router.navigate({ pathname: '/(tabs)/library', params: { search: '1' } }) }]} />
      <ScrollView
        contentContainerStyle={ui.page}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
      >
        <Text style={styles.greeting}>{greeting()}</Text>
        <Text style={styles.ask}>What is yours{'\n'}today?</Text>
        <Muted>Every soul has a story.</Muted>
        <ErrorLine>{error}</ErrorLine>

        <Text style={styles.question}>How are you arriving today?</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moods}>
          {moods.map((m) => (
            <Pressable key={m.id} onPress={() => choose(m)} style={styles.mood}>
              <View style={[styles.moodCircle, moodToday === m.slug && styles.moodOn]}>
                <Text style={styles.moodEmoji}>{m.emoji ?? '✦'}</Text>
              </View>
              <Text style={[styles.moodLabel, moodToday === m.slug && { color: colors.gold }]}>{m.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {story && (
          <Link href={{ pathname: '/story/[slug]', params: { slug: story.slug } }} asChild>
            <Pressable style={styles.hero}>
              {story.coverImage ? <Image source={{ uri: story.coverImage }} style={styles.heroCover} /> : <View style={[styles.heroCover, styles.heroDrawn]}><Text style={{ color: colors.gold, fontSize: 28 }}>✦</Text></View>}
              <View style={{ flex: 1, gap: 4, justifyContent: 'center' }}>
                <Text style={styles.heroEyebrow}>STORY OF THE DAY</Text>
                <Text style={styles.heroMeta}>◷ {story.readingMinutes} min{story.hasAudio ? '  ·  ♪' : ''}</Text>
                <Text style={styles.heroTitle} numberOfLines={2}>{story.title}</Text>
                {(story.subtitle || story.excerpt) && <Text style={styles.heroSub} numberOfLines={2}>{story.subtitle ?? story.excerpt}</Text>}
              </View>
              <Text style={styles.chev}>›</Text>
            </Pressable>
          </Link>
        )}

        {affirmation && (
          <View style={styles.affirmation}>
            <Text style={styles.affEyebrow}>☼  TODAY’S AFFIRMATION</Text>
            <Text style={styles.affText}>“{affirmation.body}”</Text>
          </View>
        )}

        {reading.length > 0 && (
          <>
            <SectionHead title="Continue" action="Library" onAction={() => router.navigate('/(tabs)/library')} />
            {reading.map((r) => (
              <Link key={r.slug} href={{ pathname: '/read/[slug]', params: { slug: r.slug } }} asChild>
                <Pressable style={styles.line}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.lineTitle}>{r.title}</Text>
                    <Text style={styles.lineMeta}>{Math.round(r.percent * 100)}% read</Text>
                  </View>
                  <View style={styles.progress}><View style={[styles.progressFill, { width: `${Math.round(r.percent * 100)}%` }]} /></View>
                </Pressable>
              </Link>
            ))}
          </>
        )}

        {!session && (
          <View style={[ui.card, { marginTop: space.lg }]}>
            <Text style={styles.cardTitle}>Come in.</Text>
            <Muted>Sign in to keep stories, write in your journal and pick up where you left off.</Muted>
            <Link href="/signin" asChild>
              <Pressable><Text style={ui.link}>Sign in →</Text></Pressable>
            </Link>
          </View>
        )}

        {letter && (
          <>
            <SectionHead title="The Weekly Letter" />
            <Pressable style={ui.card} onPress={() => Linking.openURL(`${SITE_URL}/letter/${letter.slug}`)}>
              <Text style={styles.cardTitle}>{letter.title}</Text>
              {letter.dek && <Muted>{letter.dek}</Muted>}
              <Text style={ui.link}>Read the letter →</Text>
            </Pressable>
          </>
        )}

        <SectionHead title="The Librarian" />
        <Pressable style={ui.card} onPress={() => router.push('/librarian')}>
          <Muted>Tell the Librarian what kind of night it is, and she will find a story that meets it.</Muted>
          <Text style={ui.link}>Ask the Librarian →</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  greeting: { color: colors.gold, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 18 },
  ask: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 34, lineHeight: 40 },
  question: { color: colors.ivory, fontSize: 15, marginTop: space.lg },
  moods: { gap: space.md, paddingVertical: space.sm },
  mood: { alignItems: 'center', gap: 6, width: 64 },
  moodCircle: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  moodOn: { borderColor: colors.gold, backgroundColor: 'rgba(201,169,97,0.15)' },
  moodEmoji: { fontSize: 22 },
  moodLabel: { color: colors.grey, fontSize: 11 },
  hero: { flexDirection: 'row', gap: space.md, backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 16, padding: space.sm, marginTop: space.md, alignItems: 'center' },
  heroCover: { width: 96, height: 120, borderRadius: 10, backgroundColor: colors.rule },
  heroDrawn: { alignItems: 'center', justifyContent: 'center' },
  heroEyebrow: { color: colors.gold, fontSize: 9, letterSpacing: 2 },
  heroMeta: { color: colors.greyMuted, fontSize: 11 },
  heroTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 19, lineHeight: 24 },
  heroSub: { color: colors.grey, fontSize: 12, lineHeight: 16 },
  chev: { color: colors.greyMuted, fontSize: 28, paddingHorizontal: 6 },
  affirmation: { borderLeftWidth: 2, borderLeftColor: colors.gold, paddingLeft: space.md, marginTop: space.lg, gap: 6 },
  affEyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  affText: { color: colors.ivory, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 17, lineHeight: 24 },
  line: { paddingVertical: space.sm, borderBottomColor: colors.rule, borderBottomWidth: StyleSheet.hairlineWidth, gap: 6 },
  lineTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 17 },
  lineMeta: { color: colors.greyMuted, fontSize: 12 },
  progress: { height: 2, backgroundColor: colors.rule },
  progressFill: { height: 2, backgroundColor: colors.gold },
  cardTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 19 },
});
