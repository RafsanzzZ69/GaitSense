import React, { createContext, useContext, useMemo, useState } from 'react';
import { createClient, type Profile, type Tokens } from './client';

export const showcase = process.env.EXPO_PUBLIC_SHOWCASE === 'true';
const url = showcase ? '' : (process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000/api/v1');
type Context = { client: ReturnType<typeof createClient>; profile: Profile | null; setProfile: (profile: Profile) => void;
  loggedIn: boolean; demo: boolean; enterDemo: () => void; leave: () => void; authenticate: (tokens: Tokens) => void };
const WebContext = createContext<Context | null>(null);
export function WebProvider({ children }: React.PropsWithChildren) {
  const [loggedIn, setLoggedIn] = useState(false), [demo, setDemo] = useState(showcase), [profile, setProfile] = useState<Profile | null>(showcase ? { displayName: 'Alex Morgan' } : null);
  const client = useMemo(() => createClient(url, () => { setLoggedIn(false); setProfile(null); }), []);
  const value = { client, profile, setProfile, loggedIn, demo,
    enterDemo: () => { client.clear(); setLoggedIn(false); setDemo(true); setProfile({ displayName: 'Alex Morgan' }); },
    leave: () => { client.clear(); setLoggedIn(false); setDemo(false); setProfile(null); },
    authenticate: (tokens: Tokens) => { client.save(tokens); setDemo(false); setLoggedIn(true); } };
  // Tokens intentionally live in memory only; reload requires a new login.
  return <WebContext.Provider value={value}>{children}</WebContext.Provider>;
}
export const useWeb = () => { const value = useContext(WebContext); if (!value) throw Error('WebProvider missing'); return value; };
