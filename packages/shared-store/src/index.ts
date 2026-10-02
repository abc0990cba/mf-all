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
 *
 * Beyond the counter, the same memoization carries the interactive-demo
 * state: the federated ball, the chat broadcast, the shared 5×5 board, the
 * page-wide mood and the per-app click attribution.
 */
import { atom, type Atom } from "nanostores";

export interface BallState {
  /** AppId of the widget currently holding the ball. */
  holder: string | null;
  /** How many times the ball has been passed between widgets. */
  passes: number;
}

export interface ChatMessage {
  app: string;
  text: string;
  at: number;
}

interface StoreGlobals {
  __mfSharedCounter?: Atom<number>;
  __mfLastInteraction?: Atom<{ app: string; at: number } | null>;
  __mfBall?: Atom<BallState>;
  __mfChat?: Atom<ChatMessage[]>;
  __mfGrid?: Atom<Record<string, boolean>>;
  __mfMood?: Atom<string>;
  __mfAttribution?: Atom<Record<string, number>>;
}

const g = globalThis as typeof globalThis & StoreGlobals;

/** Click counter shared across every framework on the page. */
export const sharedCounter: Atom<number> = (g.__mfSharedCounter ??= atom(0));

/** Which app interacted last — rendered with its logo by every widget. */
export const lastInteraction: Atom<{ app: string; at: number } | null> = (g.__mfLastInteraction ??=
  atom(null));

/** Per-app count of "Shared +1" clicks — the mini leaderboard. */
export const attribution: Atom<Record<string, number>> = (g.__mfAttribution ??= atom({}));

export function incrementShared(app: string, by = 1): void {
  sharedCounter.set(sharedCounter.get() + by);
  attribution.set({ ...attribution.get(), [app]: (attribution.get()[app] ?? 0) + by });
  lastInteraction.set({ app, at: Date.now() });
}

/**
 * The federated ball — a single entity that lives in exactly one widget at a
 * time. The ball starts at the first app in the registry so it exists on
 * every page from the first paint.
 */
export const ball: Atom<BallState> = (g.__mfBall ??= atom({ holder: "vue", passes: 0 }));

export function passBall(from: string, to: string): void {
  ball.set({ holder: to, passes: ball.get().passes + 1 });
  lastInteraction.set({ app: from, at: Date.now() });
}

/** Chat broadcast — the last few messages from any widget on the page. */
export const chat: Atom<ChatMessage[]> = (g.__mfChat ??= atom([]));

export function sendChat(app: string, text: string): void {
  const message: ChatMessage = { app, text, at: Date.now() };
  chat.set([...chat.get(), message].slice(-3));
  lastInteraction.set({ app, at: Date.now() });
}

/** Shared 5×5 pixel board, keyed "row-col" — every widget renders the same map. */
export const GRID_SIZE = 5;

export const grid: Atom<Record<string, boolean>> = (g.__mfGrid ??= atom({}));

export function toggleCell(r: number, c: number): void {
  const key = `${r}-${c}`;
  grid.set({ ...grid.get(), [key]: !grid.get()[key] });
}

/** Page-wide mood — one emoji, set from any widget. */
export const MOODS = ["🙂", "🎉", "🧠"] as const;

export const mood: Atom<string> = (g.__mfMood ??= atom("🙂"));

export function setMood(app: string, emoji: string): void {
  mood.set(emoji);
  lastInteraction.set({ app, at: Date.now() });
}
