import { chromium } from "@playwright/test";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto("http://localhost:5173/");
await page.waitForLoadState("domcontentloaded");
await page.waitForTimeout(15000);
const res = await page.evaluate(() => {
  const litCard = [...document.querySelectorAll("article")].find((a) =>
    a.querySelector("header")?.innerText.includes("Lit"),
  );
  const jqCard = [...document.querySelectorAll("article")].find((a) =>
    a.querySelector("header")?.innerText.includes("jQuery"),
  );
  const litHost = litCard?.querySelector("mf-lit-widget");
  const walk = (root, out = []) => {
    for (const el of root.querySelectorAll("*")) {
      if (el.tagName === "BUTTON") out.push(el.textContent.trim());
      if (el.shadowRoot) walk(el.shadowRoot, out);
    }
    return out;
  };
  return {
    litMounted: !!litHost?.shadowRoot,
    litSharedBtn: litHost?.shadowRoot
      ? [...litHost.shadowRoot.querySelectorAll("button")].some((b) => b.textContent.trim() === "Shared +1")
      : false,
    jqContainerChildren: jqCard?.querySelector("[data-card-container='jquery']")?.childElementCount ?? "n/a",
    recoveryFired: sessionStorage.getItem("mf-recovery"),
  };
});
console.log(JSON.stringify(res, null, 1));
await browser.close();
