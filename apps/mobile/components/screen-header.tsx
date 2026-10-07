import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/constants/theme';

/**
 * The top of a tab screen: a wordmark or a serif title on the left,
 * small glyph buttons on the right. Tabs draw their own header so the
 * title can sit in the House's serif rather than the platform's.
 */
export function ScreenHeader({
  title,
  wordmark,
  actions = [],
  children,
}: {
  title?: string;
  wordmark?: boolean;
  actions?: { glyph: string; onPress: () => void; label: string }[];
  children?: ReactNode;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        {wordmark ? <Text style={styles.wordmark}>SOLFAE</Text> : <Text style={styles.title}>{title}</Text>}
        <View style={styles.actions}>
          {actions.map((a) => (
            <Pressable key={a.label} onPress={a.onPress} accessibilityLabel={a.label} hitSlop={8} style={styles.button}>
              <Text style={styles.glyph}>{a.glyph}</Text>
            </Pressable>
          ))}
        </View>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingTop: 54, paddingHorizontal: space.lg, paddingBottom: space.sm, gap: space.sm, backgroundColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  wordmark: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 20, letterSpacing: 6 },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 28 },
  actions: { flexDirection: 'row', gap: 4 },
  button: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  glyph: { color: colors.ivory, fontSize: 20 },
});
