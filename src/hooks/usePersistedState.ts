import { useCallback, useEffect, useRef, useState } from 'react';
import { safeGetJSON, safeSetJSON } from '@/lib/safeStorage';
import { useAuth } from '@/hooks/useAuth';

/**
 * Same API as useState, but the value is persisted to localStorage and scoped
 * per authenticated user so switching accounts doesn't leak filter state.
 *
 * Rehydrates from storage on mount (and when the user changes) so navigating
 * away from a page and back preserves the previous selection.
 *
 * @param key    Stable key. Namespaced automatically with the user id.
 * @param initial Fallback used when nothing is stored yet.
 */
export function usePersistedState<T>(key: string, initial: T) {
  const { user } = useAuth();
  const uid = user?.id ?? 'anon';
  const storageKey = `bp:pref:${uid}:${key}`;
  const initialRef = useRef(initial);
  const [value, setValue] = useState<T>(() => safeGetJSON<T>(storageKey, initialRef.current));

  // Rehydrate when the user changes (login/logout) — avoid leaking across accounts.
  useEffect(() => {
    setValue(safeGetJSON<T>(storageKey, initialRef.current));
     
  }, [storageKey]);

  // Persist on change.
  useEffect(() => {
    safeSetJSON(storageKey, value);
  }, [storageKey, value]);

  const reset = useCallback(() => setValue(initialRef.current), []);

  return [value, setValue, reset] as const;
}