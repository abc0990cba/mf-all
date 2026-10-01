import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { APPS } from "@mf-all/app-registry";
import { FRAMEWORKS, logoSvg } from "@mf-all/ui";
import { loadWidget } from "../lib/widgets";

type CardStatus = "loading" | "ready" | "error";

@Component({
  selector: "mf-widget-card",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <article
      class="flex min-h-[230px] flex-col overflow-hidden rounded-card border border-border bg-surface shadow-card"
    >
      <header class="flex items-center gap-2 border-b border-border px-4 py-2.5">
        <span class="inline-block" [innerHTML]="logo"></span>
        <span class="text-sm font-semibold">{{ meta.label }}</span>
        <span
          class="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
          [style.background-color]="meta.color + '1a'"
          [style.color]="meta.color"
          >{{ cfg.mfName }}</span
        >
        <span class="ml-auto flex items-center gap-2">
          <span class="font-mono text-[11px] text-muted">:{{ cfg.port }}</span>
          <span
            class="h-1.5 w-1.5 rounded-full"
            [class]="statusDotClass()"
          ></span>
        </span>
      </header>

      <div class="relative flex-1 p-4">
        @if (status() === 'loading') {
          <div class="animate-pulse space-y-3">
            <div class="h-8 w-28 rounded-lg bg-border/70"></div>
            <div class="h-4 w-44 rounded bg-border/50"></div>
            <div class="h-8 w-32 rounded-lg bg-border/70"></div>
            <div class="h-4 w-40 rounded bg-border/50"></div>
          </div>
        } @else if (status() === 'error') {
          <div class="flex h-full flex-col items-center justify-center gap-2 py-6 text-center">
            <p class="text-xs font-medium text-err">
              Couldn't load <span class="font-mono">{{ cfg.mfName }}/widget</span>
            </p>
            <p class="text-[11px] text-muted">
              Is the remote dev server on :{{ cfg.port }} running?
            </p>
            @if (errorMessage(); as msg) {
              <p
                class="mt-1 max-h-16 max-w-full overflow-hidden rounded bg-bg px-2 py-1 font-mono text-[10px] text-muted"
              >
                {{ msg }}
              </p>
            }
            <button
              class="mt-1 inline-flex h-7 items-center rounded-lg border border-border px-3 text-xs font-medium transition-colors hover:bg-accent-soft"
              (click)="mountWidget()"
            >
              Retry
            </button>
          </div>
        }

        <div #container class="min-h-[120px]"></div>
      </div>
    </article>
  `,
})
export class WidgetCardComponent implements AfterViewInit {
  readonly app = input.required<string>();

  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);
  private readonly containerRef =
    viewChild.required<ElementRef<HTMLDivElement>>("container");

  readonly status = signal<CardStatus>("loading");

  private unmount: (() => void) | null = null;
  private loadId = 0;
  private autoRetried = false;

  readonly errorMessage = signal("");

  constructor() {
    this.destroyRef.onDestroy(() => {
      this.loadId += 1;
      this.unmount?.();
      this.unmount = null;
    });
  }

  ngAfterViewInit(): void {
    void this.mountWidget();
  }

  get cfg() {
    return APPS[this.app()];
  }

  get meta() {
    return FRAMEWORKS[this.app()];
  }

  get logo(): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(logoSvg(this.app(), 18));
  }

  readonly statusDotClass = signal("animate-pulse bg-amber-400");

  async mountWidget(): Promise<void> {
    this.loadId += 1;
    const currentLoad = this.loadId;

    // Tear down any previous instance, then retry from a clean container.
    this.unmount?.();
    this.unmount = null;
    this.containerRef().nativeElement.innerHTML = "";
    this.status.set("loading");
    this.statusDotClass.set("animate-pulse bg-amber-400");
    this.errorMessage.set("");

    const cfg = APPS[this.app()];
    try {
      const widget = await loadWidget(this.app());
      if (currentLoad !== this.loadId) return;

      const result = widget.mount(this.containerRef().nativeElement);
      if (result instanceof Promise) {
        const dispose = await result;
        if (currentLoad !== this.loadId) {
          dispose();
          return;
        }
        this.unmount = dispose;
      } else {
        this.unmount = result;
      }
      this.status.set("ready");
      this.statusDotClass.set("bg-ok");
    } catch (error) {
      if (currentLoad !== this.loadId) return;
      console.error(`[mf] failed to load ${cfg.mfName}/widget`, error);
      this.errorMessage.set(error instanceof Error ? error.message : String(error));
      this.status.set("error");
      this.statusDotClass.set("bg-err");
      // Self-heal transient cold-start failures with one automatic retry.
      if (!this.autoRetried) {
        this.autoRetried = true;
        setTimeout(() => {
          if (currentLoad === this.loadId && this.status() === "error") {
            void this.mountWidget();
          }
        }, 2500);
      }
    } finally {
      // Watchdog: a hung remote load (promise never settles) gets the same
      // single automatic remount.
      setTimeout(() => {
        if (currentLoad === this.loadId && this.status() === "loading") {
          try {
            const key = "mf-recovery";
            const lastRecovery = Number(sessionStorage.getItem(key) ?? "0");
            if (Date.now() - lastRecovery > 15000) {
              sessionStorage.setItem(key, String(Date.now()));
              location.reload();
              return;
            }
          } catch {
            // storage unavailable — fall through to the remount
          }
          void this.mountWidget();
        }
      }, 12000);
    }
  }
}
