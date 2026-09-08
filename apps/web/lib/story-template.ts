import 'server-only';

/**
 * The story template.
 *
 * A writer should not have to sit in a browser text box for three hours.
 * The template is a plain Markdown file with a small front-matter block:
 * downloadable, writable in anything, and uploadable when it is done.
 *
 * Markdown rather than .docx on purpose. It is diffable, it survives
 * every editor, it is what the reader already renders, and it does not
 * need a library to parse — the format is the same subset the admin
 * editor writes, so nothing is lost in translation either way.
 */

export const TEMPLATE_FILENAME = 'soulfables-story-template.md';

export function buildTemplate(opts: {
  title?: string;
  subtitle?: string;
  author?: string;
  shelf?: string;
  release?: 'full' | 'serial';
  /*
   * A concept the writer chose, carried into the file as a comment so
   * it is there when they sit down and gone when they upload. Sections
   * become real :: markers below it, ready to be written under.
   */
  concept?: { premise: string; opening: string; sections: string[] };
  shelves: { slug: string; label: string }[];
} = { shelves: [] }): string {
  const shelfList = opts.shelves.map((s) => s.slug).join(', ') || 'heartbreak, healing, grief';

  const conceptBlock = opts.concept
    ? `
<!--
  THE CONCEPT YOU CHOSE
  ---------------------
  ${opts.concept.premise.replace(/\n+/g, ' ')}

  Suggested opening:
  ${opts.concept.opening.replace(/\n+/g, ' ')}

  Change any of it. It was a way in, not a plan.
-->

`
    : '';

  const body = opts.concept
    ? `${opts.concept.opening.trim() || 'Begin here.'}

${(opts.concept.sections.length ? opts.concept.sections : ['The First Section'])
  .map((title) => `:: ${title}\n\n`)
  .join('\n')}`
    : `Begin here. The first paragraph is the one people decide on, so it is
worth more of your evening than the rest.

:: The First Section

Sections are optional in a full story and become the chapters of a
serial one.

> A line worth remembering goes here.

Carry on for as long as the story needs.
`;

  return `---
title: ${opts.title ?? 'Your title here'}
subtitle: ${opts.subtitle ?? 'One line that goes under the title on every card.'}
author: ${opts.author ?? 'Your name'}
shelf: ${opts.shelf ?? 'heartbreak'}
access: free
release: ${opts.release ?? 'full'}
---

<!--
  SOULFABLES — STORY TEMPLATE
  ===========================

  Everything above the --- line is the story's details. Everything below
  is the story. Keep the --- lines where they are.

  shelf     one of: ${shelfList}
  access    free, or premium for Residents only
  release   full   — the whole story goes out at once
            serial — released a chapter at a time

  WRITING
  -------
  Leave a blank line between paragraphs.

  Start a section with two colons:

      :: The House Waits

  Sections are how bookmarks and narration find their place, so they
  survive later edits to the words around them. In a serial story, each
  :: section becomes a chapter.

  A line beginning with > is a pull quote:

      > Grief is not the fire. It is the smoke that lingers after.

  *italic* and **bold** work as you would expect. Nothing else is
  needed, and nothing else is supported — a story is prose, not a
  document format.

  WHEN YOU ARE DONE
  -----------------
  Save the file and upload it. It arrives as a draft; nothing is
  published until the House has read it.

  Delete this whole comment block if you like. It is ignored either way.
-->
${conceptBlock}${body}`;
}

export type ParsedStory = {
  title: string;
  subtitle: string;
  author: string | null;
  shelf: string | null;
  access: 'free' | 'premium';
  release: 'full' | 'serial';
  body: string;
  /** Section titles found, so a serial can be split into chapters. */
  sections: { title: string; body: string }[];
  warnings: string[];
};

/**
 * Read an uploaded template back.
 *
 * Forgiving by design: a writer who deletes the front matter, or types
 * `Shelf:` with a capital, or uses smart quotes, should get their story
 * in with a warning rather than a rejection. The only hard requirement
 * is that there is a title and some words.
 */
export function parseTemplate(raw: string): ParsedStory | { error: string } {
  const text = raw.replace(/\r\n/g, '\n').trim();
  if (!text) return { error: 'That file is empty.' };

  const warnings: string[] = [];
  const meta: Record<string, string> = {};
  let body = text;

  const fm = text.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    for (const line of fm[1].split('\n')) {
      const m = line.match(/^\s*([A-Za-z_]+)\s*:\s*(.*)$/);
      if (m) meta[m[1].toLowerCase()] = m[2].trim();
    }
    body = text.slice(fm[0].length);
  } else {
    warnings.push('No details block found, so the title was taken from the first line.');
  }

  // Strip the instructions comment, and any other HTML comment.
  body = body.replace(/<!--[\s\S]*?-->/g, '').trim();

  let title = meta.title?.trim() ?? '';
  if (!title || /^your title here$/i.test(title)) {
    const firstLine = body.split('\n').find((l) => l.trim());
    title = (firstLine ?? '').replace(/^#+\s*/, '').trim().slice(0, 200);
    if (meta.title) warnings.push('The title was still the placeholder, so the first line was used.');
  }

  if (!title) return { error: 'No title found. Add one to the details block at the top.' };
  if (!body) return { error: 'The story is empty — only details, no words.' };

  const access = meta.access?.toLowerCase() === 'premium' ? 'premium' : 'free';
  const release = meta.release?.toLowerCase() === 'serial' ? 'serial' : 'full';

  if (meta.access && !['free', 'premium'].includes(meta.access.toLowerCase())) {
    warnings.push(`"${meta.access}" is not a known access level, so it came in as free.`);
  }

  // Split on :: markers, which become chapters for a serial.
  const sections: { title: string; body: string }[] = [];
  const parts = body.split(/^::\s*(.+)$/gm);

  if (parts.length > 1) {
    for (let i = 1; i < parts.length; i += 2) {
      sections.push({
        title: parts[i].trim(),
        body: (parts[i + 1] ?? '').trim(),
      });
    }
  }

  if (release === 'serial' && sections.length === 0) {
    warnings.push(
      'Marked as a serial but has no :: sections, so it came in as one whole story.',
    );
  }

  return {
    title,
    subtitle: meta.subtitle?.trim().replace(/^One line that goes.*$/i, '') ?? '',
    author: meta.author?.trim().replace(/^your name$/i, '') || null,
    shelf: meta.shelf?.trim().toLowerCase() || null,
    access,
    release: release === 'serial' && sections.length > 0 ? 'serial' : 'full',
    body,
    sections,
    warnings,
  };
}
