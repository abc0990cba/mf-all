import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { incrementShared, lastInteraction, sharedCounter } from "@mf-all/shared-store";
import { emitActivity } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg } from "@mf-all/ui";

const metaOf = (id: string) =>
  (FRAMEWORKS as unknown as Record<string, { label: string }>)[id];

const SELF = "angular";
const meta = FRAMEWORKS[SELF];

/**
 * Widget root component. Angular component styles are compiled into the
 * component bundle (emulated encapsulation), so the widget's CSS travels
 * with its JS to any host page — no global stylesheet dependency.
 * Tokens (CSS custom properties on :root) style it consistently everywhere.
 */
@Component({
  selector: "mf-angular-widget-root",
  changeDetection: ChangeDetectionStrategy.OnPush,
  styles: `
    .wrap {
      display: flex;
      height: 100%;
      flex-direction: column;
      justify-content: space-between;
      gap: 1rem;
    }

    .label {
      display: block;
      margin-bottom: 6px;
      font-size: 11px;
      font-weight: 500;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--color-muted, #6f6f7a);
    }

    section + section {
      margin-top: 14px;
    }

    .row {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .value {
      font-family: var(--font-mono, ui-monospace, monospace);
      font-size: 14px;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
    }

    button {
      border: none;
      cursor: pointer;
      font: inherit;
    }

    .btn,
    .btn-accent {
      display: inline-flex;
      height: 32px;
      align-items: center;
      border-radius: 8px;
      padding: 0 12px;
      font-size: 12px;
      font-weight: 500;
      transition:
        background-color 0.15s,
        filter 0.15s;
    }

    .btn {
      border: 1px solid var(--color-border, #e6e6ea);
      background: var(--color-surface, #fff);
      color: var(--color-ink, #1a1a1f);
    }

    .btn:hover {
      background: var(--color-accent-soft, #eef0fe);
    }

    .btn-accent {
      background: var(--color-accent, #4f46e5);
      color: var(--color-accent-ink, #fff);
    }

    .btn-accent:hover {
      filter: brightness(1.08);
    }

    .foot {
      display: flex;
      align-items: center;
      justify-content: space-between;
      font-size: 11px;
      color: var(--color-muted, #6f6f7a);
    }

    .last {
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .logo {
      display: inline-block;
      width: 12px;
      height: 12px;
    }

    .name {
      color: var(--color-ink, #1a1a1f);
      font-weight: 500;
    }

    .log {
      background: none;
      padding: 0;
      color: var(--color-muted, #6f6f7a);
      text-decoration: underline;
      text-underline-offset: 2px;
    }

    .log:hover {
      color: var(--color-ink, #1a1a1f);
    }
  `,
  template: `
    <div class="wrap">
      <div>
        <section>
          <span class="label">Local · signal() · zoneless</span>
          <div class="row">
            <button class="btn" (click)="local.set(local() + 1)">Local +1</button>
            <span class="value">{{ local() }}</span>
          </div>
        </section>

        <section>
          <span class="label">Shared · platform-memoized atom</span>
          <div class="row">
            <button class="btn-accent" (click)="onShared()">Shared +1</button>
            <span class="value">{{ shared() }}</span>
          </div>
        </section>
      </div>

      <div class="foot">
        <span class="last">
          last:
          @if (lastApp(); as lastId) {
            <span class="logo" [innerHTML]="logoFor(lastId)"></span>
            <span class="name">{{ labelOf(lastId) }}</span>
          } @else {
            <span>—</span>
          }
        </span>
        <button class="log" (click)="onLog()">log event</button>
      </div>
    </div>
  `,
})
export class RootComponent {
  private readonly sanitizer = inject(DomSanitizer);

  readonly FRAMEWORKS = FRAMEWORKS;

  readonly local = signal(0);
  readonly shared = signal(sharedCounter.get());
  readonly lastApp = signal<string | null>(lastInteraction.get()?.app ?? null);

  constructor() {
    const unsubCounter = sharedCounter.subscribe((value) => this.shared.set(value));
    const unsubLast = lastInteraction.subscribe((value) => this.lastApp.set(value?.app ?? null));
    inject(DestroyRef).onDestroy(() => {
      unsubCounter();
      unsubLast();
    });
  }

  onShared(): void {
    incrementShared(SELF);
    emitActivity(SELF, "incremented the shared counter");
  }

  onLog(): void {
    emitActivity(SELF, `says hello from ${meta.label}`);
  }

  labelOf(id: string): string {
    return metaOf(id)?.label ?? id;
  }

  logoFor(id: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(logoSvg(id, 12));
  }
}
