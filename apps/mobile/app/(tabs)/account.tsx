import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Linking, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/constants/theme';
import { getMe, type Me } from '@/lib/api';
import { SITE_URL } from '@/lib/config';
import { useSession } from '@/lib/session';
import { supabase } from '@/lib/supabase';

/**
 * The reader's own page.
 *
 * Premium and books are bought on the website, not in the app: the
 * stores would take a share of every sale made inside it, so the app
 * reads what the reader owns and points to the site for the rest.
 */
export default function AccountScreen() {
  const { session } = useSession();
  const [me, setMe] = useState<Me | null>(null);

  useEffect(() => {
    if (!session) {
      setMe(null);
      return;
    }
    getMe().then(setMe).catch(() => setMe(null));
  }, [session]);

  if (!session) {
    return (
      <View style={styles.centre}>
        <Text style={styles.star}>✦</Text>
        <Text style={styles.eyebrow}>THE DOOR</Text>
        <Text style={styles.title}>Come in.</Text>
        <Text style={styles.muted}>Your shelf, your progress and your reflections are where you left them.</Text>
        <Link href="/signin" asChild>
          <Pressable style={styles.button}><Text style={styles.buttonText}>SIGN IN</Text></Pressable>
        </Link>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.page}>
      <Text style={styles.eyebrow}>YOUR SHELF</Text>
      <Text style={styles.title}>{me?.displayName ?? session.user.email}</Text>
      <View style={styles.rows}>
        <Row label="Email" value={session.user.email ?? ''} />
        <Row label="Role" value={me?.role ?? 'reader'} />
      </View>

      <Text style={styles.section}>Premium and books</Text>
      <Text style={styles.muted}>Bought on the website; they open here the moment payment clears.</Text>
      <Pressable style={styles.linkButton} onPress={() => Linking.openURL(`${SITE_URL}/membership`)}>
        <Text style={styles.linkText}>Premium on soulfables.co →</Text>
      </Pressable>
      <Pressable style={styles.linkButton} onPress={() => Linking.openURL(`${SITE_URL}/shop`)}>
        <Text style={styles.linkText}>The Bookshop →</Text>
      </Pressable>

      <Pressable style={[styles.button, { marginTop: space.xl }]} onPress={() => supabase.auth.signOut()}>
        <Text style={styles.buttonText}>SIGN OUT</Text>
      </Pressable>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.sm },
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm },
  star: { color: colors.gold, fontSize: 20 },
  eyebrow: { color: colors.gold, fontSize: 11, letterSpacing: 3 },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 30, lineHeight: 36 },
  muted: { color: colors.greyMuted, fontSize: 14, lineHeight: 20, textAlign: 'center' },
  section: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 20, marginTop: space.lg },
  rows: { borderColor: colors.rule, borderWidth: 1, borderRadius: 8, marginTop: space.md },
  row: { flexDirection: 'row', justifyContent: 'space-between', padding: space.md, borderBottomColor: colors.rule, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLabel: { color: colors.greyMuted },
  rowValue: { color: colors.ivory },
  button: { borderColor: colors.gold, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 28, marginTop: space.md },
  buttonText: { color: colors.gold, letterSpacing: 3, fontSize: 12, textAlign: 'center' },
  linkButton: { paddingVertical: 8 },
  linkText: { color: colors.gold, fontSize: 15 },
});
