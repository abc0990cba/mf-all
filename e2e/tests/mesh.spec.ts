import { expect, test, type Page } from "@playwright/test";
import { APPS, APP_IDS } from "@mf-all/app-registry";

const HOSTS = APP_IDS.map((id) => ({ name: id, port: APPS[id].port }));
const WIDGET_COUNT = APP_IDS.length;

/**
 * Wait until all federated widgets are mounted on the page.
 *
 * Navigation-safe: the card watchdog may trigger the page's one-shot
 * recovery reload mid-poll (the known dev-mode first-load deadlock,
 * module-federation/vite#180/#733), which destroys the execution context —
 * a reload with warm caches then mounts everything.
 */
async function waitForAllWidgets(page: Page): Promise<void> {
  const loaded = async (): Promise<boolean> => {
    try {
      return (
        (await page.getByRole("button", { name: "Shared +1" }).count()) === WIDGET_COUNT
      );
    } catch {
      return false;
    }
  };
  if (!(await loaded())) {
    await page.reload();
    await page.waitForLoadState("domcontentloaded");
  }
  await expect
    .poll(loaded, { timeout: 45_000, intervals: [500, 1_000, 2_000] })
    .toBe(true);
}

for (const host of HOSTS) {
  test(`page "${host.name}" hosts all ${WIDGET_COUNT} framework widgets`, async ({ page }) => {
    await page.goto(`http://localhost:${host.port}/`);
    await page.waitForLoadState("domcontentloaded");
    await waitForAllWidgets(page);

    // No VISIBLE widget card shows an unrecoverable error (the jQuery shell
    // keeps a hidden error template in the DOM; other shells remove it)
    await expect(page.getByText("Couldn't load").filter({ visible: true })).toHaveCount(0);

    // The host badge identifies this page's host
    await expect(page.locator("header").first()).toContainText(
      new RegExp(host.name, "i"),
    );
  });
}

test("shared counter propagates across frameworks on one page", async ({ page }) => {
  await page.goto("http://localhost:5173/");
  await page.waitForLoadState("domcontentloaded");
  await waitForAllWidgets(page);

  const sharedButtonIn = async (cardPort: string) => {
    const card = page.locator("article").filter({ hasText: `:${cardPort}` });
    // The Lit widget renders inside its shadow root — pierce it.
    const host = card.locator("mf-lit-widget");
    if ((await host.count()) === 1) {
      return host.getByRole("button", { name: "Shared +1" });
    }
    return card.getByRole("button", { name: "Shared +1" });
  };

  // Click inside the React widget, then inside the Svelte widget
  await (await sharedButtonIn("5174")).click();
  await (await sharedButtonIn("5176")).click();

  // Host's strip shows both increments
  const strip = page.locator("section").filter({ hasText: "Shared counter" });
  await expect(strip.locator("span.font-mono.text-3xl")).toHaveText("2");

  // Every other widget's shared value reads 2 as well — sample Angular + Lit
  await expect(
    (await sharedButtonIn("5175")).locator("xpath=following-sibling::span"),
  ).toHaveText("2");
  await expect(
    (await sharedButtonIn("5179")).locator("xpath=following-sibling::span"),
  ).toHaveText("2");

  // The activity log recorded the cross-framework events. Log rows join
  // "React" + "incremented …" spans without spaces, hence \s*.
  const log = page.locator("section").filter({ hasText: "Activity log" });
  await expect(log).toContainText(/React\s*incremented the shared counter/);
  await expect(log).toContainText(/Svelte\s*incremented the shared counter/);
});
