import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

type Ctx = { version: number; bump: () => void };
const AppDataContext = createContext<Ctx>({ version: 0, bump: () => undefined });

/** Contador de versão dos dados: qualquer tela que muda dados chama bump(); as telas recarregam. */
export const AppDataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [version, setVersion] = useState(0);
  const bump = useCallback(() => setVersion((v) => v + 1), []);
  const value = useMemo(() => ({ version, bump }), [version, bump]);
  return <AppDataContext.Provider value={value}>{children}</AppDataContext.Provider>;
};

export const useAppData = () => useContext(AppDataContext);

export function errorMessage(e: unknown): string {
  if (e && typeof e === 'object' && 'messages' in e && Array.isArray((e as { messages: unknown }).messages)) {
    return (e as { messages: string[] }).messages.join(' ');
  }
  return e instanceof Error ? e.message : 'Algo deu errado. Tente novamente.';
}
