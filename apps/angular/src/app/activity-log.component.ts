import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
} from "@angular/core";
import { DomSanitizer, SafeHtml } from "@angular/platform-browser";
import { ACTIVITY_EVENT, ActivityDetail } from "@mf-all/widget-contract";
import { FRAMEWORKS, logoSvg } from "@mf-all/ui";

const metaOf = (id: string) =>
  (FRAMEWORKS as unknown as Record<string, { label: string }>)[id];

const MAX_ENTRIES = 30;

@Component({
  selector: "mf-activity-log",
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="rounded-card border border-border bg-surface p-5 shadow-card">
      <div class="mb-3 flex items-baseline justify-between">
        <h2 class="text-sm font-semibold">Activity log</h2>
        <p class="text-[11px] text-muted">CustomEvents dispatched by the widgets</p>
      </div>

      @if (entries().length === 0) {
        <p class="py-6 text-center text-xs text-muted">
          No activity yet — click around inside the widgets.
        </p>
      } @else {
        <ul class="max-h-56 space-y-1.5 overflow-y-auto pr-1">
          @for (entry of entries(); track entry.at) {
            <li class="flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs odd:bg-bg">
              <span class="inline-block" [innerHTML]="logoFor(entry.app)"></span>
              <span class="font-semibold">{{ labelOf(entry.app) }}</span>
              <span class="truncate text-muted">{{ entry.message }}</span>
              <span class="ml-auto shrink-0 font-mono text-[11px] text-muted">{{
                timeOf(entry.at)
              }}</span>
            </li>
          }
        </ul>
      }
    </section>
  `,
})
export class ActivityLogComponent {
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  readonly FRAMEWORKS = FRAMEWORKS;
  readonly entries = signal<ActivityDetail[]>([]);

  constructor() {
    const handler = (event: Event): void => {
      const detail = (event as CustomEvent<ActivityDetail>).detail;
      this.entries.update((prev) => [detail, ...prev].slice(0, MAX_ENTRIES));
    };
    window.addEventListener(ACTIVITY_EVENT, handler);
    this.destroyRef.onDestroy(() => window.removeEventListener(ACTIVITY_EVENT, handler));
  }

  timeOf(at: number): string {
    return new Date(at).toLocaleTimeString();
  }

  labelOf(id: string): string {
    return metaOf(id)?.label ?? id;
  }

  logoFor(id: string): SafeHtml {
    return this.sanitizer.bypassSecurityTrustHtml(logoSvg(id, 14));
  }
}
