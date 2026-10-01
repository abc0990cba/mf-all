import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { APPS, APP_IDS, originFor } from "@mf-all/app-registry";

const appMeta = (id: string) =>
  (APPS as unknown as Record<string, { label: string; port: number; mfName: string }>)[id];
import { FRAMEWORKS, isDarkMode, logoSvg, themeIcons, toggleTheme } from "@mf-all/ui";
import { lastInteraction, sharedCounter } from "@mf-all/shared-store";
import { ActivityLogComponent } from "./activity-log.component";
import { WidgetCardComponent } from "./widget-card.component";

const SELF = "angular";
const self = APPS[SELF];

@Component({
  selector: "mf-app-root",
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [WidgetCardComponent, ActivityLogComponent],
  template: `
    <div class="min-h-screen">
      <header class="sticky top-0 z-10 border-b border-border bg-surface/85 backdrop-blur">
        <div class="mx-auto flex max-w-6xl items-center gap-2.5 px-6 py-3">
          <span class="shrink-0 [display:contents]" [innerHTML]="selfLogo"></span>
          <span class="text-sm font-semibold">{{ self.label }}</span>
          <span
            class="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-ink"
            >host</span
          >
          <span class="hidden font-mono text-[11px] text-muted sm:inline">:{{ self.port }}</span>
          <nav class="ml-auto flex items-center gap-1 overflow-x-auto">
            @for (id of appIds; track id) {
              <a
                [href]="pageUrl(id)"
                class="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors hover:bg-accent-soft hover:text-ink"
                [class.bg-accent-soft]="id === selfId"
                [class.text-accent]="id === selfId"
                [class.text-muted]="id !== selfId"
              >
                <span class="inline-block" [innerHTML]="logoFor(id)"></span>
                {{ APPS[id].label }}
              </a>
            }
          </nav>
          <button
            type="button"
            class="ml-1 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-muted transition-colors hover:bg-accent-soft hover:text-ink"
            (click)="onToggleTheme()"
          >
            <span class="inline-block" [innerHTML]="themeIcon"></span>
          </button>
        </div>
      </header>

      <main class="mx-auto max-w-6xl space-y-8 px-6 py-8">
        <section>
          <h1 class="text-2xl font-semibold tracking-tight">Module Federation Playground</h1>
          <p class="mt-1 text-sm text-muted">
            9 framework apps — every page hosts all 9 widgets as federated remotes. This page is
            hosted by <b class="font-medium text-ink">{{ self.label }}</b
            >, and {{ self.label }} itself is a remote everywhere else.
          </p>
        </section>

        <section
          class="flex flex-wrap items-center justify-between gap-4 rounded-card border border-border bg-surface px-5 py-4 shadow-card"
        >
          <div>
            <p class="text-sm font-semibold">Shared counter</p>
            <p class="text-xs text-muted">
              nanostores shared singleton — one instance across all frameworks
            </p>
          </div>
          <div class="flex items-center gap-5">
            @if (lastApp(); as lastId) {
              <div class="flex items-center gap-1.5 text-xs text-muted">
                last:
                <span class="inline-block" [innerHTML]="logoFor(lastId)"></span>
                <span class="font-medium text-ink">{{ FRAMEWORKS[lastId].label }}</span>
              </div>
            }
            <span class="font-mono text-3xl font-semibold tabular-nums">{{ shared() }}</span>
          </div>
        </section>

        <section class="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          @for (id of appIds; track id) {
            <mf-widget-card [app]="id" />
          }
        </section>

        <mf-activity-log />

        <footer class="pb-4 text-center text-[11px] text-muted">
          @module-federation/vite 1.23 · MF runtime 2.9 · 7 apps on ports 5173–5179 · every remote
          is also a host
        </footer>
      </main>
    </div>
  `,
})
export class AppComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly selfId = SELF;
  readonly self = self;
  readonly APPS = APPS;
  readonly FRAMEWORKS = FRAMEWORKS;
  readonly appIds = APP_IDS;

  readonly shared = signal(sharedCounter.get());
  readonly lastApp = signal<string | null>(lastInteraction.get()?.app ?? null);
  readonly dark = signal(isDarkMode());
  readonly themeIcon = signal(
    this.sanitizer.bypassSecurityTrustHtml(isDarkMode() ? themeIcons.sun : themeIcons.moon),
  );

  readonly selfLogo: SafeHtml;

  constructor() {
    const unsubCounter = sharedCounter.subscribe((value) => this.shared.set(value));
    const unsubLast = lastInteraction.subscribe((value) => this.lastApp.set(value?.app ?? null));
    inject(DestroyRef).onDestroy(() => {
      unsubCounter();
      unsubLast();
    });

    this.selfLogo = this.safeLogo(SELF);
  }

  pageUrl(id: string): string {
    return id === SELF ? "/" : originFor(id);
  }

  onToggleTheme(): void {
    const isDark = toggleTheme();
    this.dark.set(isDark);
    this.themeIcon.set(
      this.sanitizer.bypassSecurityTrustHtml(isDark ? themeIcons.sun : themeIcons.moon),
    );
  }

  logoFor(id: string): SafeHtml {
    return this.safeLogo(id);
  }

  private safeLogo(id: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(logoSvg(id, 14));
  }
}
