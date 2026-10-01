import "@angular/compiler";
import { provideZonelessChangeDetection } from "@angular/core";
import { createApplication } from "@angular/platform-browser";
import { RootComponent } from "./root.component";

/**
 * The exposed `./widget` module (see vite.config.ts `exposes`).
 *
 * The `@angular/compiler` import above is required in DEV: Analog's dev
 * transform emits decorator-preserving output that relies on the Angular JIT
 * compiler, and this module must be self-sufficient when loaded into a
 * foreign host (the host never runs this app's main.ts). Production builds
 * emit AOT and tree-shake the compiler out.
 *
 * createApplication() creates a standalone Angular application instance
 * without bootstrapping any component; we then bootstrap the root component
 * onto the caller's DOM element. Teardown MUST be appRef.destroy() — it
 * destroys the environment injector and all bootstrapped views; killing
 * only the componentRef would leak injectors and listeners. One
 * ApplicationRef per widget instance.
 */
export const mount = async (el: HTMLElement): Promise<() => void> => {
  const appRef = await createApplication({
    providers: [provideZonelessChangeDetection()],
  });
  appRef.bootstrap(RootComponent, el);
  return () => appRef.destroy();
};
