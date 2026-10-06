import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Image, Linking, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Door, ErrorLine, Eyebrow, Muted, Title, timeAgo, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { downloadUrl, getMe, type Me } from '@/lib/api';
import { getStanding, listOwned, listReading, listSaved, type Owned, type ReadingRow, type SavedStory, type Standing } from '@/lib/account';
import { SITE_URL } from '@/lib/config';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * The reader's own page: who they are, where they stand, the books
 * they own, the stories they kept, and where they left off.
 *
 * Premium and books are bought on the website, not in the app: the
 * stores would take a share of every sale made inside it, so the app
 * reads what the reader owns and points to the site for the rest.
 */
export default function AccountScreen() {
  const { session } = useSession();
  const [me, setMe] = useState<Me | null>(null);
  const [standing, setStanding] = useState<Standing | null>(null);
  const [owned, setOwned] = useState<Owned[]>([]);
  const [saved, setSaved] = useState<SavedStory[]>([]);
  const [reading, setReading] = useState<ReadingRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!session) return;
    setError(null);
    const [m, st, ow, sv, rd] = await Promise.allSettled([getMe(), getStanding(), listOwned(), listSaved(), listReading()]);
    if (m.status === 'fulfilled') setMe(m.value);
    if (st.status === 'fulfilled') setStanding(st.value);
    if (ow.status === 'fulfilled') setOwned(ow.value);
    if (sv.status === 'fulfilled') setSaved(sv.value);
    if (rd.status === 'fulfilled') setReading(rd.value);
    const failed = [m, st, ow, sv, rd].find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
    if (failed) setError(String((failed.reason as Error)?.message ?? failed.reason));
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  if (!session) return <Door eyebrow="THE DOOR" line="Your shelf, your progress and your reflections are where you left them." />;

  const open = async (fileId: string) => {
    setOpening(fileId);
    try {
      const { url } = await downloadUrl(fileId);
      await Linking.openURL(url);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setOpening(null);
    }
  };

  const standingLine = standing?.staff
    ? 'Staff of the House. Every door is open.'
    : standing?.premium
      ? 'Premium. Every story and narration is open to you.'
      : `Free reader. ${Math.max(0, (standing?.allowance ?? 5) - (standing?.listens ?? 0))} of ${standing?.allowance ?? 5} free narrations left this month.`;

  return (
    <ScrollView
      contentContainerStyle={ui.page}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
    >
      <Eyebrow>YOUR SHELF</Eyebrow>
      <Title>{me?.displayName ?? session.user.email}</Title>
      <View style={styles.rows}>
        <Row label="Email" value={session.user.email ?? ''} />
        <Row label="Standing" value={standing?.staff ? 'Staff' : standing?.premium ? 'Premium' : 'Reader'} />
      </View>
      <Muted>{standingLine}</Muted>
      {!standing?.premium && !standing?.staff && (
        <Pressable onPress={() => Linking.openURL(`${SITE_URL}/membership`)}>
          <Text style={ui.link}>Premium on soulfables.co →</Text>
        </Pressable>
      )}
      <ErrorLine>{error}</ErrorLine>

      <Text style={ui.section}>Your books</Text>
      {owned.length === 0 ? (
        <>
          <Muted>Nothing bought yet. Books are bought on the website and open here the moment payment clears.</Muted>
          <Pressable onPress={() => Linking.openURL(`${SITE_URL}/shop`)}>
            <Text style={ui.link}>The Bookshop →</Text>
          </Pressable>
        </>
      ) : (
        owned.map((b) => (
          <View key={b.productId} style={[ui.card, styles.book]}>
            {b.coverImage ? <Image source={{ uri: b.coverImage }} style={styles.cover} /> : <View style={[styles.cover, styles.coverDrawn]}><Text style={{ color: colors.gold }}>✦</Text></View>}
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.bookTitle}>{b.title}</Text>
              {b.subtitle && <Text style={styles.bookSub}>{b.subtitle}</Text>}
              <Text style={styles.when}>since {timeAgo(b.grantedAt)}</Text>
              {b.stories.map((s) => (
                <Link key={s.slug} href={{ pathname: '/story/[slug]', params: { slug: s.slug } }} asChild>
                  <Pressable><Text style={ui.link}>Read “{s.title}” →</Text></Pressable>
                </Link>
              ))}
              <View style={styles.files}>
                {b.files.map((f) => (
                  <Button key={f.id} label={opening === f.id ? '…' : f.format} onPress={() => open(f.id)} disabled={opening !== null} style={styles.fileButton} />
                ))}
              </View>
            </View>
          </View>
        ))
      )}

      <Text style={ui.section}>Where you left off</Text>
      {reading.length === 0 && <Muted>Open a story and it will be waiting here.</Muted>}
      {reading.map((r) => (
        <Link key={r.slug} href={{ pathname: '/story/[slug]', params: { slug: r.slug } }} asChild>
          <Pressable style={styles.line}>
            <Text style={styles.lineTitle}>{r.title}</Text>
            <Text style={styles.when}>{r.completedAt ? 'finished' : 'opened'} · {timeAgo(r.lastReadAt)}</Text>
          </Pressable>
        </Link>
      ))}

      <Text style={ui.section}>The ones that stayed</Text>
      {saved.length === 0 && <Muted>Save a story from its page and it is kept here.</Muted>}
      {saved.map((s) => (
        <Link key={s.slug} href={{ pathname: '/story/[slug]', params: { slug: s.slug } }} asChild>
          <Pressable style={styles.line}>
            <Text style={styles.lineTitle}>{s.title}</Text>
            <Text style={styles.when}>☕ {s.readingMinutes} min</Text>
          </Pressable>
        </Link>
      ))}

      <Pressable onPress={() => Linking.openURL(`${SITE_URL}/account`)} style={{ marginTop: space.lg }}>
        <Text style={ui.link}>Settings, receipts and refunds on soulfables.co →</Text>
      </Pressable>
      <Button label="Sign out" onPress={() => supabase.auth.signOut()} style={{ marginTop: space.md }} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  rows: { borderColor: colors.rule, borderWidth: 1, borderRadius: 8, marginTop: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: space.md, borderBottomColor: colors.rule, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { color: colors.greyMuted },
  rowValue: { color: colors.ivory },
  book: { flexDirection: 'row', gap: space.md },
  cover: { width: 64, height: 90, borderRadius: 4, backgroundColor: colors.rule },
  coverDrawn: { alignItems: 'center', justifyContent: 'center' },
  bookTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 18 },
  bookSub: { color: colors.grey, fontSize: 13 },
  when: { color: colors.greyMuted, fontSize: 12 },
  files: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginTop: space.xs },
  fileButton: { paddingVertical: 6, paddingHorizontal: 12 },
  line: { paddingVertical: space.sm, borderBottomColor: colors.rule, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  lineTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 17 },
});
