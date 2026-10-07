import { Link } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/constants/theme';
import type { StoryCard } from '@/lib/content';

/**
 * A story in a list: cover, shelf, title, a line of its logline, the
 * minutes, and the bookmark. Used by the Library, Home and the mood feed.
 */
export function StoryRow({ item, saved, onSave }: { item: StoryCard; saved?: boolean; onSave?: () => void }) {
  return (
    <Link href={{ pathname: '/story/[slug]', params: { slug: item.slug } }} asChild>
      <Pressable style={styles.card}>
        {item.coverImage ? (
          <Image source={{ uri: item.coverImage }} style={styles.cover} />
        ) : (
          <View style={[styles.cover, styles.coverDrawn]}>
            <Text style={styles.coverStar}>✦</Text>
          </View>
        )}
        <View style={styles.meta}>
          <Text style={styles.cardTitle} numberOfLines={2}>
            {item.title}
          </Text>
          {(item.subtitle || item.excerpt) && (
            <Text style={styles.subtitle} numberOfLines={2}>
              {item.subtitle ?? item.excerpt}
            </Text>
          )}
          <View style={styles.row}>
            <Text style={styles.small}>◷ {item.readingMinutes} min</Text>
            {item.hasAudio && <Text style={styles.small}>♪</Text>}
            {item.access === 'premium' && <Text style={styles.badge}>PREMIUM</Text>}
            {item.access === 'paid' && <Text style={styles.badge}>BOOK</Text>}
            {item.forSleep && <Text style={styles.small}>☾</Text>}
          </View>
        </View>
        {onSave && (
          <Pressable onPress={onSave} hitSlop={10} style={styles.save}>
            <Text style={[styles.saveGlyph, saved && { color: colors.gold }]}>{saved ? '▮' : '▯'}</Text>
          </Pressable>
        )}
      </Pressable>
    </Link>
  );
}

const styles = StyleSheet.create({
  card: { flexDirection: 'row', gap: space.md, backgroundColor: colors.inkRaised, borderColor: colors.rule, borderWidth: 1, borderRadius: 14, padding: space.sm, alignItems: 'center' },
  cover: { width: 64, height: 86, borderRadius: 8, backgroundColor: colors.rule },
  coverDrawn: { alignItems: 'center', justifyContent: 'center' },
  coverStar: { color: colors.gold, fontSize: 20 },
  meta: { flex: 1, gap: 3, justifyContent: 'center' },
  cardTitle: { color: colors.ivory, fontFamily: 'Georgia', fontSize: 17, lineHeight: 22 },
  subtitle: { color: colors.grey, fontSize: 12.5, lineHeight: 17 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'center', marginTop: 2 },
  small: { color: colors.greyMuted, fontSize: 12 },
  badge: { color: colors.gold, fontSize: 9, letterSpacing: 2, borderColor: colors.gold, borderWidth: 1, borderRadius: 4, paddingHorizontal: 5, paddingVertical: 1 },
  save: { padding: 6 },
  saveGlyph: { color: colors.greyMuted, fontSize: 18 },
});
