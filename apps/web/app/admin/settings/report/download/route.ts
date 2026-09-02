import { NextResponse } from 'next/server';
import { getViewer, isStaff } from '@/lib/auth';
import { getReport } from '@/lib/report';
import { formatDate } from '@/lib/format';

/**
 * The report, as a file.
 *
 * One CSV per table rather than one file with three tables stacked in
 * it. A CSV is a table by definition, and a spreadsheet opening three of
 * them glued together shows one set of headings and two rows of
 * nonsense. `?part=` picks which.
 *
 * Staff only, checked here rather than trusted from the page: a route
 * handler is a URL, and a URL is guessable. Middleware already guards
 * /admin, and this checks again — the same belt-and-braces the rest of
 * the admin uses.
 */

/**
 * Escape a value for CSV, and defuse it for spreadsheets.
 *
 * A cell beginning =, +, - or @ is a formula to Excel and Sheets, so a
 * reader who signs up as "=cmd|…" becomes a command in whoever opens the
 * export. Prefixing with an apostrophe makes it text. This is the one
 * part of a CSV writer worth being careful about — the quoting is
 * obvious, the injection is not.
 */
function cell(value: unknown): string {
  const raw = value === null || value === undefined ? '' : String(value);
  const defused = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${defused.replace(/"/g, '""')}"`;
}

function csv(headers: string[], rows: unknown[][]): string {
  // A BOM, so Excel opens UTF-8 as UTF-8 rather than as mojibake. Names
  // and story titles here carry accents and curly quotes.
  return (
    '﻿' +
    [headers.map(cell).join(','), ...rows.map((r) => r.map(cell).join(','))].join('\r\n') +
    '\r\n'
  );
}

export async function GET(request: Request) {
  const viewer = await getViewer();
  if (!viewer || !isStaff(viewer.role)) {
    return new NextResponse('Not found', { status: 404 });
  }

  const part = new URL(request.url).searchParams.get('part') ?? 'readers';
  const report = await getReport(30);
  const stamp = new Date().toISOString().slice(0, 10);

  let name: string;
  let body: string;

  switch (part) {
    case 'opens':
      name = `soulfables-opens-${stamp}.csv`;
      body = csv(
        ['Date', 'Stories opened'],
        report.daily.map((d) => [d.date, d.value]),
      );
      break;

    case 'stories':
      name = `soulfables-stories-${stamp}.csv`;
      body = csv(
        ['Story', 'Slug', 'Opens', 'Finished'],
        report.topStories.map((s) => [s.title, s.slug, s.opens, s.finished]),
      );
      break;

    case 'readers':
    default:
      name = `soulfables-readers-${stamp}.csv`;
      body = csv(
        ['Name', 'Email', 'Role', 'Tier', 'Stories read', 'Joined'],
        report.readers.map((r) => [
          r.displayName ?? '',
          r.email,
          r.role,
          r.plan,
          r.storiesRead,
          formatDate(r.joinedAt),
        ]),
      );
      break;
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${name}"`,
      // A report is a snapshot of a moment. Caching one would hand
      // somebody yesterday's numbers in a file named today.
      'Cache-Control': 'no-store',
    },
  });
}
