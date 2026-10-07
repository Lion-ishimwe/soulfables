import { useState } from 'react';
import { Modal, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Button, ErrorLine, Eyebrow, Muted, Title, ui } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { submitPost, type Challenge } from '@/lib/community';

/**
 * Writing to the wall. A reflection, a story, or a response to the
 * House's challenge; with or without a name; always read by a person
 * before it is shown.
 */
export function ComposePost({
  visible,
  onClose,
  userId,
  onDone,
  challenge,
}: {
  visible: boolean;
  onClose: () => void;
  userId: string;
  onDone: () => Promise<void>;
  challenge?: Challenge | null;
}) {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [kind, setKind] = useState<'reflection' | 'story'>('reflection');
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
      await submitPost({ userId, title, body, anonymous, kind, challengeId: challenge?.id ?? null });
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
        <Eyebrow>{challenge ? challenge.title.toUpperCase() : 'TO THE WALL'}</Eyebrow>
        <Title size={24}>{challenge ? 'Your reflection.' : 'Say the true thing.'}</Title>
        {challenge && <Muted>{challenge.prompt}</Muted>}
        {!challenge && (
          <View style={styles.kinds}>
            {(['reflection', 'story'] as const).map((k) => (
              <Text key={k} onPress={() => setKind(k)} style={[styles.kind, kind === k && styles.kindOn]}>
                {k === 'reflection' ? 'A reflection' : 'A story of mine'}
              </Text>
            ))}
          </View>
        )}
        <TextInput value={title} onChangeText={setTitle} placeholder="A title, if it wants one" placeholderTextColor={colors.greyMuted} style={ui.input} />
        <TextInput
          value={body}
          onChangeText={setBody}
          placeholder={challenge ? 'Write it here…' : 'What has a story, or a night, left with you?'}
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
        <View style={styles.actions}>
          <Button label="Not now" outline onPress={onClose} style={{ flex: 1 }} />
          <Button label={busy ? 'Sending…' : 'Send to the House'} disabled={busy} onPress={send} style={{ flex: 1 }} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, backgroundColor: colors.ink, padding: space.lg, gap: space.md },
  kinds: { flexDirection: 'row', gap: space.sm },
  kind: { color: colors.grey, borderColor: colors.rule, borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, fontSize: 13 },
  kindOn: { color: colors.gold, borderColor: colors.gold },
  editor: { minHeight: 150, lineHeight: 24, fontFamily: 'Georgia' },
  switchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  switchLabel: { color: colors.ivory, fontSize: 15 },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: 'auto' },
});
