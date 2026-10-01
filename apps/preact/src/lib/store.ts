import { useEffect, useState } from "preact/hooks";
import type { Atom } from "nanostores";

/** Subscribe a nanostores atom into Preact state (cleanup-safe). */
export function useStore<T>(store: Atom<T>): T {
  const [value, setValue] = useState<T>(store.get());
  useEffect(() => store.subscribe((next) => setValue(next)), [store]);
  return value;
}
