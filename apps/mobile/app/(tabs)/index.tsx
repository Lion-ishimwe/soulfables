import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/constants/theme';
import { listStories, type StoryCard } from '@/lib/content';

/**
 * The Library: every published story, newest first.
 *
 * Read straight from the database under the same rules as the site.
 * A Premium or for-sale story is shown with its badge; whether this
 * reader may open it is decided on the story screen, where the reason
 * can be said properly.
 */
export default function LibraryScreen() {
  const [stories, setStories] = useState<StoryCard[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      setStories(await listStories());
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <FlatList
      data={stories}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Text style={styles.eyebrow}>THE LIBRARY</Text>
          <Text style={styles.title}>Find the one that meets you where you are.</Text>
          {error && <Text style={styles.error}>{error}</Text>}
        </View>
      }
      ListEmptyComponent={!error ? <Text style={styles.muted}>The shelves are being filled.</Text> : null}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/story/[slug]', params: { slug: item.slug } }} asChild>
          <Pressable style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
            {item.coverImage ? (
              <Image source={{ uri: item.coverImage }} style={styles.cover} />
            ) : (
              <View style={[styles.cover, styles.coverDrawn]}>
                <Text style={styles.coverStar}>✦</Text>
              </View>
            )}
            <View style={styles.meta}>
              {item.shelf && <Text style={styles.shelf}>{item.shelf.title.toUpperCase()}</Text>}
              <Text style={styles.cardTitle}>{item.title}</Text>
              {item.subtitle && <Text style={styles.subtitle} numberOfLines={2}>{item.subtitle}</Text>}
              <View style={styles.row}>
                <Text style={styles.small}>☕ {item.readingMinutes} min</Text>
                {item.access === 'premium' && <Text style={styles.badge}>PREMIUM</Text>}
                {item.access === 'paid' && <Text style={styles.badge}>BOOK</Text>}
                {item.forSleep && <Text style={styles.small}>☾ sleep</Text>}
              </View>
            </View>
          </Pressable>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: space.md, paddingBottom: space.xl, gap: space.md },
  header: { paddingVertical: space.md, gap: space.sm },
  eyebrow: { color: colors.gold, fontSize: 11, letterSpacing: 3 },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 26, lineHeight: 32 },
  error: { color: colors.danger, marginTop: space.sm },
  muted: { color: colors.greyMuted, padding: space.md },
  card: { flexDirection: 'row', gap: space.md, backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 8, padding: space.sm },
  cover: { width: 84, height: 120, borderRadius: 4, backgroundColor: colors.rule },
  coverDrawn: { alignItems: 'center', justifyContent: 'center' },
  coverStar: { color: colors.gold, fontSize: 22 },
  meta: { flex: 1, gap: 4, justifyContent: 'center' },
  shelf: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  cardTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 19, lineHeight: 24 },
  subtitle: { color: colors.grey, fontSize: 13, lineHeight: 18 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: 4 },
  small: { color: colors.greyMuted, fontSize: 12 },
  badge: { color: colors.gold, fontSize: 10, letterSpacing: 2, borderColor: colors.gold, borderWidth: 1, paddingHorizontal: 6, paddingVertical: 1 },
});
