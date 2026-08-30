import Image from 'next/image';

/**
 * A person, or a voice.
 *
 * The House has bylines that are not people — The Librarian has no face
 * and should not be given a stand-in one. A persona gets the book mark
 * instead of an initial, so the two kinds of author are distinguishable
 * before you reach the "Kind" column.
 *
 * Where there is no portrait the initial sits on a tint derived from the
 * name, so a given author keeps the same colour everywhere they appear.
 */
const TINTS = [
  'bg-[#3A2E14] text-[#E0B45A]',
  'bg-[#2E2438] text-[#B49BE0]',
  'bg-[#1E3038] text-[#8FB4DA]',
  'bg-[#243020] text-[#9FC48B]',
  'bg-[#38241E] text-[#D89A8A]',
];

export function Avatar({
  src,
  name,
  isPersona = false,
  size = 44,
}: {
  src: string | null;
  name: string;
  isPersona?: boolean;
  size?: number;
}) {
  const box = { width: size, height: size };

  if (src) {
    return (
      <span
        className="relative block shrink-0 overflow-hidden rounded-full"
        style={box}
      >
        <Image src={src} alt="" fill sizes={`${size}px`} className="object-cover" />
      </span>
    );
  }

  if (isPersona) {
    return (
      <span
        className="flex shrink-0 items-center justify-center rounded-full bg-gold/10 text-gold"
        style={box}
        aria-hidden="true"
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
          <path d="M4 4h10a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3V4Zm3 3v10h7V7H7Z" />
        </svg>
      </span>
    );
  }

  let hash = 0;
  for (const ch of name) hash = (hash + ch.charCodeAt(0)) % 997;

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-display ${TINTS[hash % TINTS.length]}`}
      style={{ ...box, fontSize: size * 0.4 }}
      aria-hidden="true"
    >
      {name.trim().charAt(0).toUpperCase()}
    </span>
  );
}
