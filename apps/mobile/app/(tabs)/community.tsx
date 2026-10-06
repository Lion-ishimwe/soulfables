import { Link } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Modal, Pressable, RefreshControl, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, ErrorLine, Eyebrow, Muted, Title, timeAgo, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { REACTIONS, listMyPending, listPosts, submitPost, type Post } from '@/lib/community';
import { useSession } from '@/lib/session';

/**
 * The Community wall. Published reflections, newest first; a reader's
 * own words waiting for review sit at the top, marked so. A new post
 * goes in as pending and is read by a person before the wall shows it.
 */
export default function CommunityScreen() {
  const { session } = useSession();
  const [posts, setPosts] = useState<Post[]>([]);
  const [mine, setMine] = useState<Post[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [composing, setComposing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, m] = await Promise.all([listPosts(), session ? listMyPending(session.user.id) : Promise.resolve([])]);
      setPosts(p);
      setMine(m);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <>
      <FlatList
        data={[...mine, ...posts]}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
        ListHeaderComponent={
          <View style={styles.header}>
            <Eyebrow>THE COMMUNITY</Eyebrow>
            <Title size={26}>Readers, writing back.</Title>
            <Muted>Every post is read by a person before the wall shows it. Nothing here is advice.</Muted>
            {session ? <Button label="Write to the wall" onPress={() => setComposing(true)} /> : <Button label="Sign in to write" href="/signin" />}
            <ErrorLine>{error}</ErrorLine>
          </View>
        }
        ListEmptyComponent={!error ? <Muted>The wall is quiet for now.</Muted> : null}
        renderItem={({ item }) => <PostCard post={item} />}
      />
      {session && <Compose visible={composing} onClose={() => setComposing(false)} userId={session.user.id} onDone={load} />}
    </>
  );
}

export function PostCard({ post }: { post: Post }) {
  const pending = post.status !== 'published';
  return (
    <Link href={{ pathname: '/community/[id]', params: { id: post.id } }} asChild>
      <Pressable style={({ pressed }) => [ui.card, pending && styles.pending, pressed && { opacity: 0.85 }]}>
        <View style={styles.cardHead}>
          <Text style={styles.author}>{post.authorName}</Text>
          <Text style={styles.when}>{pending ? post.status.toUpperCase() : timeAgo(post.publishedAt ?? post.createdAt)}</Text>
        </View>
        {post.title && <Text style={styles.postTitle}>{post.title}</Text>}
        <Text style={styles.body} numberOfLines={6}>
          {post.body}
        </Text>
        {pending ? (
          <Text style={styles.when}>{post.status === 'pending' ? 'Waiting for a person to read it. Only you can see it here.' : 'Not shown on the wall.'}</Text>
        ) : (
          <View style={styles.counts}>
            {REACTIONS.map((r) => (
              <Text key={r.kind} style={styles.count}>
                {r.glyph} {post.reactions[r.kind]}
              </Text>
            ))}
            <Text style={styles.count}>✎ {post.replies}</Text>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

function Compose({ visible, onClose, userId, onDone }: { visible: boolean; onClose: () => void; userId: string; onDone: () => Promise<void> }) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const send = async () => {
    if (body.trim().length < 20) {
      setError('A few more words, so the wall has something to hold.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await submitPost({ userId, title, body, anonymous });
      setTitle('');
      setBody('');
      onClose();
      await onDone();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.sheet}>
        <Eyebrow>TO THE WALL</Eyebrow>
        <Title size={24}>Say the true thing.</Title>
        <TextInput value={title} onChangeText={setTitle} placeholder="A title, if it wants one" placeholderTextColor={colors.greyMuted} style={ui.input} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="What has a story, or a night, left with you?"
          placeholderTextColor={colors.greyMuted}
          multiline
          style={[ui.input, styles.editor]}
          textAlignVertical="top"
        />
        <View style={styles.switchRow}>
          <Text style={styles.switchLabel}>Post without my name</Text>
          <Switch value={anonymous} onValueChange={setAnonymous} trackColor={{ true: colors.gold, false: colors.rule }} thumbColor={colors.ivory} />
        </View>
        <Muted>A person at the House reads every post before it appears. That can take a day.</Muted>
        <ErrorLine>{error}</ErrorLine>
        <View style={styles.sheetActions}>
          <Button label="Not now" onPress={onClose} />
          <Button label={busy ? 'Sending…' : 'Send to the House'} solid disabled={busy} onPress={send} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  list: { padding: space.md, paddingBottom: space.xl, gap: space.md },
  header: { paddingVertical: space.md, gap: space.md },
  pending: { borderColor: colors.gold, borderStyle: 'dashed' },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  author: { color: colors.gold, fontSize: 12, letterSpacing: 1 },
  when: { color: colors.greyMuted, fontSize: 12 },
  postTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 19, lineHeight: 24 },
  body: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 16, lineHeight: 24 },
  counts: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  count: { color: colors.greyMuted, fontSize: 13 },
  sheet: { flex: 1, backgroundColor: colors.ink, padding: space.lg, gap: space.md },
  editor: { minHeight: 160, lineHeight: 24, fontFamily: 'Georgia' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: colors.ivory, fontSize: 15 },
  sheetActions: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, marginTop: 'auto' },
});
