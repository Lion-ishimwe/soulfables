import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Player } from '@/components/player';
import { colors, space } from '@/constants/theme';
import { SITE_URL } from '@/lib/config';
import { getStory, splitSections, type FullStory } from '@/lib/content';
import { useSession } from '@/lib/session';

/**
 * A story, read.
 *
 * story_for_reader decides everything: whether the body comes, whether
 * the narration may play, and why not when not. The screen only says
 * it in words and offers the door that fits: sign in, Premium on the
 * site, or the book in the Bookshop.
 */
export default function StoryScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { session } = useSession();
  const [story, setStory] = useState<FullStory | null | undefined>(undefined);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getStory(slug).then(setStory).catch((e) => setError((e as Error).message));
  }, [slug, session?.user.id]);

  if (error) return <Centre text={error} />;
  if (story === undefined) return <Centre text="Opening…" />;
  if (story === null) return <Centre text="This page has wandered off." />;

  const sections = story.body ? splitSections(story.body) : [];

  return (
    <>
      <Stack.Screen options={{ title: story.shelf ? story.shelf.toUpperCase() : '' }} />
      <ScrollView contentContainerStyle={styles.page}>
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
            {sections.map((sec, i) => (
              <View key={i} style={styles.section}>
                {sec.heading && <Text style={styles.heading}>{sec.heading}</Text>}
                {sec.paragraphs.map((p, j) => (
                  <Text key={j} style={styles.paragraph}>{p}</Text>
                ))}
              </View>
            ))}
            <Text style={styles.end}>✦</Text>
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
          <Pressable style={styles.button}><Text style={styles.buttonText}>SIGN IN</Text></Pressable>
        </Link>
      )}
      <Pressable style={styles.button} onPress={() => Linking.openURL(isBook ? `${SITE_URL}/shop/${story.product!.slug}` : `${SITE_URL}/membership`)}>
        <Text style={styles.buttonText}>{isBook ? 'OPEN THE BOOKSHOP' : 'PREMIUM ON SOULFABLES.CO'}</Text>
      </Pressable>
    </View>
  );
}

function Centre({ text }: { text: string }) {
  return (
    <View style={styles.centre}>
      <Text style={styles.muted}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.sm },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl },
  muted: { color: colors.greyMuted, textAlign: 'center' },
  cover: { width: '100%', aspectRatio: 3 / 4, borderRadius: 6, marginBottom: space.md, backgroundColor: colors.rule },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 32, lineHeight: 38 },
  subtitle: { color: colors.grey, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 18, lineHeight: 24 },
  meta: { color: colors.greyMuted, fontSize: 13, marginBottom: space.md },
  body: { gap: space.lg, marginTop: space.md },
  section: { gap: space.md },
  heading: { color: colors.gold, fontFamily: 'Georgia', fontSize: 20, marginTop: space.sm },
  paragraph: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 18, lineHeight: 30 },
  end: { color: colors.gold, textAlign: 'center', fontSize: 18, marginTop: space.lg },
  locked: { borderColor: colors.rule, borderWidth: 1, padding: space.lg, gap: space.md, marginTop: space.md, backgroundColor: colors.inkRaised },
  lockedTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 22 },
  lockedText: { color: colors.grey, lineHeight: 22 },
  button: { borderColor: colors.gold, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 20 },
  buttonText: { color: colors.gold, letterSpacing: 3, fontSize: 12, textAlign: 'center' },
});
