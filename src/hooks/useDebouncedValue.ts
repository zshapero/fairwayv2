import { useEffect, useState } from "react";

/**
 * Returns a value that updates only after `delayMs` of stillness, useful for
 * debouncing search input before firing API calls.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}
