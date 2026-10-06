import { Component, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/constants/theme';
import { reportError } from '@/lib/api';

/**
 * The last net. A screen that throws becomes a quiet page with a way
 * back, and the failure is written to the House's error log, where the
 * admin Report page shows it beside the site's own.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportError(error, 'app');
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={styles.centre}>
        <Text style={styles.star}>✦</Text>
        <Text style={styles.eyebrow}>A STUMBLE</Text>
        <Text style={styles.title}>Something in this page did not open.</Text>
        <Text style={styles.muted}>The House has made a note of it.</Text>
        <Pressable style={styles.button} onPress={() => this.setState({ error: null })}>
          <Text style={styles.buttonText}>TRY AGAIN</Text>
        </Pressable>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: space.xl, gap: space.sm, backgroundColor: colors.ink },
  star: { color: colors.gold, fontSize: 20 },
  eyebrow: { color: colors.gold, fontSize: 11, letterSpacing: 3 },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 26, textAlign: 'center', lineHeight: 32 },
  muted: { color: colors.greyMuted, textAlign: 'center' },
  button: { borderColor: colors.gold, borderWidth: 1, paddingVertical: 12, paddingHorizontal: 28, marginTop: space.md },
  buttonText: { color: colors.gold, letterSpacing: 3, fontSize: 12 },
});
