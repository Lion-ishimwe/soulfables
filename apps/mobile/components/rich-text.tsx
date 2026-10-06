import { StyleSheet, Text, View } from 'react-native';
import { colors, space } from '@/constants/theme';

/**
 * The House's Markdown, drawn with native text.
 *
 * Stories and letters use a small dialect: a blank line between
 * paragraphs, a line beginning "::" or "#" as a heading, ">" as a
 * quote, **bold** and *italic*. That is all a story needs, and it keeps
 * the reader free of a web view.
 */
type Run = { text: string; bold?: boolean; italic?: boolean };

function runs(line: string): Run[] {
  const out: Run[] = [];
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|_(.+?)_)/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(line))) {
    if (m.index > last) out.push({ text: line.slice(last, m.index) });
    if (m[2]) out.push({ text: m[2], bold: true });
    else out.push({ text: m[3] ?? m[4] ?? '', italic: true });
    last = m.index + m[0].length;
  }
  if (last < line.length) out.push({ text: line.slice(last) });
  return out;
}

function Inline({ line, style }: { line: string; style: object }) {
  return (
    <Text style={style}>
      {runs(line).map((r, i) => (
        <Text key={i} style={[r.bold && styles.bold, r.italic && styles.italic]}>
          {r.text}
        </Text>
      ))}
    </Text>
  );
}

export function RichText({ markdown, size = 18, dropTitle }: { markdown: string; size?: number; dropTitle?: string }) {
  let blocks = markdown.replace(/\r\n?/g, '\n').split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);
  // The body often opens with the title as a heading; the page already says it.
  if (dropTitle && blocks[0] && /^#{1,3}\s*/.test(blocks[0]) && blocks[0].replace(/^#{1,3}\s*/, '').trim().toLowerCase() === dropTitle.trim().toLowerCase()) {
    blocks = blocks.slice(1);
  }
  return (
    <View style={styles.body}>
      {blocks.map((block, i) => {
        if (/^(::|#{1,3})\s*/.test(block)) {
          return <Inline key={i} line={block.replace(/^(::|#{1,3})\s*/, '')} style={styles.heading} />;
        }
        if (block.startsWith('>')) {
          return (
            <View key={i} style={styles.quote}>
              <Inline line={block.replace(/^>\s?/gm, '')} style={[styles.paragraph, styles.quoteText, { fontSize: size }]} />
            </View>
          );
        }
        if (/^(-{3,}|\*{3,})$/.test(block)) return <Text key={i} style={styles.rule}>✦</Text>;
        return <Inline key={i} line={block.replace(/\n/g, ' ')} style={[styles.paragraph, { fontSize: size, lineHeight: size * 1.65 }]} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  paragraph: { color: colors.ivory, fontFamily: 'Georgia' },
  heading: { color: colors.gold, fontFamily: 'Georgia', fontSize: 21, marginTop: space.sm },
  quote: { borderLeftWidth: 2, borderLeftColor: colors.gold, paddingLeft: space.md, marginVertical: space.xs },
  quoteText: { color: colors.grey, fontStyle: 'italic' },
  rule: { color: colors.gold, textAlign: 'center', fontSize: 16, marginVertical: space.sm },
  bold: { fontWeight: '700' },
  italic: { fontStyle: 'italic' },
});
