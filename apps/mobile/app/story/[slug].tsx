import { Link, Stack, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { Player } from '@/components/player';
import { Button, Centre, Loading, Muted } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { SITE_URL } from '@/lib/config';
import { getStory, isSaved, setSaved, type FullStory } from '@/lib/content';
import { useSession } from '@/lib/session';

/**
 * Story details: the cover, the title, who wrote it, the logline, and
 * the two doors: Read Now, Listen Instead. Keep and share sit in the
 * header. A locked story explains why and points to Premium or the
 * Bookshop on the website, where buying happens.
 */
export default function StoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [story, setStory] = useState<FullStory | null | undefined>(undefined);
  const [saved, setSavedState] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getStory(slug)
      .then(async (s) => {
        setStory(s);
        if (s && userId) setSavedState(await isSaved(s.id, userId).catch(() => false));
      })
      .catch((e) => setError((e as Error).message));
  }, [slug, userId]);

  if (error) return <Centre><Muted centre>{error}</Muted></Centre>;
  if (story === undefined) return <Loading />;
  if (story === null) return <Centre><Muted centre>This page has wandered off.</Muted></Centre>;

  const toggleSave = async () => {
    if (!userId) return router.push('/signin');
    const next = !saved;
    setSavedState(next);
    await setSaved(story.id, userId, next).catch(() => setSavedState(!next));
  };

  const share = () => Share.share({ message: `${story.title} — ${SITE_URL}/story/${story.slug}`, url: `${SITE_URL}/story/${story.slug}` });
  const isBook = story.access === 'paid' && story.product;

  return (
    <>
      <Stack.Screen
        options={{
          headerRight: () => (
            <View style={{ flexDirection: 'row', gap: 4 }}>
              <Pressable onPress={toggleSave} hitSlop={10} style={styles.hbtn}><Text style={[styles.hglyph, saved && { color: colors.gold }]}>{saved ? '▮' : '▯'}</Text></Pressable>
              <Pressable onPress={share} hitSlop={10} style={styles.hbtn}><Text style={styles.hglyph}>⇪</Text></Pressable>
            </View>
          ),
        }}
      />
      <ScrollView contentContainerStyle={styles.page}>
        {story.coverImage ? (
          <Image source={{ uri: story.coverImage }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverDrawn]}><Text style={{ color: colors.gold, fontSize: 40 }}>✦</Text></View>
        )}
        <View style={styles.body}>
          {story.shelf && <Text style={styles.shelf}>{story.shelf.toUpperCase()}</Text>}
          <Text style={styles.title}>{story.title}</Text>
          <Text style={styles.byline}>A Soulfables Original{story.author ? ` by ${story.author}` : ''}</Text>
          {story.subtitle && <Text style={styles.logline}>{story.subtitle}</Text>}
          <View style={styles.meta}>
            <Text style={styles.metaText}>◷ {story.readingMinutes} min</Text>
            {story.audio && <Text style={styles.metaText}>♪ Audio available</Text>}
            <Pressable onPress={toggleSave} hitSlop={8}><Text style={[styles.metaText, saved && { color: colors.gold }]}>{saved ? '▮ Saved' : '▯ Save'}</Text></Pressable>
          </View>

          {story.locked ? (
            <View style={styles.locked}>
              <Text style={styles.lockedTitle}>{isBook ? 'This story is a book.' : 'This story is kept for Premium.'}</Text>
              <Muted>
                {isBook
                  ? `Buy it once on soulfables.co for ${(story.product!.unitAmount / 100).toFixed(2)} ${story.product!.currency} and it opens here for good. Premium readers read it without buying.`
                  : 'Premium opens every story and narration. It is bought on soulfables.co and works here the moment it is on.'}
              </Muted>
              {!session && <Button label="Sign in" outline href="/signin" />}
              <Button label={isBook ? 'Open the Bookshop' : 'Premium on soulfables.co'} onPress={() => Linking.openURL(isBook ? `${SITE_URL}/shop/${story.product!.slug}` : `${SITE_URL}/membership`)} />
            </View>
          ) : (
            <>
              <Button label="Read Now" href={{ pathname: '/read/[slug]', params: { slug: story.slug } }} />
              {story.audio && !listening && <Button label="▶  Listen Instead" outline onPress={() => setListening(true)} />}
              {story.audio && listening && <Player slug={story.slug} audio={story.audio} signedIn={Boolean(session)} />}
            </>
          )}

          {session && !story.locked && (
            <Link href={{ pathname: '/(tabs)/journal' }} asChild>
              <Pressable style={{ paddingVertical: space.sm }}><Text style={styles.link}>What stayed with you? Write in the journal →</Text></Pressable>
            </Link>
          )}
        </View>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  page: { paddingBottom: space.xl * 2 },
  cover: { width: '100%', aspectRatio: 3 / 4, backgroundColor: colors.rule },
  coverDrawn: { alignItems: 'center', justifyContent: 'center' },
  body: { padding: space.lg, gap: space.sm, marginTop: -24, backgroundColor: colors.ink, borderTopLeftRadius: 24, borderTopRightRadius: 24 },
  shelf: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 30, lineHeight: 36 },
  byline: { color: colors.grey, fontSize: 13 },
  logline: { color: colors.ivory, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 16, lineHeight: 23, marginTop: 4 },
  meta: { flexDirection: 'row', gap: space.lg, marginVertical: space.sm },
  metaText: { color: colors.greyMuted, fontSize: 13 },
  locked: { backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 14, padding: space.md, gap: space.sm },
  lockedTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 20 },
  link: { color: colors.gold, fontSize: 14 },
  hbtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  hglyph: { color: colors.ivory, fontSize: 20 },
});
