import Image from 'next/image';

/**
 * A 40px story thumbnail.
 *
 * Not the <Cover> component, which draws the title and author as
 * artwork: at this size that is a smudge of unreadable text. A list row
 * needs something to aim the eye at, not something to read — the title
 * is already right beside it.
 *
 * So: the real cover when there is one, and otherwise a tinted tile with
 * the initial. The tint is derived from the title, so a given story keeps
 * the same colour everywhere it appears and the row stays recognisable.
 */
const TINTS = [
  'bg-[#3A2E14] text-[#E0B45A]',
  'bg-[#2E2438] text-[#B49BE0]',
  'bg-[#1E3038] text-[#8FB4DA]',
  'bg-[#243020] text-[#9FC48B]',
  'bg-[#38241E] text-[#D89A8A]',
];

export function Thumb({ src, title }: { src: string | null; title: string }) {
  if (src) {
    return (
      <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded">
        <Image src={src} alt="" fill sizes="2.5rem" className="object-cover" />
      </span>
    );
  }

  let hash = 0;
  for (const ch of title) hash = (hash + ch.charCodeAt(0)) % 997;

  return (
    <span
      aria-hidden="true"
      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded font-display text-base ${
        TINTS[hash % TINTS.length]
      }`}
    >
      {title.trim().charAt(0).toUpperCase()}
    </span>
  );
}
