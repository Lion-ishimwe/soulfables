import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Chip, Door, ErrorLine, Eyebrow, Muted, Title, timeAgo, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { deleteEntry, getAffirmation, getMoods, getTodaysPrompt, listEntries, saveEntry, type Affirmation, type Entry, type Mood, type Prompt } from '@/lib/journal';
import { useSession } from '@/lib/session';

/**
 * The Journal: today's question, a line to keep, a place to write, and
 * the entries that came before. Everything a reader writes here is
 * private; the row policy on the table lets no one else read it.
 */
export default function JournalScreen() {
  const { session } = useSession();
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [affirmation, setAffirmation] = useState<Affirmation | null>(null);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [body, setBody] = useState('');
  const [moodId, setMoodId] = useState<string | null>(null);
  const [usePrompt, setUsePrompt] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, a, m] = await Promise.all([getTodaysPrompt(), getAffirmation(), getMoods()]);
      setPrompt(p);
      setAffirmation(a);
      setMoods(m);
      if (session) setEntries(await listEntries());
    } catch (e) {
      setError((e as Error).message);
    }
  }, [session]);

  useEffect(() => {
    load();
  }, [load]);

  if (!session) return <Door eyebrow="THE JOURNAL" line="Your reflections are kept here, and only you can read them." />;

  const save = async () => {
    if (!body.trim()) return;
    setSaving(true);
    try {
      await saveEntry({ userId: session.user.id, body: body.trim(), moodId, promptId: usePrompt && prompt ? prompt.id : null });
      setBody('');
      setMoodId(null);
      setEntries(await listEntries());
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (entry: Entry) => {
    Alert.alert('Let this one go?', 'The entry is deleted for good.', [
      { text: 'Keep it', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEntry(entry.id).catch((e) => setError((e as Error).message));
          setEntries((list) => list.filter((x) => x.id !== entry.id));
        },
      },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }} keyboardVerticalOffset={90}>
      <ScrollView
        contentContainerStyle={ui.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
      >
        <Eyebrow>THE JOURNAL</Eyebrow>
        <Title size={26}>A page that is only yours.</Title>

        {affirmation && (
          <View style={styles.affirmation}>
            <Text style={styles.affirmationText}>“{affirmation.body}”</Text>
          </View>
        )}

        {prompt && (
          <Pressable style={[styles.prompt, !usePrompt && { opacity: 0.6 }]} onPress={() => setUsePrompt((v) => !v)}>
            <Text style={styles.promptEyebrow}>TODAY’S QUESTION {usePrompt ? '· writing to it' : '· set aside'}</Text>
            <Text style={styles.promptText}>{prompt.body}</Text>
          </Pressable>
        )}

        {moods.length > 0 && (
          <View style={styles.moods}>
            {moods.map((m) => (
              <Chip key={m.id} label={`${m.emoji ? m.emoji + ' ' : ''}${m.label}`} active={moodId === m.id} onPress={() => setMoodId(moodId === m.id ? null : m.id)} />
            ))}
          </View>
        )}

        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder="Write what is true tonight…"
          placeholderTextColor={colors.greyMuted}
          multiline
          style={[ui.input, styles.editor]}
          textAlignVertical="top"
        />
        <View style={styles.actions}>
          <Button label="Draw a card" href="/questions" />
          <Button label={saving ? 'Keeping…' : 'Keep this'} solid disabled={saving || !body.trim()} onPress={save} />
        </View>
        <ErrorLine>{error}</ErrorLine>

        <Text style={ui.section}>Earlier pages</Text>
        {entries.length === 0 && <Muted>Nothing written yet. The first line is the hardest and the shortest.</Muted>}
        {entries.map((e) => (
          <Pressable key={e.id} style={ui.card} onLongPress={() => remove(e)} delayLongPress={500}>
            <View style={styles.entryHead}>
              <Text style={styles.entryMeta}>
                {e.mood?.emoji ? e.mood.emoji + ' ' : ''}
                {e.mood?.label ?? ''}
                {e.mood ? ' · ' : ''}
                {timeAgo(e.createdAt)}
              </Text>
            </View>
            {e.title && <Text style={styles.entryTitle}>{e.title}</Text>}
            <Text style={styles.entryBody}>{e.body}</Text>
            {e.story && <Text style={styles.entryMeta}>after “{e.story.title}”</Text>}
          </Pressable>
        ))}
        {entries.length > 0 && <Muted>Hold an entry to delete it.</Muted>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  affirmation: { borderLeftWidth: 2, borderLeftColor: colors.gold, paddingLeft: space.md, marginVertical: space.sm },
  affirmationText: { color: colors.grey, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 17, lineHeight: 24 },
  prompt: { backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 8, padding: space.md, gap: space.xs },
  promptEyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  promptText: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 19, lineHeight: 26 },
  moods: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginTop: space.sm },
  editor: { minHeight: 140, lineHeight: 24, fontFamily: 'Georgia', marginTop: space.sm },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: space.sm, marginTop: space.sm },
  entryHead: { flexDirection: 'row', justifyContent: 'space-between' },
  entryMeta: { color: colors.greyMuted, fontSize: 12 },
  entryTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 18 },
  entryBody: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 16, lineHeight: 24 },
});
