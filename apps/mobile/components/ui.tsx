import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, space } from '@/constants/theme';

/**
 * The few pieces every screen is built from: the small gold eyebrow,
 * the serif title, a quiet line, the outlined button, and the chip.
 * Written once so the screens read as one house.
 */
export const Eyebrow = ({ children }: { children: ReactNode }) => <Text style={ui.eyebrow}>{children}</Text>;
export const Title = ({ children, size = 28 }: { children: ReactNode; size?: number }) => (
  <Text style={[ui.title, { fontSize: size, lineHeight: size * 1.2 }]}>{children}</Text>
);
export const Muted = ({ children, centre }: { children: ReactNode; centre?: boolean }) => (
  <Text style={[ui.muted, centre && { textAlign: 'center' }]}>{children}</Text>
);
export const ErrorLine = ({ children }: { children: ReactNode }) => (children ? <Text style={ui.error}>{children}</Text> : null);

export function Button({
  label,
  onPress,
  href,
  solid,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  href?: Href;
  solid?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const inner = (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [ui.button, solid && ui.buttonSolid, disabled && { opacity: 0.4 }, pressed && { opacity: 0.7 }, style]}
    >
      <Text style={[ui.buttonText, solid && ui.buttonTextSolid]}>{label.toUpperCase()}</Text>
    </Pressable>
  );
  return href ? (
    <Link href={href} asChild>
      {inner}
    </Link>
  ) : (
    inner
  );
}

export function Chip({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[ui.chip, active && ui.chipActive]}>
      <Text style={[ui.chipText, active && ui.chipTextActive]}>{label}</Text>
    </Pressable>
  );
}

export function Centre({ children }: { children: ReactNode }) {
  return <View style={ui.centre}>{children}</View>;
}

export function Loading({ text = 'Opening…' }: { text?: string }) {
  return (
    <View style={ui.centre}>
      <ActivityIndicator color={colors.gold} />
      <Text style={ui.muted}>{text}</Text>
    </View>
  );
}

/** The door, for a screen that needs a reader signed in. */
export function Door({ eyebrow, line }: { eyebrow: string; line: string }) {
  return (
    <View style={ui.centre}>
      <Text style={ui.star}>✦</Text>
      <Eyebrow>{eyebrow}</Eyebrow>
      <Title>Come in.</Title>
      <Muted centre>{line}</Muted>
      <Button label="Sign in" href="/signin" style={{ marginTop: space.md }} />
    </View>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} d ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export const ui = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.sm },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm, backgroundColor: colors.ink },
  star: { color: colors.gold, fontSize: 20 },
  eyebrow: { color: colors.gold, fontSize: 11, letterSpacing: 3 },
  title: { color: colors.ivory, fontFamily: 'Georgia' },
  muted: { color: colors.greyMuted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, marginTop: space.sm },
  section: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 20, marginTop: space.lg },
  card: { backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 8, padding: space.md, gap: space.xs },
  button: { borderColor: colors.gold, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 24 },
  buttonSolid: { backgroundColor: colors.gold },
  buttonText: { color: colors.gold, letterSpacing: 3, fontSize: 12, textAlign: 'center' },
  buttonTextSolid: { color: colors.ink },
  chip: { borderColor: colors.rule, borderWidth: 1, borderRadius: 999, paddingVertical: 6, paddingHorizontal: 14, backgroundColor: colors.inkRaised },
  chipActive: { borderColor: colors.gold },
  chipText: { color: colors.grey, fontSize: 13 },
  chipTextActive: { color: colors.gold },
  input: { borderColor: colors.rule, borderWidth: 1, borderRadius: 6, padding: space.md, color: colors.ivory, fontSize: 16, backgroundColor: colors.inkRaised },
  link: { color: colors.gold, fontSize: 15, paddingVertical: 8 },
});
