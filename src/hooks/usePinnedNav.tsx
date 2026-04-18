import { useCallback, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const PINNED_KEY = 'bp_pinned_nav';
const RECENT_KEY = 'bp_recent_nav';
const MAX_PINNED = 4;
const MAX_RECENT = 3;

function read(key: string): string[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function write(key: string, v: string[]) {
  localStorage.setItem(key, JSON.stringify(v));
}

export function usePinnedNav() {
  const [pinned, setPinned] = useState<string[]>(() => read(PINNED_KEY));
  const [recent, setRecent] = useState<string[]>(() => read(RECENT_KEY));
  const location = useLocation();

  // Track recents
  useEffect(() => {
    const path = location.pathname;
    if (!path.startsWith('/dashboard') || path === '/dashboard') return;
    setRecent(prev => {
      const next = [path, ...prev.filter(p => p !== path)].slice(0, MAX_RECENT);
      write(RECENT_KEY, next);
      return next;
    });
  }, [location.pathname]);

  const isPinned = useCallback((path: string) => pinned.includes(path), [pinned]);

  const togglePin = useCallback((path: string) => {
    setPinned(prev => {
      const next = prev.includes(path)
        ? prev.filter(p => p !== path)
        : [...prev, path].slice(0, MAX_PINNED);
      write(PINNED_KEY, next);
      return next;
    });
  }, []);

  return { pinned, recent, isPinned, togglePin };
}
