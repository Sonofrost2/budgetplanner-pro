import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { safeGet, safeSet } from '@/lib/safeStorage';

type ThemeMode = 'light' | 'dark' | 'auto';
type ResolvedTheme = 'light' | 'dark';

interface ThemeContextValue {
  mode: ThemeMode;
  theme: ResolvedTheme;
  setMode: (mode: ThemeMode) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  mode: 'light',
  theme: 'light',
  setMode: () => {},
  toggleTheme: () => {},
});

const getSystemTheme = (): ResolvedTheme =>
  window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';

const resolveTheme = (mode: ThemeMode): ResolvedTheme =>
  mode === 'auto' ? getSystemTheme() : mode;

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [mode, setModeState] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return 'light';
    const raw = safeGet('theme-mode');
    return raw === 'light' || raw === 'dark' || raw === 'auto' ? raw : 'light';
  });

  const [theme, setTheme] = useState<ResolvedTheme>(() => resolveTheme(mode));

  const applyTheme = (resolved: ResolvedTheme) => {
    document.documentElement.classList.add('theme-transition');
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    setTheme(resolved);
    setTimeout(() => document.documentElement.classList.remove('theme-transition'), 350);
  };

  const setMode = (newMode: ThemeMode) => {
    setModeState(newMode);
    safeSet('theme-mode', newMode);
    applyTheme(resolveTheme(newMode));
  };

  // Listen for system theme changes when in auto mode
  useEffect(() => {
    if (mode !== 'auto') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e: MediaQueryListEvent) => applyTheme(e.matches ? 'dark' : 'light');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [mode]);

  // Initial apply
  useEffect(() => {
    const resolved = resolveTheme(mode);
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    setTheme(resolved);
  }, []);

  const toggleTheme = () => {
    const next: ThemeMode = mode === 'light' ? 'dark' : mode === 'dark' ? 'auto' : 'light';
    setMode(next);
  };

  return (
    <ThemeContext.Provider value={{ mode, theme, setMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
