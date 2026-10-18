import { createContext, useContext, useEffect, useState } from 'react';
import { api, getToken, setToken } from './api';

const Ctx = createContext(null);
export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!getToken()) { setReady(true); return; }
    api('/auth/me').then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true));
  }, []);
  useEffect(() => {
    const out = () => { setToken(null); setUser(null); };
    window.addEventListener('pp-logout', out);
    return () => window.removeEventListener('pp-logout', out);
  }, []);

  const finish = (r) => { setToken(r.token); setUser(r.user); return r.user; };
  const value = {
    user, ready,
    login: async (email, password) => finish(await api('/auth/login', { method: 'POST', body: { email, password } })),
    register: async (name, email, password) => finish(await api('/auth/register', { method: 'POST', body: { name, email, password } })),
    logout: () => { api('/auth/logout', { method: 'POST' }).catch(() => {}); setToken(null); setUser(null); },
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
