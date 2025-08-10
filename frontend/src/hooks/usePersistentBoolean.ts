import { useState } from 'react';

export function usePersistentBoolean(
  key: string,
  initial: boolean,
): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(() => {
    const stored = localStorage.getItem(key);
    if (stored == null) return initial;
    return stored === '1' || stored === 'true';
  });

  const setPersistent = (next: boolean | ((prev: boolean) => boolean)) => {
    setValue((prev) => {
      const nextVal = typeof next === 'function' ? (next as (p: boolean) => boolean)(prev) : next;
      localStorage.setItem(key, nextVal ? '1' : '0');
      return nextVal;
    });
  };

  return [value, setPersistent];
}


