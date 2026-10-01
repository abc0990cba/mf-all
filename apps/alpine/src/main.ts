import Alpine from "alpinejs";
import "./app.css";
import { startShell } from "./app/shell";

// The host page shell runs on Alpine itself. The widget bundles their own
// Alpine copy and deliberately never touches window.Alpine, so the two
// copies cannot clobber each other's global registry.
window.Alpine = Alpine;
startShell(Alpine);
Alpine.start();
