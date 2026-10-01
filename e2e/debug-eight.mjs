import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e.message).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 200)); });
await page.goto("http://localhost:5180/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(15000);
const res = await page.evaluate(async () => {
  const inst = (globalThis.__FEDERATION__.__INSTANCES__ ?? []).find((i) => i.name === "alpineApp");
  const timeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r("TIMEOUT"), ms))]);
  const out = {};
  for (const id of ["jqueryApp/widget", "vueApp/widget"]) {
    try {
      const m = await timeout(inst.loadRemote(id), 8000);
      if (m === "TIMEOUT") { out[id] = "LOAD TIMEOUT"; continue; }
      const el = document.createElement("div");
      document.body.appendChild(el);
      const un = await timeout(m.mount(el), 6000);
      out[id] = un === "TIMEOUT" ? "MOUNT TIMEOUT" : "MOUNTED children=" + el.childElementCount;
      if (typeof un === "function") un();
      el.remove();
    } catch (e) {
      out[id] = "ERR " + String((e && (e.message)) || e).slice(0, 150);
    }
  }
  return out;
});
console.log(JSON.stringify({ res, errors: errors.slice(0, 4) }, null, 1));
await browser.close();
