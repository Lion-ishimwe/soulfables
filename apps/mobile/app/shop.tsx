import { useCallback, useEffect, useState } from 'react';
import { Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { StoryRow } from '@/components/story-row';
import { Button, ErrorLine, Eyebrow, Muted, SectionHead, Title, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { getStanding, type Standing } from '@/lib/account';
import { SITE_URL } from '@/lib/config';
import { listShopStories, type StoryCard } from '@/lib/content';
import { useSession } from '@/lib/session';

/**
 * The Bookshop: everything the Library does not hold. Stories kept for
 * Premium, and stories sold as books. Each opens its own page, which
 * says what it costs and where to get it; buying and joining happen on
 * soulfables.co, never inside the app.
 */
export default function ShopScreen() {
  const { session } = useSession();
  const [premium, setPremium] = useState<StoryCard[]>([]);
  const [books, setBooks] = useState<StoryCard[]>([]);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const all = await listShopStories();
      setPremium(all.filter((s) => s.access === 'premium'));
      setBooks(all.filter((s) => s.access === 'paid'));
      setStanding(session ? await getStanding().catch(() => null) : null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const isPremium = Boolean(standing?.premium || standing?.staff);

  return (
    <ScrollView
      contentContainerStyle={ui.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
    >
      <Eyebrow>THE BOOKSHOP</Eyebrow>
      <Title size={26}>Everything available to purchase and own.</Title>
      <Muted>Stories kept for Premium, and stories sold as books. The Library holds the free reading.</Muted>
      <ErrorLine>{error}</ErrorLine>

      <SectionHead title="Kept for Premium" />
      {isPremium ? (
        <Muted>Premium is on for you. Every one of these opens.</Muted>
      ) : (
        <View style={styles.note}>
          <Text style={styles.noteText}>Premium opens every story here and every narration in the House.</Text>
          <Button label="About Premium on soulfables.co" outline onPress={() => Linking.openURL(`${SITE_URL}/membership`)} />
        </View>
      )}
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        {premium.map((s) => <StoryRow key={s.id} item={s} />)}
        {premium.length === 0 && !error && <Muted>Nothing is kept for Premium just now.</Muted>}
      </View>

      <SectionHead title="Sold as books" />
      <Muted>Buy once on soulfables.co and the story opens here for good, with its files to keep.</Muted>
      <View style={{ gap: space.sm, marginTop: space.sm }}>
        {books.map((s) => <StoryRow key={s.id} item={s} />)}
        {books.length === 0 && !error && <Muted>No story is sold as a book just now.</Muted>}
      </View>

      <SectionHead title="Books, journals and collections" />
      <Pressable style={ui.card} onPress={() => Linking.openURL(`${SITE_URL}/shop`)}>
        <Text style={styles.cardTitle}>The full Bookshop on soulfables.co</Text>
        <Muted>Ebooks, journals and collections, in every format. What you buy appears under Your books in Account.</Muted>
        <Text style={ui.link}>Open the Bookshop →</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  note: { backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 14, padding: space.md, gap: space.sm },
  noteText: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 16, lineHeight: 23 },
  cardTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 18 },
});
