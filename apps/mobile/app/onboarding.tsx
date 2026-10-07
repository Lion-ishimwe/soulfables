import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Dimensions, Pressable, ScrollView, StyleSheet, Text, View, type NativeScrollEvent, type NativeSyntheticEvent } from 'react-native';
import { Button } from '@/components/ui';
import { colors, space } from '@/constants/theme';
import { setOnboarded } from '@/lib/prefs';

/**
 * The welcome, shown once. Three pages that say what the place is for,
 * then the two doors: begin, or come in with an account you already have.
 */
const PAGES = [
  { glyph: '✦', title: 'Stories that\nfeel like home.', body: 'Meaningful stories, reflection, journaling, mood awareness, audio, and personal growth.' },
  { glyph: '☾', title: 'Arrive. Feel.\nRead. Reflect.', body: 'Say how you are arriving, and the House hands you a story for it. Then a question to put the feeling somewhere.' },
  { glyph: '✎', title: 'A private room,\nand a quiet wall.', body: 'Your journal is yours alone. The Residents share what they choose, read by a person before it is shown.' },
];

export default function OnboardingScreen() {
  const [page, setPage] = useState(0);
  const scroll = useRef<ScrollView>(null);
  const width = Dimensions.get('window').width;

  const finish = async (to: '/signin?mode=signup' | '/signin' | '/') => {
    await setOnboarded();
    router.replace(to as never);
  };

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    setPage(Math.round(e.nativeEvent.contentOffset.x / width));
  };

  return (
    <View style={styles.screen}>
      <Pressable style={styles.skip} onPress={() => finish('/')} hitSlop={10}>
        <Text style={styles.skipText}>Skip</Text>
      </Pressable>
      <ScrollView ref={scroll} horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={onScroll} style={{ flex: 1 }} contentContainerStyle={{ flexGrow: 1 }}>
        {PAGES.map((p, i) => (
          <View key={i} style={[styles.page, { width }]}>
            <View style={styles.art}>
              <Text style={styles.glyph}>{p.glyph}</Text>
            </View>
            <Text style={styles.title}>{p.title}</Text>
            <Text style={styles.body}>{p.body}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.dots}>
        {PAGES.map((_, i) => (
          <View key={i} style={[styles.dot, i === page && styles.dotOn]} />
        ))}
      </View>
      <View style={styles.actions}>
        <Button label="Get Started" onPress={() => finish('/signin?mode=signup')} />
        <Pressable onPress={() => finish('/signin')} style={{ paddingVertical: 10 }}>
          <Text style={styles.already}>I already have an account</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.ink, paddingTop: 54 },
  skip: { position: 'absolute', top: 54, right: space.lg, zIndex: 2, padding: 6 },
  skipText: { color: colors.grey, fontSize: 14 },
  page: { padding: space.lg, justifyContent: 'flex-end', gap: space.md, height: '100%' },
  art: { flex: 1, borderRadius: 24, backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginTop: space.xl, marginBottom: space.md },
  glyph: { color: colors.gold, fontSize: 64 },
  title: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 32, lineHeight: 38 },
  body: { color: colors.grey, fontSize: 15, lineHeight: 22 },
  dots: { flexDirection: 'row', gap: 8, justifyContent: 'center', paddingVertical: space.md },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.rule },
  dotOn: { backgroundColor: colors.gold, width: 18 },
  actions: { padding: space.lg, paddingBottom: space.xl, gap: space.xs, alignItems: 'stretch' },
  already: { color: colors.gold, textAlign: 'center', fontSize: 14 },
});
