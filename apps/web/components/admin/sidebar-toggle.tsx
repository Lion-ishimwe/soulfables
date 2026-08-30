'use client';

import { useState, useEffect } from 'react';

/**
 * Collapse the sidebar.
 *
 * A dashboard is often read next to something else — a spreadsheet, the
 * live site, a manuscript — so being able to give the content the whole
 * width is worth one small piece of state.
 *
 * The choice is remembered in localStorage, because a preference that
 * resets on every navigation is not a preference. Both the read and the
 * write are guarded: a private window or a browser with site data blocked
 * throws on access rather than returning null, and the toggle must still
 * work there.
 */
export function SidebarToggle() {
  const [collapsed, setCollapsed] = useState(false);

  // Applied to the DOM rather than passed down, because the sidebar is a
  // server component and this button is not its parent.
  useEffect(() => {
    let saved = false;
    try {
      saved = localStorage.getItem('sf-admin-sidebar') === 'collapsed';
    } catch {
      /* storage unavailable — start expanded */
    }
    setCollapsed(saved);
  }, []);

  useEffect(() => {
    const aside = document.getElementById('admin-sidebar');
    if (aside) aside.classList.toggle('lg:hidden', collapsed);
    try {
      localStorage.setItem('sf-admin-sidebar', collapsed ? 'collapsed' : 'open');
    } catch {
      /* nothing to remember it with; the toggle still works this session */
    }
  }, [collapsed]);

  return (
    <button
      type="button"
      onClick={() => setCollapsed((c) => !c)}
      aria-label={collapsed ? 'Show sections' : 'Hide sections'}
      aria-expanded={!collapsed}
      aria-controls="admin-sidebar"
      className="hidden text-grey-muted transition-colors hover:text-ivory lg:block"
    >
      <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
        <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
      </svg>
    </button>
  );
}
