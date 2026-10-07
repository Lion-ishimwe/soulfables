import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, space } from '@/constants/theme';

/**
 * The few pieces every screen is built from: the wordmark, the small
 * gold eyebrow, the serif title, a quiet line, the gold button, the
 * pill, and the door for screens that need a reader signed in.
 */
export const Wordmark = ({ size = 22 }: { size?: number }) => <Text style={[ui.wordmark, { fontSize: size }]}>SOLFAE</Text>;
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
  outline,
  disabled,
  style,
}: {
  label: string;
  onPress?: () => void;
  href?: Href;
  /** Gold outline on ink, for the second choice. The default is solid gold. */
  outline?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  // A plain style array, not a function of the pressed state: a Link
  // child on the web build does not receive function styles.
  const inner = (
    <Pressable disabled={disabled} onPress={onPress} style={StyleSheet.flatten([ui.button, outline && ui.buttonOutline, disabled && { opacity: 0.4 }, style])}>
      <Text style={[ui.buttonText, outline && ui.buttonTextOutline]}>{label}</Text>
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

export function Pill({ label, active, onPress }: { label: string; active?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[ui.pill, active && ui.pillActive]}>
      <Text style={[ui.pillText, active && ui.pillTextActive]}>{label}</Text>
    </Pressable>
  );
}

/** A row of pills that act as tabs within a screen. */
export function Tabs<T extends string>({ items, value, onChange }: { items: { key: T; label: string }[]; value: T; onChange: (k: T) => void }) {
  return (
    <View style={ui.tabs}>
      {items.map((t) => (
        <Pill key={t.key} label={t.label} active={value === t.key} onPress={() => onChange(t.key)} />
      ))}
    </View>
  );
}

export function SectionHead({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={ui.sectionHead}>
      <Text style={ui.section}>{title}</Text>
      {action && (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={ui.sectionAction}>{action}</Text>
        </Pressable>
      )}
    </View>
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
      <Button label="Sign in" href="/signin" style={{ marginTop: space.md, alignSelf: 'stretch' }} />
    </View>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const initial = (name.trim()[0] ?? '✦').toUpperCase();
  return (
    <View style={[ui.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
      <Text style={[ui.avatarText, { fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}

export function timeAgo(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  if (s < 86400 * 7) return `${Math.floor(s / 86400)} days ago`;
  return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

export function greeting(): string {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning.' : h < 18 ? 'Good afternoon.' : 'Good evening.';
}

export const ui = StyleSheet.create({
  page: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.sm },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm, backgroundColor: colors.ink },
  wordmark: { color: colors.ivory, fontFamily: 'Georgia', letterSpacing: 6 },
  star: { color: colors.gold, fontSize: 20 },
  eyebrow: { color: colors.gold, fontSize: 11, letterSpacing: 3 },
  title: { color: colors.ivory, fontFamily: 'Georgia' },
  muted: { color: colors.greyMuted, fontSize: 14, lineHeight: 20 },
  error: { color: colors.danger, marginTop: space.sm },
  section: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 20 },
  sectionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: space.lg, marginBottom: space.sm },
  sectionAction: { color: colors.gold, fontSize: 13 },
  card: { backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 14, padding: space.md, gap: space.xs },
  button: { backgroundColor: colors.gold, borderColor: colors.gold, borderWidth: 1, borderRadius: 10, paddingVertical: 13, paddingHorizontal: 24 },
  buttonOutline: { backgroundColor: 'transparent', borderColor: colors.rule },
  buttonText: { color: colors.ink, fontSize: 15, fontWeight: '600', textAlign: 'center' },
  buttonTextOutline: { color: colors.ivory, fontWeight: '400' },
  pill: { borderColor: colors.rule, borderWidth: 1, borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14, backgroundColor: colors.inkRaised },
  pillActive: { borderColor: colors.gold, backgroundColor: colors.gold },
  pillText: { color: colors.grey, fontSize: 13 },
  pillTextActive: { color: colors.ink, fontWeight: '600' },
  tabs: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', marginBottom: space.sm },
  input: { borderColor: colors.rule, borderWidth: 1, borderRadius: 10, padding: space.md, color: colors.ivory, fontSize: 16, backgroundColor: colors.inkRaised },
  link: { color: colors.gold, fontSize: 15, paddingVertical: 8 },
  avatar: { backgroundColor: colors.rule, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.gold, fontFamily: 'Georgia' },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  icon: { color: colors.ivory, fontSize: 20 },
});
