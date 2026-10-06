import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Player } from '@/components/player';
import { RichText } from '@/components/rich-text';
import { Button, Centre, Loading, Muted } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { SITE_URL } from '@/lib/config';
import { getStory, isSaved, markProgress, setSaved, type FullStory } from '@/lib/content';
import { useSession } from '@/lib/session';

/**
 * A story, read.
 *
 * story_for_reader decides everything: whether the body comes, whether
 * the narration may play, and why not when not. The screen only says
 * it in words and offers the door that fits: sign in, Premium on the
 * site, or the book in the Bookshop.
 *
 * Opening a story marks it opened; reaching the end marks it finished,
 * so the Account page and the website agree on where the reader is.
 */
export default function StoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [story, setStory] = useState<FullStory | null | undefined>(undefined);
  const [saved, setSavedState] = useState(false);
  const [finished, setFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getStory(slug)
      .then(async (s) => {
        setStory(s);
        if (s && userId) {
          setSavedState(await isSaved(s.id, userId).catch(() => false));
          if (!s.locked) markProgress(s.id, userId, false).catch(() => {});
        }
      })
      .catch((e) => setError((e as Error).message));
  }, [slug, userId]);

  if (error)
    return (
      <Centre>
        <Muted centre>{error}</Muted>
      </Centre>
    );
  if (story === undefined) return <Loading />;
  if (story === null)
    return (
      <Centre>
        <Muted centre>This page has wandered off.</Muted>
      </Centre>
    );

  const toggleSave = async () => {
    if (!session) return;
    const next = !saved;
    setSavedState(next);
    await setSaved(story.id, session.user.id, next).catch(() => setSavedState(!next));
  };

  const onScrollEnd = (e: { nativeEvent: { layoutMeasurement: { height: number }; contentOffset: { y: number }; contentSize: { height: number } } }) => {
    if (finished || !session || story.locked) return;
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    if (layoutMeasurement.height + contentOffset.y >= contentSize.height - 80) {
      setFinished(true);
      markProgress(story.id, session.user.id, true).catch(() => {});
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: story.shelf ? story.shelf.toUpperCase() : '',
          headerRight: session
            ? () => (
                <Pressable onPress={toggleSave} hitSlop={12}>
                  <Text style={[styles.save, saved && { color: colors.gold }]}>{saved ? '★ Kept' : '☆ Keep'}</Text>
                </Pressable>
              )
            : undefined,
        }}
      />
      <ScrollView contentContainerStyle={styles.page} onScroll={onScrollEnd} scrollEventThrottle={400}>
        {story.coverImage && <Image source={{ uri: story.coverImage }} style={styles.cover} />}
        <Text style={styles.title}>{story.title}</Text>
        {story.subtitle && <Text style={styles.subtitle}>{story.subtitle}</Text>}
        <Text style={styles.meta}>
          {story.author ? `${story.author} · ` : ''}☕ {story.readingMinutes} min
        </Text>

        {story.audio && <Player slug={story.slug} audio={story.audio} signedIn={Boolean(session)} />}

        {story.locked ? (
          <Locked story={story} signedIn={Boolean(session)} />
        ) : (
          <View style={styles.body}>
            <RichText markdown={story.body ?? ''} dropTitle={story.title} />
            <Text style={styles.end}>✦</Text>
            {session && (
              <View style={styles.after}>
                <Button label="Write about it" href={{ pathname: '/(tabs)/journal' }} />
              </View>
            )}
          </View>
        )}
      </ScrollView>
    </>
  );
}

function Locked({ story, signedIn }: { story: FullStory; signedIn: boolean }) {
  const isBook = story.access === 'paid' && story.product;
  return (
    <View style={styles.locked}>
      <Text style={styles.lockedTitle}>{isBook ? 'This story is a book.' : 'This story is kept for Premium.'}</Text>
      <Text style={styles.lockedText}>
        {isBook
          ? `Buy it once on soulfables.co for ${(story.product!.unitAmount / 100).toFixed(2)} ${story.product!.currency} and it opens here for good. Premium readers read it without buying.`
          : 'Premium opens every story and narration. It is bought on soulfables.co and works here the moment it is on.'}
      </Text>
      {!signedIn && (
        <Link href="/signin" asChild>
          <Pressable style={styles.button}>
            <Text style={styles.buttonText}>SIGN IN</Text>
          </Pressable>
        </Link>
      )}
      <Pressable style={styles.button} onPress={() => Linking.openURL(isBook ? `${SITE_URL}/shop/${story.product!.slug}` : `${SITE_URL}/membership`)}>
        <Text style={styles.buttonText}>{isBook ? 'OPEN THE BOOKSHOP' : 'PREMIUM ON SOULFABLES.CO'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.sm },
  cover: { width: '100%', aspectRatio: 3 / 4, borderRadius: 6, marginBottom: space.md, backgroundColor: colors.rule },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 32, lineHeight: 38 },
  subtitle: { color: colors.grey, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 18, lineHeight: 24 },
  meta: { color: colors.greyMuted, fontSize: 13, marginBottom: space.md },
  save: { color: colors.grey, fontSize: 14, paddingHorizontal: space.sm },
  body: { marginTop: space.md },
  end: { color: colors.gold, textAlign: 'center', fontSize: 18, marginTop: space.lg },
  after: { alignItems: 'center', marginTop: space.lg },
  locked: { borderColor: colors.rule, borderWidth: 1, padding: space.lg, gap: space.md, marginTop: space.md, backgroundColor: colors.inkRaised },
  lockedTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 22 },
  lockedText: { color: colors.grey, lineHeight: 22 },
  button: { borderColor: colors.gold, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 20 },
  buttonText: { color: colors.gold, letterSpacing: 3, fontSize: 12, textAlign: 'center' },
});
