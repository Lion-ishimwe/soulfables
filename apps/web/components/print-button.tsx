'use client';

/** Prints the page. Hidden in print, naturally. */
export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="border border-gold/50 px-5 py-2 font-ui text-xs uppercase tracking-[0.16em] text-gold transition-all hover:bg-gold hover:text-ink print:hidden"
    >
      Print or save as PDF
    </button>
  );
}
