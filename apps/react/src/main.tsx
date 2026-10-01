import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./app.css";
import { App } from "./App";

// NOTE: no <StrictMode> here — double-invoked effects would mount/unmount
// federated widgets twice on every page load.
createRoot(document.getElementById("root")!).render(<App />);
