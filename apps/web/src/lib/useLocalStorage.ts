import { useEffect, useState } from "react";

export function useLocalStorage<T>(key: string, fallbackValue: T) {
  const [value, setValue] = useState<T>(() => {
    const raw = window.localStorage.getItem(key);
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
    window.localStorage.setItem(key, JSON.stringify(value));
  }, [key, value]);

  return [value, setValue] as const;
}
