import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Centre, ErrorLine, Loading, Muted, timeAgo, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { REACTIONS, getPost, submitReply, toggleReaction, type Post, type ReactionKind, type Reply } from '@/lib/community';
import { useSession } from '@/lib/session';

/**
 * One post, whole, with its reactions and replies. A reaction is a
 * single tap and can be taken back; a reply waits for review like a
 * post does, and shows its author "pending" until then.
 */
export default function PostScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { session } = useSession();
  const userId = session?.user.id ?? null;
  const [post, setPost] = useState<Post | null | undefined>(undefined);
  const [mine, setMine] = useState<ReactionKind[]>([]);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [reply, setReply] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const r = await getPost(id, userId);
      setPost(r?.post ?? null);
      setMine(r?.mine ?? []);
      setReplies(r?.replies ?? []);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id, userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (post === undefined) return <Loading />;
  if (post === null)
    return (
      <Centre>
        <Muted centre>This post is not on the wall.</Muted>
      </Centre>
    );

  const react = async (kind: ReactionKind) => {
    if (!session) return;
    const on = !mine.includes(kind);
    setMine((m) => (on ? [...m, kind] : m.filter((k) => k !== kind)));
    setPost((p) => (p ? { ...p, reactions: { ...p.reactions, [kind]: Math.max(0, p.reactions[kind] + (on ? 1 : -1)) } } : p));
    try {
      await toggleReaction(post.id, session.user.id, kind, on);
    } catch (e) {
      setError((e as Error).message);
      load();
    }
  };

  const send = async () => {
    if (!session || reply.trim().length < 2) return;
    setBusy(true);
    try {
      await submitReply({ userId: session.user.id, postId: post.id, body: reply });
      setReply('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
      <Stack.Screen options={{ title: post.authorName }} />
      <ScrollView contentContainerStyle={ui.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.when}>{timeAgo(post.publishedAt ?? post.createdAt)}</Text>
        {post.title && <Text style={styles.title}>{post.title}</Text>}
        <Text style={styles.body}>{post.body}</Text>

        {post.status === 'published' && (
          <View style={styles.reactions}>
            {REACTIONS.map((r) => {
              const on = mine.includes(r.kind);
              return (
                <Pressable key={r.kind} onPress={() => react(r.kind)} disabled={!session} style={[styles.reaction, on && styles.reactionOn]}>
                  <Text style={[styles.reactionText, on && { color: colors.gold }]}>
                    {r.glyph} {r.label} · {post.reactions[r.kind]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        )}
        {!session && post.status === 'published' && <Muted>Sign in to leave a mark or a reply.</Muted>}
        <ErrorLine>{error}</ErrorLine>

        <Text style={ui.section}>Replies</Text>
        {replies.length === 0 && <Muted>No one has written back yet.</Muted>}
        {replies.map((r) => (
          <View key={r.id} style={[ui.card, r.status !== 'published' && styles.pending]}>
            <View style={styles.replyHead}>
              <Text style={styles.author}>{r.authorName}</Text>
              <Text style={styles.when}>{r.status !== 'published' ? r.status.toUpperCase() : timeAgo(r.createdAt)}</Text>
            </View>
            <Text style={styles.replyBody}>{r.body}</Text>
          </View>
        ))}

        {session && post.status === 'published' && (
          <View style={{ gap: space.sm, marginTop: space.md }}>
            <TextInput
              value={reply}
              onChangeText={setReply}
              placeholder="Write back…"
              placeholderTextColor={colors.greyMuted}
              multiline
              style={[ui.input, { minHeight: 90, fontFamily: 'Georgia', lineHeight: 22 }]}
              textAlignVertical="top"
            />
            <Button label={busy ? 'Sending…' : 'Reply'} solid disabled={busy || reply.trim().length < 2} onPress={send} />
            <Muted>A person reads each reply before it is shown.</Muted>
          </View>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  when: { color: colors.greyMuted, fontSize: 12 },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 26, lineHeight: 32 },
  body: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 18, lineHeight: 29, marginTop: space.sm },
  reactions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.md },
  reaction: { borderColor: colors.rule, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 12, backgroundColor: colors.inkRaised },
  reactionOn: { borderColor: colors.gold },
  reactionText: { color: colors.grey, fontSize: 13 },
  pending: { borderColor: colors.gold, borderStyle: 'dashed' },
  replyHead: { flexDirection: 'row', justifyContent: 'space-between' },
  author: { color: colors.gold, fontSize: 12, letterSpacing: 1 },
  replyBody: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 16, lineHeight: 24 },
});
