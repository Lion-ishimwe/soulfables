import { Link, router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { FlatList, Pressable, RefreshControl, Share, StyleSheet, Text, View } from 'react-native';
import { ComposePost } from '@/components/compose-post';
import { ScreenHeader } from '@/components/screen-header';
import { Avatar, Button, ErrorLine, Muted, Tabs, timeAgo, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { SITE_URL } from '@/lib/config';
import { getActiveChallenge, listChallenges, listMyPending, listPosts, type Challenge, type Post } from '@/lib/community';
import { useSession } from '@/lib/session';

type Tab = 'foryou' | 'latest' | 'challenges';

/**
 * Residents: the people inside the House.
 *
 * Published reflections and stories, the House's challenge with its
 * prompt, and the list of challenges. A reader's own words waiting for
 * review sit at the top, marked so. Nothing is shown until a person at
 * the House has read it.
 */
export default function ResidentsScreen() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>('foryou');
  const [posts, setPosts] = useState<Post[]>([]);
  const [mine, setMine] = useState<Post[]>([]);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [active, setActive] = useState<Challenge | null>(null);
  const [composing, setComposing] = useState<{ challenge: Challenge | null } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, m, c, a] = await Promise.all([listPosts(), session ? listMyPending(session.user.id) : Promise.resolve([]), listChallenges(), getActiveChallenge()]);
      setPosts(p);
      setMine(m);
      setChallenges(c);
      setActive(a);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  const write = (challenge: Challenge | null) => {
    if (!session) return router.push('/signin');
    setComposing({ challenge });
  };

  const data: (Post | { id: string; kind: 'prompt' } | { id: string; kind: 'challenge'; challenge: Challenge })[] =
    tab === 'challenges'
      ? challenges.map((c) => ({ id: c.id, kind: 'challenge' as const, challenge: c }))
      : tab === 'foryou'
        ? [...mine, ...posts.slice(0, 1), ...(active ? [{ id: 'prompt', kind: 'prompt' as const }] : []), ...posts.slice(1)]
        : [...mine, ...posts];

  return (
    <View style={{ flex: 1, backgroundColor: colors.ink }}>
      <ScreenHeader title="Residents" actions={[{ glyph: '✎', label: 'Write', onPress: () => write(null) }]}>
        <Tabs
          items={[
            { key: 'foryou', label: 'For You' },
            { key: 'latest', label: 'Latest' },
            { key: 'challenges', label: 'Challenges' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </ScreenHeader>
      <FlatList
        data={data}
        keyExtractor={(p) => p.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
        ListHeaderComponent={<ErrorLine>{error}</ErrorLine>}
        ListEmptyComponent={!error ? <Muted>{tab === 'challenges' ? 'No challenge is open just now.' : 'The wall is quiet for now. You are not the only one carrying a story.'}</Muted> : null}
        ItemSeparatorComponent={() => <View style={{ height: space.sm }} />}
        renderItem={({ item }) => {
          if ('kind' in item && item.kind === 'prompt' && active) return <PromptCard challenge={active} onWrite={() => write(active)} />;
          if ('kind' in item && item.kind === 'challenge') {
            const c = (item as { challenge: Challenge }).challenge;
            return <ChallengeCard challenge={c} onWrite={() => write(c)} />;
          }
          return <PostCard post={item as Post} />;
        }}
      />
      {session && composing && <ComposePost visible onClose={() => setComposing(null)} userId={session.user.id} onDone={load} challenge={composing.challenge} />}
    </View>
  );
}

function PromptCard({ challenge, onWrite }: { challenge: Challenge; onWrite: () => void }) {
  return (
    <View style={styles.prompt}>
      <Text style={styles.promptEyebrow}>TODAY’S PROMPT</Text>
      <Text style={styles.promptTitle}>{challenge.title}</Text>
      <Text style={styles.promptBody} numberOfLines={4}>{challenge.prompt}</Text>
      <Button label="Share your reflection →" onPress={onWrite} />
    </View>
  );
}

function ChallengeCard({ challenge, onWrite }: { challenge: Challenge; onWrite: () => void }) {
  return (
    <View style={ui.card}>
      <Text style={styles.promptEyebrow}>{challenge.startsOn} — {challenge.endsOn}</Text>
      <Text style={styles.promptTitle}>{challenge.title}</Text>
      <Text style={styles.promptBody}>{challenge.prompt}</Text>
      <Pressable onPress={onWrite}><Text style={ui.link}>Write a response →</Text></Pressable>
    </View>
  );
}

export function PostCard({ post }: { post: Post }) {
  const pending = post.status !== 'published';
  const hearts = post.reactions.held + post.reactions.seen + post.reactions.thank_you;
  return (
    <Link href={{ pathname: '/community/[id]', params: { id: post.id } }} asChild>
      <Pressable style={StyleSheet.flatten([ui.card, pending && styles.pending])}>
        <View style={styles.head}>
          <Avatar name={post.authorName} />
          <View style={{ flex: 1 }}>
            <Text style={styles.author}>{post.authorName}</Text>
            <Text style={styles.when}>{pending ? post.status : timeAgo(post.publishedAt ?? post.createdAt)}{post.challenge ? ` · ${post.challenge}` : ''}</Text>
          </View>
          <Text style={styles.dots}>···</Text>
        </View>
        {post.title && <Text style={styles.postTitle}>{post.title}</Text>}
        <Text style={styles.body} numberOfLines={6}>{post.body}</Text>
        {pending ? (
          <Text style={styles.when}>{post.status === 'pending' ? 'Waiting for a person to read it. Only you can see it here.' : 'Not shown on the wall.'}</Text>
        ) : (
          <View style={styles.counts}>
            <Text style={[styles.count, hearts > 0 && { color: '#e0556a' }]}>♥ {hearts}</Text>
            <Text style={styles.count}>✎ {post.replies}</Text>
            <Pressable onPress={() => Share.share({ message: `${post.title ?? 'A reflection from the House'} — ${SITE_URL}/community/${post.id}` })} hitSlop={8} style={{ marginLeft: 'auto' }}>
              <Text style={styles.count}>⇪</Text>
            </Pressable>
          </View>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: space.lg, paddingBottom: space.xl * 2 },
  pending: { borderColor: colors.gold, borderStyle: 'dashed' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  author: { color: colors.ivory, fontSize: 14 },
  when: { color: colors.greyMuted, fontSize: 12 },
  dots: { color: colors.greyMuted, fontSize: 16, letterSpacing: 1 },
  postTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 20, lineHeight: 25, marginTop: 4 },
  body: { color: colors.grey, fontFamily: 'Georgia', fontSize: 15, lineHeight: 23 },
  counts: { flexDirection: 'row', gap: space.lg, marginTop: space.xs, alignItems: 'center' },
  count: { color: colors.greyMuted, fontSize: 14 },
  prompt: { backgroundColor: colors.inkRaised, borderColor: colors.gold, borderWidth: 1, borderRadius: 16, padding: space.md, gap: space.sm },
  promptEyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  promptTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 19, lineHeight: 24 },
  promptBody: { color: colors.grey, fontFamily: 'Georgia', fontSize: 15, lineHeight: 22 },
});
