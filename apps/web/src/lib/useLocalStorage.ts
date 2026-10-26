import { useEffect, useState } from "react";

// State mirrored into a Web Storage area under `key`, read once on mount.
function useStoredState<T>(storage: () => Storage, key: string, fallbackValue: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = storage().getItem(key);
    if (!raw) {
      return fallbackValue;
    }

    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallbackValue;
    }
  });

  useEffect(() => {
    storage().setItem(key, JSON.stringify(value));
  }, [storage, key, value]);

  return [value, setValue] as const;
}

const local = () => window.localStorage;
const session = () => window.sessionStorage;

/** Kept across visits (the search history). */
export function useLocalStorage<T>(key: string, fallbackValue: T) {
  return useStoredState(local, key, fallbackValue);
}

/** Kept for this browser tab only: every new visit starts from the fallback. */
export function useSessionStorage<T>(key: string, fallbackValue: T) {
  return useStoredState(session, key, fallbackValue);
}
