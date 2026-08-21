import Link from 'next/link';

/*
 * Footer columns mirror the live site, with one deliberate omission: the
 * "STUDIO" column (Roadmap / Design System / UI Kit) is internal tooling
 * and does not belong in a public footer. Those pages move behind /admin.
 */
const COLUMNS = [
  {
    heading: 'Explore',
    links: [
      { href: '/library', label: 'Library' },
      { href: '/wander', label: 'Wander' },
      { href: '/shelves', label: 'Shelves' },
      { href: '/residents', label: 'Residents' },
    ],
  },
  {
    heading: 'Reading Room',
    links: [
      { href: '/journal', label: 'Reading Journal' },
      { href: '/letter', label: 'Weekly Letter' },
      { href: '/shop/the-reflection-deck', label: 'Reflection Deck' },
      { href: '/companion', label: 'The Librarian' },
    ],
  },
  {
    heading: 'Shop',
    links: [
      { href: '/shop', label: 'Bookshop' },
      { href: '/account/library', label: 'My Library' },
      { href: '/account/orders', label: 'Orders' },
      { href: '/membership', label: 'Residency' },
    ],
  },
  {
    heading: 'The House',
    links: [
      { href: '/about', label: 'About the House' },
      { href: '/account/settings', label: 'Account' },
      { href: '/foundation', label: 'Foundation' },
      { href: '/constitution', label: 'Constitution' },
    ],
  },
] as const;

export function SiteFooter() {
  return (
    <footer className="mt-32 border-t border-rule">
      <div className="mx-auto max-w-page px-5 py-16 sm:px-8">
        <p className="text-center font-display text-lg italic text-grey-muted">
          The lamp will be here when you return.
        </p>

        <div className="mt-16 grid gap-12 md:grid-cols-[1.4fr_repeat(4,1fr)]">
          <div>
            <p className="mb-4 text-gold" aria-hidden="true">
              ✦
            </p>
            <p className="font-display text-2xl text-ivory">House of Soulfables</p>
            <p className="mt-2 font-display text-lg italic text-grey-muted">
              Every Soul Has a Story.
            </p>
            <p className="mt-5 max-w-xs text-sm leading-normal text-grey-muted">
              A quiet place for modern folktales about love, loss, healing,
              identity, hope, and becoming.
            </p>
          </div>

          {COLUMNS.map((col) => (
            <nav key={col.heading} aria-label={col.heading}>
              <h2 className="sf-eyebrow mb-5">{col.heading}</h2>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="text-sm text-grey transition-colors duration-base ease-house hover:text-gold"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-rule pt-8 text-xs text-grey-muted sm:flex-row">
          <p>© {new Date().getFullYear()} Soulfables</p>
          <div className="flex items-center gap-5">
            <Link href="/privacy" className="transition-colors hover:text-ivory">
              Privacy
            </Link>
            <Link href="/terms" className="transition-colors hover:text-ivory">
              Terms
            </Link>
            <span className="italic">Made with quiet care</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
