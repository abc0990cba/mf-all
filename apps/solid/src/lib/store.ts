import { createSignal, onCleanup, type Accessor } from "solid-js";
import type { Atom } from "nanostores";

/** Subscribe a nanostores atom into a Solid signal (cleanup-safe). */
export function useStore<T>(store: Atom<T>): Accessor<T> {
  const [get, set] = createSignal(store.get());
  const unsub = store.subscribe((value) => set(value));
  onCleanup(unsub);
  return get;
}
