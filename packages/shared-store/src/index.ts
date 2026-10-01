/**
 * Cross-framework shared state — the modern take on the official
 * `shared-store-cross-framework` example.
 *
 * Every app bundles this module and its nanostores copy, but the ATOMS
 * themselves are memoized on the platform global — so exactly one instance
 * of each exists per page, regardless of how many federation share-scope
 * negotiations happened or misfired. Clicking "Shared +1" in the React
 * widget instantly updates the Angular, Svelte, Solid, ... widgets.
 *
 * (Dependency sharing is still exercised by the framework singletons —
 * vue, react, react-dom, solid-js, @angular/core — where it is designed
 * to work: same-framework host ↔ widget pairs.)
 */
import { atom, type Atom } from "nanostores";

interface StoreGlobals {
  __mfSharedCounter?: Atom<number>;
  __mfLastInteraction?: Atom<{ app: string; at: number } | null>;
}

const g = globalThis as typeof globalThis & StoreGlobals;

/** Click counter shared across every framework on the page. */
export const sharedCounter: Atom<number> = (g.__mfSharedCounter ??= atom(0));

/** Which app interacted last — rendered with its logo by every widget. */
export const lastInteraction: Atom<{ app: string; at: number } | null> = (g.__mfLastInteraction ??=
  atom(null));

export function incrementShared(app: string, by = 1): void {
  sharedCounter.set(sharedCounter.get() + by);
  lastInteraction.set({ app, at: Date.now() });
}
