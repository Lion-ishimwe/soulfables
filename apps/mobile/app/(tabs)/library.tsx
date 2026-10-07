import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { ScreenHeader } from '@/components/screen-header';
import { StoryRow } from '@/components/story-row';
import { ErrorLine, Muted, Pill, SectionHead, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { listSeries, listShelves, listStories, savedIds, searchStories, setSaved, type Series, type Shelf, type StoryCard } from '@/lib/content';
import { useSession } from '@/lib/session';

type Filter = 'all' | 'stories' | 'audio' | 'series';
type Sort = 'newest' | 'shortest' | 'title';

/**
 * The Library: the whole catalogue, browsed by feeling (the shelves),
 * by kind (stories, with audio, series), searched with the website's
 * own full-text search, and sorted.
 */
export default function LibraryScreen() {
  const params = useLocalSearchParams<{ search?: string; shelf?: string }>();
  const { session } = useSession();
  const [stories, setStories] = useState<StoryCard[]>([]);
  const [shelves, setShelves] = useState<Shelf[]>([]);
  const [series, setSeries] = useState<Series[]>([]);
  const [saved, setSavedSet] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<Filter>('all');
  const [shelf, setShelf] = useState<string | null>(params.shelf ?? null);
  const [sort, setSort] = useState<Sort>('newest');
  const [searching, setSearching] = useState(Boolean(params.search));
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<StoryCard[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    if (params.search) setSearching(true);
    if (params.shelf) setShelf(params.shelf);
  }, [params.search, params.shelf]);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [s, sh, se, kept] = await Promise.all([listStories(), listShelves(), listSeries(), session ? savedIds() : Promise.resolve(new Set<string>())]);
      setStories(s);
      setShelves(sh);
      setSeries(se);
      setSavedSet(kept);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => searchStories(q).then(setResults).catch((e) => setError((e as Error).message)), 300);
    return () => clearTimeout(t);
  }, [query]);

  const shown = useMemo(() => {
    let list = results ?? stories;
    if (shelf) list = list.filter((s) => s.shelf?.slug === shelf);
    if (filter === 'audio') list = list.filter((s) => s.hasAudio);
    if (filter === 'series') list = list.filter((s) => s.series);
    if (filter === 'stories') list = list.filter((s) => !s.series);
    if (!results) {
      list = [...list].sort((a, b) =>
        sort === 'shortest' ? a.readingMinutes - b.readingMinutes : sort === 'title' ? a.title.localeCompare(b.title) : (b.publishedAt ?? '').localeCompare(a.publishedAt ?? ''),
      );
    }
    return list;
  }, [results, stories, shelf, filter, sort]);

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

  const cycleSort = () => setSort(sort === 'newest' ? 'shortest' : sort === 'shortest' ? 'title' : 'newest');
  const sortLabel = sort === 'newest' ? 'Newest' : sort === 'shortest' ? 'Shortest' : 'A to Z';

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <ScreenHeader title="Library" actions={[{ glyph: searching ? '✕' : '⌕', label: 'Search', onPress: () => { setSearching((v) => !v); setQuery(''); } }]}>
        {searching && (
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search title, author, theme, a line you remember…"
            placeholderTextColor={colors.greyMuted}
            style={ui.input}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
          />
        )}
        <View style={ui.tabs}>
          {(
            [
              ['all', 'All'],
              ['stories', 'Stories'],
              ['audio', 'Audio'],
              ['series', 'Series'],
            ] as [Filter, string][]
          ).map(([k, label]) => (
            <Pill key={k} label={label} active={filter === k} onPress={() => setFilter(k)} />
          ))}
        </View>
      </ScreenHeader>
      <FlatList
        data={shown}
        keyExtractor={(s) => s.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
        ListHeaderComponent={
          <View>
            <ErrorLine>{error}</ErrorLine>
            {!results && filter !== 'series' && (
              <>
                <SectionHead title="Browse by Feeling" action={shelf ? 'Clear' : undefined} onAction={() => setShelf(null)} />
                <View style={styles.grid}>
                  {shelves.map((sh) => (
                    <Pressable key={sh.id} onPress={() => setShelf(shelf === sh.slug ? null : sh.slug)} style={[styles.tile, shelf === sh.slug && styles.tileOn]}>
                      <Text style={styles.tileEmoji}>{sh.emoji ?? '✦'}</Text>
                      <Text style={[styles.tileLabel, shelf === sh.slug && { color: colors.gold }]}>{sh.label}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            )}
            {!results && filter === 'series' && series.length > 0 && (
              <>
                <SectionHead title="Series" />
                {series.map((se) => (
                  <View key={se.id} style={[ui.card, { marginBottom: space.sm }]}>
                    <Text style={styles.seriesTitle}>{se.title}</Text>
                    {se.description && <Muted>{se.description}</Muted>}
                  </View>
                ))}
              </>
            )}
            <View style={styles.listHead}>
              <Text style={ui.section}>{results ? 'Found on the shelves' : shelf ? (shelves.find((s) => s.slug === shelf)?.label ?? 'Stories') : filter === 'audio' ? 'With narration' : filter === 'series' ? 'Chapters' : 'All Stories'}</Text>
              {!results && (
                <Pressable onPress={cycleSort} hitSlop={8}>
                  <Text style={ui.sectionAction}>Sort: {sortLabel} ⌄</Text>
                </Pressable>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={!error ? <Muted>{results ? 'Nothing on the shelves answers to that.' : 'The shelves are being filled.'}</Muted> : null}
        renderItem={({ item }) => <StoryRow item={item} saved={saved.has(item.id)} onSave={() => toggleSave(item)} />}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: { width: '31%', flexGrow: 1, backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 12, paddingVertical: space.md, alignItems: 'center', gap: 6 },
  tileOn: { borderColor: colors.gold },
  tileEmoji: { fontSize: 20 },
  tileLabel: { color: colors.grey, fontSize: 12 },
  listHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.lg, marginBottom: space.sm },
  seriesTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 18 },
});
