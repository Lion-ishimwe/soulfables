import { Link } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Image, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Chip, ErrorLine, Eyebrow, Title, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { listShelves, listStories, searchStories, type Shelf, type StoryCard } from '@/lib/content';

/**
 * The Library: every published story, newest first, with the shelves
 * as chips across the top and a search box that asks the same
 * full-text function the website's search page does.
 *
 * Whether this reader may open a story is decided on the story screen,
 * where the reason can be said properly. Here a Premium or for-sale
 * story only wears its badge.
 */
export default function LibraryScreen() {
  const [stories, setStories] = useState<StoryCard[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [shelf, setShelf] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StoryCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, sh] = await Promise.all([listStories(), listShelves()]);
      setStories(s);
      setShelves(sh);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Search runs a beat after the last keystroke, not on every one.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      searchStories(q).then(setResults).catch((e) => setError((e as Error).message));
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const shown = useMemo(() => {
    const base = results ?? stories;
    return shelf ? base.filter((s) => s.shelf?.slug === shelf) : base;
  }, [results, stories, shelf]);

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  return (
    <FlatList
      data={shown}
      keyExtractor={(s) => s.id}
      contentContainerStyle={styles.list}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.gold} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <Eyebrow>THE LIBRARY</Eyebrow>
          <Title size={26}>Everything worth reading, exploring or returning to.</Title>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search the shelves…"
            placeholderTextColor={colors.greyMuted}
            style={ui.input}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
          {shelves.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
              <Chip label="All" active={shelf === null} onPress={() => setShelf(null)} />
              {shelves.map((sh) => (
                <Chip
                  key={sh.id}
                  label={`${sh.emoji ? sh.emoji + ' ' : ''}${sh.label}`}
                  active={shelf === sh.slug}
                  onPress={() => setShelf(shelf === sh.slug ? null : sh.slug)}
                />
              ))}
            </ScrollView>
          )}
          <ErrorLine>{error}</ErrorLine>
        </View>
      }
      ListEmptyComponent={
        !error ? <Text style={styles.muted}>{results ? 'Nothing on the shelves answers to that.' : 'The shelves are being filled.'}</Text> : null
      }
      renderItem={({ item }) => <StoryRow item={item} />}
    />
  );
}

export function StoryRow({ item }: { item: StoryCard }) {
  return (
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
          {item.subtitle && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {item.subtitle}
            </Text>
          )}
          <View style={styles.row}>
            <Text style={styles.small}>☕ {item.readingMinutes} min</Text>
            {item.access === 'premium' && <Text style={styles.badge}>PREMIUM</Text>}
            {item.access === 'paid' && <Text style={styles.badge}>BOOK</Text>}
            {item.forSleep && <Text style={styles.small}>☾ sleep</Text>}
          </View>
        </View>
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.md, paddingBottom: space.xl, gap: space.md },
  header: { paddingVertical: space.md, gap: space.md },
  chips: { gap: space.sm, paddingVertical: 2 },
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
