import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

export interface Account {
  id: number;
  kind: 'staff' | 'worker' | 'client' | 'supervisor';
  userId: number | null;
  candidateId: number | null;
  clientId: number | null;
  contactId: number | null;
  email: string;
  accessRole: 'admin' | 'office' | 'compliance' | 'finance' | null;
  name: string;
  initials: string | null;
  color: string | null;
  photoFileId: number | null;
}

interface AuthCtx {
  account: Account | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const Ctx = createContext<AuthCtx>({
  account: null, loading: true,
  login: async () => {}, logout: async () => {}, refresh: async () => {},
});

export const useAuth = () => useContext(Ctx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { account } = await api.get<{ account: Account }>('/auth/me');
      setAccount(account);
    } catch {
      setAccount(null);
    }
  };

  useEffect(() => { refresh().finally(() => setLoading(false)); }, []);

  const login = async (email: string, password: string) => {
    await api.post('/auth/login', { email, password });
    await refresh();
  };

  const logout = async () => {
    await api.post('/auth/logout', {}).catch(() => {});
    setAccount(null);
  };

  return <Ctx.Provider value={{ account, loading, login, logout, refresh }}>{children}</Ctx.Provider>;
}
