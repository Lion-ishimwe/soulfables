import { Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { RichText } from '@/components/rich-text';
import { Button, Centre, Loading, Muted } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { getStory, markProgress, type FullStory } from '@/lib/content';
import { getFontSize, setFontSize } from '@/lib/prefs';
import { useSession } from '@/lib/session';

const SIZES = [16, 18, 20, 22, 24];

/**
 * The reading view: the text, nothing else. "Aa" steps the size; the
 * line at the bottom shows how far along the reader is and the minutes
 * left; progress is kept the way the website keeps it, so the two agree.
 */
export default function ReadScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [story, setStory] = useState<FullStory | null | undefined>(undefined);
  const [size, setSize] = useState(18);
  const [percent, setPercent] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const lastSaved = useRef(0);

  useEffect(() => {
    getFontSize().then(setSize);
    if (!slug) return;
    getStory(slug)
      .then((s) => {
        setStory(s);
        if (s && !s.locked && userId) markProgress(s.id, userId, 0.01).catch(() => {});
      })
      .catch((e) => setError((e as Error).message));
  }, [slug, userId]);

  if (error) return <Centre><Muted centre>{error}</Muted></Centre>;
  if (story === undefined) return <Loading />;
  if (story === null || story.locked || !story.body) {
    return (
      <Centre>
        <Muted centre>This story is not open to read here.</Muted>
        <Button label="Back" outline onPress={() => router.back()} />
      </Centre>
    );
  }

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    const p = Math.min(1, Math.max(0, (contentOffset.y + layoutMeasurement.height) / Math.max(1, contentSize.height)));
    setPercent(p);
    if (userId && (p - lastSaved.current > 0.1 || (p >= 0.98 && lastSaved.current < 0.98))) {
      lastSaved.current = p;
      markProgress(story.id, userId, p).catch(() => {});
    }
  };

  const stepSize = () => {
    const next = SIZES[(SIZES.indexOf(size) + 1) % SIZES.length];
    setSize(next);
    setFontSize(next);
  };

  const minutesLeft = Math.max(0, Math.ceil(story.readingMinutes * (1 - percent)));

  return (
    <>
      <Stack.Screen
        options={{
          title: story.title,
          headerTitleStyle: { fontFamily: 'Georgia', fontSize: 16 },
          headerRight: () => (
            <Pressable onPress={stepSize} hitSlop={10} style={styles.hbtn}><Text style={styles.aa}>Aa</Text></Pressable>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.page} onScroll={onScroll} scrollEventThrottle={250}>
        {story.subtitle && <Text style={styles.sub}>{story.subtitle}</Text>}
        <RichText markdown={story.body} size={size} dropTitle={story.title} />
        <Text style={styles.end}>✦</Text>
        <View style={styles.after}>
          <Text style={styles.afterQ}>What stayed with you?</Text>
          {session ? (
            <Button label="Write a reflection" href={{ pathname: '/(tabs)/journal' }} />
          ) : (
            <Button label="Sign in to write a reflection" outline href="/signin" />
          )}
        </View>
      </ScrollView>
      <View style={styles.footer}>
        <View style={styles.bar}><View style={[styles.fill, { width: `${Math.round(percent * 100)}%` }]} /></View>
        <View style={styles.footerRow}>
          <Text style={styles.footerText}>{Math.round(percent * 100)}%</Text>
          <Text style={styles.footerText}>{minutesLeft} min left</Text>
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: space.xl * 2 },
  sub: { color: colors.grey, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 17, lineHeight: 24, marginBottom: space.lg, textAlign: 'center' },
  end: { color: colors.gold, textAlign: 'center', fontSize: 18, marginTop: space.xl },
  after: { marginTop: space.xl, gap: space.md, alignItems: 'stretch' },
  afterQ: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 22, textAlign: 'center' },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.lg, backgroundColor: colors.ink, borderTopColor: colors.rule, borderTopWidth: StyleSheet.hairlineWidth, gap: 6 },
  bar: { height: 3, backgroundColor: colors.rule, borderRadius: 2 },
  fill: { height: 3, backgroundColor: colors.gold, borderRadius: 2 },
  footerRow: { flexDirection: 'row', justifyContent: 'space-between' },
  footerText: { color: colors.greyMuted, fontSize: 12 },
  hbtn: { paddingHorizontal: 8, paddingVertical: 4 },
  aa: { color: colors.ivory, fontSize: 16, fontFamily: 'Georgia' },
});
