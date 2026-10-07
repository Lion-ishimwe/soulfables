import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { MoodStrip } from '@/components/mood-strip';
import { ScreenHeader } from '@/components/screen-header';
import { StoryRow } from '@/components/story-row';
import { Button, Door, ErrorLine, Muted, Pill, Tabs, timeAgo, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { listSaved, type SavedStory } from '@/lib/account';
import { deleteEntry, getAffirmation, getMoods, getPromptPool, getTodaysPrompt, listEntries, saveEntry, type Affirmation, type Entry, type Mood, type Prompt } from '@/lib/journal';
import { useSession } from '@/lib/session';

type Tab = 'today' | 'entries' | 'saved' | 'prompts';

/**
 * The Journal: the private room.
 *
 * Today: the question of the day, a mood, a place to write, and the
 * affirmation. Past entries: what was written, with the thirty-day
 * mood strip. Saved: the stories kept. Prompts: the pool of questions
 * and the Drawer of Quiet Questions. Everything written is private by
 * the rule on the table.
 */
export default function JournalScreen() {
  const { session } = useSession();
  const [tab, setTab] = useState<Tab>('today');
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [pool, setPool] = useState<Prompt[]>([]);
  const [affirmation, setAffirmation] = useState<Affirmation | null>(null);
  const [moods, setMoods] = useState<Mood[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [saved, setSaved] = useState<SavedStory[]>([]);
  const [body, setBody] = useState('');
  const [moodId, setMoodId] = useState<string | null>(null);
  const [activePrompt, setActivePrompt] = useState<Prompt | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const [p, a, m, pp] = await Promise.all([getTodaysPrompt(), getAffirmation(), getMoods(), getPromptPool()]);
      setPrompt(p);
      setActivePrompt((cur) => cur ?? p);
      setAffirmation(a);
      setMoods(m);
      setPool(pp);
      if (session) {
        const [e, s] = await Promise.all([listEntries(60), listSaved()]);
        setEntries(e);
        setSaved(s);
      }
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
      await saveEntry({ userId: session.user.id, body: body.trim(), moodId, promptId: activePrompt?.id ?? null, title: activePrompt && activePrompt.id !== prompt?.id ? activePrompt.body.slice(0, 80) : null });
      setBody('');
      setMoodId(null);
      setEntries(await listEntries(60));
      setTab('entries');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const remove = (entry: Entry) => {
    Alert.alert('Let this one go?', 'The entry is deleted for good.', [
      { text: 'Keep it', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: async () => { await deleteEntry(entry.id).catch((e) => setError((e as Error).message)); setEntries((l) => l.filter((x) => x.id !== entry.id)); } },
    ]);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.ink }}>
      <ScreenHeader title="Journal" actions={[{ glyph: '▦', label: 'Calendar', onPress: () => setTab('entries') }]}>
        <Tabs
          items={[
            { key: 'today', label: 'Today' },
            { key: 'entries', label: 'Past Entries' },
            { key: 'saved', label: 'Saved' },
            { key: 'prompts', label: 'Prompts' },
          ]}
          value={tab}
          onChange={setTab}
        />
      </ScreenHeader>
      <ScrollView
        contentContainerStyle={ui.page}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} tintColor={colors.gold} />}
      >
        <ErrorLine>{error}</ErrorLine>

        {tab === 'today' && (
          <>
            <View style={styles.reflect}>
              <View style={styles.reflectHead}>
                <Text style={styles.reflectEyebrow}>TODAY’S REFLECTION</Text>
                {activePrompt && activePrompt.id !== prompt?.id && (
                  <Pressable onPress={() => setActivePrompt(prompt)} hitSlop={8}><Text style={ui.sectionAction}>Today’s</Text></Pressable>
                )}
              </View>
              <Text style={styles.reflectQ}>{activePrompt?.body ?? 'What stayed with you?'}</Text>
              <TextInput
                value={body}
                onChangeText={setBody}
                placeholder="Write your thoughts…"
                placeholderTextColor={colors.greyMuted}
                multiline
                style={[ui.input, styles.editor]}
                textAlignVertical="top"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.sm }}>
                {moods.map((m) => (
                  <Pill key={m.id} label={`${m.emoji ? m.emoji + ' ' : ''}${m.label}`} active={moodId === m.id} onPress={() => setMoodId(moodId === m.id ? null : m.id)} />
                ))}
              </ScrollView>
              <Button label={saving ? 'Keeping…' : 'Save Entry'} disabled={saving || !body.trim()} onPress={save} style={{ alignSelf: 'flex-end', paddingHorizontal: space.xl }} />
            </View>

            {affirmation && (
              <View style={styles.affirmation}>
                <Text style={styles.affEyebrow}>☼  TODAY’S AFFIRMATION</Text>
                <Text style={styles.affText}>“{affirmation.body}”</Text>
              </View>
            )}

            <Pressable style={[ui.card, { marginTop: space.lg }]} onPress={() => router.push('/questions')}>
              <Text style={styles.cardTitle}>The Drawer of Quiet Questions</Text>
              <Muted>Draw one card from the deck and sit with it.</Muted>
              <Text style={ui.link}>Draw a card →</Text>
            </Pressable>
          </>
        )}

        {tab === 'entries' && (
          <>
            <MoodStrip entries={entries} />
            {entries.length === 0 && <Muted>Nothing written yet. The first line is the hardest and the shortest.</Muted>}
            {entries.map((e) => (
              <Pressable key={e.id} style={[ui.card, { marginBottom: space.sm }]} onLongPress={() => remove(e)} delayLongPress={500}>
                <Text style={styles.entryMeta}>
                  {e.mood?.emoji ? e.mood.emoji + ' ' : ''}{e.mood?.label ?? ''}{e.mood ? ' · ' : ''}{timeAgo(e.createdAt)}
                </Text>
                {e.title && <Text style={styles.entryTitle}>{e.title}</Text>}
                <Text style={styles.entryBody}>{e.body}</Text>
                {e.story && <Text style={styles.entryMeta}>after “{e.story.title}”</Text>}
              </Pressable>
            ))}
            {entries.length > 0 && <Muted>Hold an entry to delete it.</Muted>}
          </>
        )}

        {tab === 'saved' && (
          <>
            {saved.length === 0 && <Muted>Save a story from its page and it is kept here.</Muted>}
            <View style={{ gap: space.sm }}>
              {saved.map((s) => (
                <StoryRow key={s.slug} item={{ id: s.slug, slug: s.slug, title: s.title, subtitle: s.subtitle, excerpt: null, author: null, readingMinutes: s.readingMinutes, coverImage: null, access: 'free', forSleep: false, hasAudio: false, shelf: null, series: null, publishedAt: null }} />
              ))}
            </View>
          </>
        )}

        {tab === 'prompts' && (
          <>
            <Pressable style={ui.card} onPress={() => router.push('/questions')}>
              <Text style={styles.cardTitle}>Quiet Questions</Text>
              <Muted>The deck. Draw one, write, save, draw another.</Muted>
              <Text style={ui.link}>Open the drawer →</Text>
            </Pressable>
            <Text style={[ui.section, { marginTop: space.lg }]}>Questions to write to</Text>
            {pool.map((p) => (
              <Pressable key={p.id} style={[ui.card, { marginTop: space.sm }]} onPress={() => { setActivePrompt(p); setTab('today'); }}>
                <Text style={styles.promptBody}>{p.body}</Text>
                <Text style={ui.link}>Write to this →</Text>
              </Pressable>
            ))}
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  reflect: { backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 16, padding: space.md, gap: space.sm },
  reflectHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  reflectEyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  reflectQ: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 20, lineHeight: 27 },
  editor: { minHeight: 110, lineHeight: 24, fontFamily: 'Georgia', backgroundColor: colors.ink },
  affirmation: { borderLeftWidth: 2, borderLeftColor: colors.gold, paddingLeft: space.md, marginTop: space.lg, gap: 6 },
  affEyebrow: { color: colors.gold, fontSize: 10, letterSpacing: 2 },
  affText: { color: colors.ivory, fontFamily: 'Georgia', fontStyle: 'italic', fontSize: 17, lineHeight: 24 },
  cardTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 19 },
  entryMeta: { color: colors.greyMuted, fontSize: 12 },
  entryTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 17 },
  entryBody: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 16, lineHeight: 24 },
  promptBody: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 17, lineHeight: 24 },
});
