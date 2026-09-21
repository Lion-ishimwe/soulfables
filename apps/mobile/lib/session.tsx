import type { Session } from '@supabase/supabase-js';
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { supabase } from './supabase';

/**
 * Who is signed in, for every screen.
 *
 * Read once from storage on start, then kept current by the auth
 * client's own events: sign in, sign out, token refresh. `ready` is
 * false until the first read, so the root layout can hold the splash
 * rather than flash the door at a reader who is already in.
 */
type SessionState = { session: Session | null; ready: boolean };

const Ctx = createContext<SessionState>({ session: null, ready: false });

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ session: null, ready: false });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setState({ session: data.session, ready: true }));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setState({ session, ready: true });
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  return <Ctx.Provider value={state}>{children}</Ctx.Provider>;
}

export const useSession = () => useContext(Ctx);
