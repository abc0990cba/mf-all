import { render } from "preact";
import "./app.css";
import { App } from "./App";

const root = document.getElementById("app")!;
render(<App />, root);
