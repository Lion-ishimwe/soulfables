import type { ReactNode } from 'react';

/**
 * Render a story body.
 *
 * This builds React elements directly rather than producing an HTML
 * string, which means there is no `dangerouslySetInnerHTML` anywhere in
 * the reading path and no way for content to inject markup — a property
 * worth keeping even though today the only authors are staff.
 *
 * It handles the subset the House actually writes, and nothing more:
 *
 *   :: Section Title   a section marker, rendered as a quiet caps line
 *   > quoted line      a pull quote
 *   *emphasis*         italic
 *   **strong**         emphasised
 *   blank line         paragraph break
 *
 * Anything else passes through as plain text. A story is prose, not a
 * document format, and every construct added here is one more thing that
 * can render wrongly at 2am.
 */

type Token =
  | { kind: 'section'; text: string; slug: string }
  | { kind: 'quote'; text: string }
  | { kind: 'para'; text: string };

export function tokenizeStory(body: string): Token[] {
  const tokens: Token[] = [];
  // Normalise line endings first: content authored on Windows would
  // otherwise never match the block separators.
  const blocks = body.replace(/\r\n/g, '\n').split(/\n{2,}/);

  for (const raw of blocks) {
    const block = raw.trim();
    if (!block) continue;

    const section = block.match(/^::\s*(.+)$/);
    if (section) {
      const text = section[1].trim();
      tokens.push({
        kind: 'section',
        text,
        slug:
          text
            .toLowerCase()
            .normalize('NFKD')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'section',
      });
      continue;
    }

    if (block.startsWith('>')) {
      tokens.push({
        kind: 'quote',
        text: block
          .split('\n')
          .map((l) => l.replace(/^>\s?/, ''))
          .join(' ')
          .trim(),
      });
      continue;
    }

    // Soft line breaks inside a paragraph become spaces, as in prose.
    tokens.push({ kind: 'para', text: block.replace(/\n/g, ' ') });
  }

  return tokens;
}

/** Inline emphasis. Returns React nodes, never HTML. */
function inline(text: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > last) nodes.push(text.slice(last, match.index));

    const token = match[0];
    if (token.startsWith('**')) {
      nodes.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
    } else {
      nodes.push(<em key={key++}>{token.slice(1, -1)}</em>);
    }
    last = match.index + token.length;
  }

  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export function StoryBody({ body }: { body: string }) {
  const tokens = tokenizeStory(body);

  return (
    <div className="sf-prose mx-auto">
      {tokens.map((t, i) => {
        if (t.kind === 'section') {
          // id, so a bookmark can scroll straight back to the section.
          return (
            <h2 key={i} id={t.slug}>
              {t.text}
            </h2>
          );
        }
        if (t.kind === 'quote') {
          return <blockquote key={i}>{inline(t.text)}</blockquote>;
        }
        return <p key={i}>{inline(t.text)}</p>;
      })}
    </div>
  );
}
