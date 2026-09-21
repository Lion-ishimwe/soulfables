import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
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
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
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
        router.back();
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <Text style={styles.star}>✦</Text>
        <Text style={styles.eyebrow}>THE DOOR</Text>
        <Text style={styles.title}>{mode === 'signin' ? 'Come in.' : mode === 'signup' ? 'Join the House.' : 'Forgotten your password?'}</Text>

        {notice.error && <Text style={styles.error}>{notice.error}</Text>}
        {notice.message && <Text style={styles.message}>{notice.message}</Text>}

        {mode === 'signup' && (
          <Field label="NAME" value={name} onChangeText={setName} autoCapitalize="words" />
        )}
        <Field label="EMAIL" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
        {mode !== 'reset' && (
          <Field label="PASSWORD" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} />
        )}

        <Pressable style={[styles.button, busy && { opacity: 0.5 }]} disabled={busy} onPress={submit}>
          <Text style={styles.buttonText}>{busy ? 'ONE MOMENT…' : mode === 'signin' ? 'SIGN IN' : mode === 'signup' ? 'JOIN' : 'SEND THE LINK'}</Text>
        </Pressable>

        <View style={styles.links}>
          {mode !== 'signin' && <Pressable onPress={() => setMode('signin')}><Text style={styles.link}>Sign in instead</Text></Pressable>}
          {mode !== 'signup' && <Pressable onPress={() => setMode('signup')}><Text style={styles.link}>No account yet? Join the House</Text></Pressable>}
          {mode !== 'reset' && <Pressable onPress={() => setMode('reset')}><Text style={styles.link}>Forgotten your password?</Text></Pressable>}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function Field(props: React.ComponentProps<typeof TextInput> & { label: string }) {
  const { label, ...rest } = props;
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput {...rest} style={styles.input} placeholderTextColor={colors.greyMuted} />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { padding: space.lg, gap: space.md, alignItems: 'stretch' },
  star: { color: colors.gold, fontSize: 20, textAlign: 'center' },
  eyebrow: { color: colors.gold, fontSize: 11, letterSpacing: 3, textAlign: 'center' },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 30, textAlign: 'center', marginBottom: space.sm },
  error: { color: colors.ivory, backgroundColor: 'rgba(179,66,58,0.15)', borderLeftColor: colors.danger, borderLeftWidth: 2, padding: space.sm },
  message: { color: colors.ivory, backgroundColor: 'rgba(201,169,97,0.12)', borderLeftColor: colors.gold, borderLeftWidth: 2, padding: space.sm },
  field: { gap: 6 },
  label: { color: colors.greyMuted, fontSize: 11, letterSpacing: 2 },
  input: { borderColor: colors.rule, borderWidth: 1, color: colors.ivory, padding: 12, fontSize: 16, backgroundColor: colors.inkRaised },
  button: { borderColor: colors.gold, borderWidth: 1, paddingVertical: 12, marginTop: space.sm },
  buttonText: { color: colors.gold, letterSpacing: 3, fontSize: 12, textAlign: 'center' },
  links: { gap: space.sm, marginTop: space.md, alignItems: 'center' },
  link: { color: colors.gold, fontSize: 14 },
});
