import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e.message).slice(0, 250)));
await page.goto("http://localhost:5173/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(8000);
const res = await page.evaluate(async () => {
  const inst = (globalThis.__FEDERATION__.__INSTANCES__ ?? []).find((i) => i.name === "vueApp");
  const timeout = (p, ms) => Promise.race([p, new Promise((r) => setTimeout(() => r("TIMEOUT"), ms))]);
  const out = {};
  try {
    const m = await timeout(inst.loadRemote("jqueryApp/widget"), 8000);
    out.load = m === "TIMEOUT" ? "TIMEOUT" : "OK keys=" + Object.keys(m).join(",");
    if (m !== "TIMEOUT") {
      const el = document.createElement("div");
      document.body.appendChild(el);
      const un = await timeout(m.mount(el), 8000);
      out.mount = un === "TIMEOUT" ? "MOUNT TIMEOUT" : "MOUNTED";
      out.children = el.childElementCount;
      out.text = el.innerText.slice(0, 60);
      if (un !== "TIMEOUT" && typeof un === "function") un();
      el.remove();
    }
  } catch (e) {
    out.err = String((e && (e.stack || e.message)) || e).slice(0, 300);
  }
  return out;
});
console.log(JSON.stringify({ res, errors }, null, 1));
await browser.close();
