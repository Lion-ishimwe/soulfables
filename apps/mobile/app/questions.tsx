import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, ErrorLine, Eyebrow, Loading, Muted, Title, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { getCards, saveEntry, type Card } from '@/lib/journal';
import { useSession } from '@/lib/session';

/**
 * The Reflection Deck. A reader draws one card from the House's deck,
 * sits with it, and may keep an answer in the journal. The deck is the
 * journal_prompts table where kind = 'deck', the same cards the website
 * turns over on its Questions page.
 */
export default function QuestionsScreen() {
  const { session } = useSession();
  const [cards, setCards] = useState<Card[] | null>(null);
  const [card, setCard] = useState<Card | null>(null);
  const [answer, setAnswer] = useState('');
  const [kept, setKept] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getCards().then(setCards).catch((e) => setError((e as Error).message));
  }, []);

  const draw = () => {
    if (!cards?.length) return;
    const pool = cards.filter((c) => c.id !== card?.id);
    setCard(pool[Math.floor(Math.random() * pool.length)] ?? cards[0]);
    setAnswer('');
    setKept(false);
  };

  const keep = async () => {
    if (!session || !card || !answer.trim()) return;
    try {
      await saveEntry({ userId: session.user.id, body: answer.trim(), title: card.title, promptId: card.id });
      setKept(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  if (!cards) return <Loading text="Shuffling…" />;

  return (
    <ScrollView contentContainerStyle={[ui.page, { alignItems: 'stretch' }]} keyboardShouldPersistTaps="handled">
      <Eyebrow>THE REFLECTION DECK</Eyebrow>
      <Title size={26}>Draw one. Sit with it.</Title>
      <ErrorLine>{error}</ErrorLine>

      {!card ? (
        <Pressable style={styles.back} onPress={draw}>
          <Text style={styles.backGlyph}>✦</Text>
          <Text style={styles.backText}>TAP TO DRAW</Text>
          <Muted centre>{cards.length} cards in the deck</Muted>
        </Pressable>
      ) : (
        <View style={styles.card}>
          <Text style={styles.glyph}>{card.glyph ?? '✦'}</Text>
          <Text style={styles.feeling}>{card.feeling.toUpperCase()}</Text>
          <Text style={styles.cardTitle}>{card.title}</Text>
          <Text style={styles.body}>{card.body}</Text>
          {card.whisper && <Text style={styles.whisper}>{card.whisper}</Text>}
        </View>
      )}

      {card && (
        <>
          {session ? (
            kept ? (
              <View style={{ gap: space.sm, marginTop: space.md }}>
                <Muted centre>Kept in your journal.</Muted>
                <Button label="Open the journal" onPress={() => router.navigate('/(tabs)/journal')} />
              </View>
            ) : (
              <>
                <TextInput
                  value={answer}
                  onChangeText={setAnswer}
                  placeholder="If you want to answer, answer here…"
                  placeholderTextColor={colors.greyMuted}
                  multiline
                  style={[ui.input, styles.editor]}
                  textAlignVertical="top"
                />
                <Button label="Keep in the journal" solid disabled={!answer.trim()} onPress={keep} />
              </>
            )
          ) : (
            <Muted centre>Sign in to keep an answer in your journal.</Muted>
          )}
          <Button label="Draw another" onPress={draw} style={{ marginTop: space.sm }} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  back: { aspectRatio: 3 / 4, maxHeight: 420, borderColor: colors.gold, borderWidth: 1, borderRadius: 12, alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.md, backgroundColor: colors.inkRaised },
  backGlyph: { color: colors.gold, fontSize: 40 },
  backText: { color: colors.gold, letterSpacing: 4, fontSize: 12 },
  card: { borderColor: colors.gold, borderWidth: 1, borderRadius: 12, padding: space.lg, gap: space.sm, marginTop: space.md, backgroundColor: colors.inkRaised },
  glyph: { color: colors.gold, fontSize: 32, textAlign: 'center' },
  feeling: { color: colors.gold, fontSize: 10, letterSpacing: 3, textAlign: 'center' },
  cardTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 24, textAlign: 'center', lineHeight: 30 },
  body: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 18, lineHeight: 28, textAlign: 'center', marginTop: space.sm },
  whisper: { color: colors.grey, fontStyle: 'italic', fontSize: 14, textAlign: 'center', marginTop: space.sm },
  editor: { minHeight: 110, lineHeight: 24, fontFamily: 'Georgia', marginTop: space.md, marginBottom: space.sm },
});
