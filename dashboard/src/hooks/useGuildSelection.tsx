import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

interface GuildContextValue {
  selectedGuildId: string | null;
  setSelectedGuildId: (id: string | null) => void;
}

const GuildContext = createContext<GuildContextValue | null>(null);

const STORAGE_KEY = 'nexus.selectedGuildId';

export function GuildProvider({ children }: { children: ReactNode }) {
  const [selectedGuildId, setSelectedGuildIdState] = useState<string | null>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  });

  const setSelectedGuildId = (id: string | null) => {
    setSelectedGuildIdState(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  };

  const value = useMemo(
    () => ({ selectedGuildId, setSelectedGuildId }),
    [selectedGuildId],
  );

  return <GuildContext.Provider value={value}>{children}</GuildContext.Provider>;
}

export function useGuildSelection(): GuildContextValue {
  const ctx = useContext(GuildContext);
  if (!ctx) throw new Error('useGuildSelection must be used within GuildProvider');
  return ctx;
}
