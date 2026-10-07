import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Button, Wordmark } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { SITE_URL } from '@/lib/config';
import { supabase } from '@/lib/supabase';

type Mode = 'signin' | 'signup' | 'reset';

/**
 * The door.
 *
 * Sign in with email and password, or make an account, or ask for a
 * reset. Confirmation and reset links come from the same auth service
 * the website uses and land on the site's confirm page; with the app
 * installed, the phone opens that link in the app.
 */
export default function SignInScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const [mode, setMode] = useState<Mode>(params.mode === 'signup' ? 'signup' : 'signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ error?: string; message?: string }>({});

  async function submit() {
    setBusy(true);
    setNotice({});
    try {
      const address = email.trim().toLowerCase();
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email: address, password });
        if (error) throw new Error('That email and password do not match. Try again.');
        if (router.canGoBack()) router.back();
        else router.replace('/');
      } else if (mode === 'signup') {
        if (password.length < 10) throw new Error('Use at least 10 characters for the password.');
        const { error } = await supabase.auth.signUp({
          email: address,
          password,
          options: { data: { display_name: name.trim() }, emailRedirectTo: `${SITE_URL}/auth/confirm` },
        });
        if (error) throw new Error(error.message);
        setNotice({ message: 'A confirmation link is on its way to your email. Open it, press Confirm, and come back here to sign in.' });
      } else {
        await supabase.auth.resetPasswordForEmail(address, { redirectTo: `${SITE_URL}/auth/confirm` });
        setNotice({ message: 'If that address has an account, a reset link is on its way.' });
      }
    } catch (e) {
      setNotice({ error: (e as Error).message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: colors.ink }}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} style={styles.close} hitSlop={10}>
          <Text style={styles.closeText}>✕</Text>
        </Pressable>
        <View style={{ alignItems: 'center', gap: space.xs, marginTop: space.xl }}>
          <Wordmark size={26} />
          <Text style={styles.title}>{mode === 'signin' ? 'Welcome back' : mode === 'signup' ? 'Come in' : 'Forgotten?'}</Text>
          <Text style={styles.sub}>Every soul has a story.</Text>
        </View>

        {mode !== 'reset' && (
          <View style={styles.tabs}>
            {(['signin', 'signup'] as const).map((m) => (
              <Pressable key={m} onPress={() => setMode(m)} style={[styles.tab, mode === m && styles.tabOn]}>
                <Text style={[styles.tabText, mode === m && styles.tabTextOn]}>{m === 'signin' ? 'Sign In' : 'Sign Up'}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {notice.error && <Text style={styles.error}>{notice.error}</Text>}
        {notice.message && <Text style={styles.message}>{notice.message}</Text>}

        {mode === 'signup' && <Field icon="✦" placeholder="Your name" value={name} onChangeText={setName} autoCapitalize="words" />}
        <Field icon="✉" placeholder="Email address" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        {mode !== 'reset' && (
          <Field
            icon="🔒"
            placeholder="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry={!showPassword}
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            trailing={showPassword ? '◉' : '◎'}
            onTrailing={() => setShowPassword((v) => !v)}
          />
        )}

        {mode === 'signin' && (
          <View style={styles.row}>
            <Text style={styles.small}>You stay signed in on this phone.</Text>
            <Pressable onPress={() => setMode('reset')}>
              <Text style={styles.link}>Forgot password?</Text>
            </Pressable>
          </View>
        )}

        <Button label={busy ? 'One moment…' : mode === 'signin' ? 'Sign In' : mode === 'signup' ? 'Create account' : 'Send the link'} disabled={busy} onPress={submit} />

        {mode === 'reset' && (
          <Pressable onPress={() => setMode('signin')} style={{ alignSelf: 'center', paddingVertical: 10 }}>
            <Text style={styles.link}>Back to sign in</Text>
          </Pressable>
        )}
        {mode === 'signup' && <Text style={styles.small}>By creating an account you agree to the House’s terms and privacy policy, on soulfables.co.</Text>}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { icon: string; trailing?: string; onTrailing?: () => void }) {
  const { icon, trailing, onTrailing, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.fieldIcon}>{icon}</Text>
      <TextInput {...rest} style={styles.input} placeholderTextColor={colors.greyMuted} />
      {trailing && (
        <Pressable onPress={onTrailing} hitSlop={8}>
          <Text style={styles.fieldIcon}>{trailing}</Text>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, alignItems: 'stretch', paddingTop: 40 },
  close: { alignSelf: 'flex-end', padding: 6 },
  closeText: { color: colors.grey, fontSize: 18 },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 26, marginTop: space.md },
  sub: { color: colors.grey, fontSize: 14 },
  tabs: { flexDirection: 'row', borderBottomColor: colors.rule, borderBottomWidth: 1, marginTop: space.sm },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent', marginBottom: -1 },
  tabOn: { borderBottomColor: colors.gold },
  tabText: { color: colors.greyMuted, fontSize: 15 },
  tabTextOn: { color: colors.ivory },
  error: { color: colors.ivory, backgroundColor: 'rgba(179,66,58,0.15)', borderLeftColor: colors.danger, borderLeftWidth: 2, padding: space.sm, borderRadius: 6 },
  message: { color: colors.ivory, backgroundColor: 'rgba(201,169,97,0.12)', borderLeftColor: colors.gold, borderLeftWidth: 2, padding: space.sm, borderRadius: 6 },
  field: { flexDirection: 'row', alignItems: 'center', gap: space.sm, borderColor: colors.rule, borderWidth: 1, borderRadius: 10, backgroundColor: colors.inkRaised, paddingHorizontal: space.md },
  fieldIcon: { color: colors.greyMuted, fontSize: 15 },
  input: { flex: 1, color: colors.ivory, paddingVertical: 13, fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  small: { color: colors.greyMuted, fontSize: 12.5, lineHeight: 18 },
  link: { color: colors.gold, fontSize: 13 },
});
