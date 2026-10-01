import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push("PAGEERROR: " + String(e.message).slice(0, 200)));
page.on("console", (m) => { if (m.type() === "error") errors.push("CONSOLE: " + m.text().slice(0, 200)); });
await page.goto("http://localhost:5173/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(40000);
const res = await page.evaluate(() => {
  const walk = (root, out = []) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.tagName === "BUTTON") out.push(el.textContent.trim());
      if (el.shadowRoot) walk(el.shadowRoot, out);
    }
    return out;
  };
  return {
    shared: walk(document).filter((t) => t === "Shared +1").length,
    cards: [...document.querySelectorAll("article")].map((a) => ({
      name: a.querySelector("header")?.innerText.split("\n")[0],
      err: (a.innerText.split("running?")[1] || "").trim().slice(0, 130),
      pendingText: a.innerText.includes("Shared +1") ? "" : "(no widget dom)",
    })),
  };
});
console.log(JSON.stringify({ shared: res.shared, errors: errors.slice(0, 4), problems: res.cards.filter((c) => c.err || c.pendingText) }, null, 1));
await browser.close();
