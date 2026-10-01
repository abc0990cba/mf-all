// Analog's dev transform emits decorator-preserving output that relies on
// the Angular JIT compiler at runtime (AOT still runs in production builds).
// The compiler package must therefore be imported before bootstrapping in dev.
import "@angular/compiler";
import { provideZonelessChangeDetection } from "@angular/core";
import { bootstrapApplication } from "@angular/platform-browser";
import "./app/app.css";
import { AppComponent } from "./app/app.component";

// Angular 22 is zoneless by default — we still pass the provider explicitly
// so behavior never depends on the host environment's configuration.
bootstrapApplication(AppComponent, {
  providers: [provideZonelessChangeDetection()],
}).catch((err) => {
  console.error(err);
  const el = document.createElement("pre");
  el.id = "mf-bootstrap-error";
  el.textContent = String(err?.message ?? err) + "\n" + String(err?.stack ?? "");
  document.body.appendChild(el);
});
