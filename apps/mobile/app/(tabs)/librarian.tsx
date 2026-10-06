import { Link } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Door, ErrorLine, Eyebrow, Muted, Title, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { askLibrarian, type CompanionMessage } from '@/lib/api';
import { useSession } from '@/lib/session';

/**
 * The Librarian: the same companion the website keeps, reached through
 * the site's own route with the reader's token. The site decides what
 * kind of answer this reader gets; the screen only carries the words
 * and the stories it points to.
 */
const OPENING: CompanionMessage = {
  role: 'assistant',
  content: 'I keep the shelves here. Tell me what kind of night it is, or what you are carrying, and I will find something that meets it.',
};

export default function LibrarianScreen() {
  const { session } = useSession();
  const [messages, setMessages] = useState<CompanionMessage[]>([OPENING]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);

  useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [messages.length, busy]);

  if (!session) return <Door eyebrow="THE LIBRARIAN" line="The Librarian talks with readers who are signed in, so she can remember the shelf you were on." />;

  const send = async () => {
    const content = text.trim();
    if (!content || busy) return;
    const next = [...messages, { role: 'user' as const, content }];
    setMessages(next);
    setText('');
    setBusy(true);
    setError(null);
    try {
      const reply = await askLibrarian(next.filter((m) => m !== OPENING));
      setMessages([...next, reply]);
    } catch (e) {
      setError((e as Error).message.includes('401') ? 'Please sign in again.' : 'The Librarian stepped away. Try once more.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
      <ScrollView ref={scroll} contentContainerStyle={styles.thread} keyboardShouldPersistTaps="handled">
        <Eyebrow>THE LIBRARIAN</Eyebrow>
        <Title size={24}>Ask for a story, not an answer.</Title>
        {messages.map((m, i) => (
          <View key={i} style={[styles.bubble, m.role === 'user' ? styles.mine : styles.hers]}>
            <Text style={[styles.bubbleText, m.role === 'user' && { color: colors.ink }]}>{m.content}</Text>
            {m.safety === 'crisis' && (
              <Text style={styles.safety}>If you are in danger right now, please contact your local emergency number. This is a library, not a line of care.</Text>
            )}
            {m.suggestions && m.suggestions.length > 0 && (
              <View style={styles.suggestions}>
                {m.suggestions.map((s) => (
                  <Link key={s.slug} href={{ pathname: '/story/[slug]', params: { slug: s.slug } }} asChild>
                    <Pressable style={styles.suggestion}>
                      <Text style={styles.suggestionText}>✦ {s.title}</Text>
                    </Pressable>
                  </Link>
                ))}
              </View>
            )}
          </View>
        ))}
        {busy && <Muted>The Librarian is looking along the shelf…</Muted>}
        <ErrorLine>{error}</ErrorLine>
      </ScrollView>
      <View style={styles.composer}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="What kind of night is it?"
          placeholderTextColor={colors.greyMuted}
          style={[ui.input, { flex: 1 }]}
          onSubmitEditing={send}
          returnKeyType="send"
          blurOnSubmit={false}
        />
        <Button label="Ask" solid disabled={busy || !text.trim()} onPress={send} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  thread: { padding: space.lg, gap: space.md, paddingBottom: space.xl },
  bubble: { padding: space.md, borderRadius: 12, maxWidth: '88%', gap: space.sm },
  hers: { backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, alignSelf: 'flex-start' },
  mine: { backgroundColor: colors.gold, alignSelf: 'flex-end' },
  bubbleText: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 16, lineHeight: 24 },
  safety: { color: colors.goldSoft, fontSize: 13, lineHeight: 19 },
  suggestions: { gap: space.xs, marginTop: space.xs },
  suggestion: { paddingVertical: 4 },
  suggestionText: { color: colors.gold, fontSize: 15 },
  composer: { flexDirection: 'row', gap: space.sm, padding: space.md, borderTopColor: colors.rule, borderTopWidth: 1, backgroundColor: colors.ink, alignItems: 'center' },
});
