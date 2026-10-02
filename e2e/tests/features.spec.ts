import { expect, test, type Locator, type Page } from "@playwright/test";
import { APPS, APP_IDS, type AppId } from "@mf-all/app-registry";

const HOSTS = APP_IDS.map((id) => ({ name: id, port: APPS[id].port }));
const WIDGET_COUNT = APP_IDS.length;
const HOME = "http://localhost:5173/";

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

/**
 * The widget root inside its host card, addressed by the card's unique
 * mfName badge (matched exactly, since mfNames substring-collide
 * case-insensitively — "preactApp" contains "reactApp" — and ports also
 * appear inside widgets' identity lines). The Lit widget renders inside
 * its shadow root — Playwright CSS pierces it, but scoping to
 * `mf-lit-widget` keeps the locator inside the widget.
 */
async function widgetIn(page: Page, id: AppId): Promise<Locator> {
  const card = page.locator("article").filter({
    has: page.locator("header .rounded-full", {
      hasText: new RegExp(`^${APPS[id].mfName}$`, "i"),
    }),
  });
  const lit = card.locator("mf-lit-widget");
  return (await lit.count()) === 1 ? lit : card;
}

async function openTab(page: Page, id: AppId, tab: string): Promise<void> {
  const widget = await widgetIn(page, id);
  await widget.locator(`[data-mf-tab='${tab}']`).click();
}

// ---------------------------------------------------------------- smoke ----

for (const host of HOSTS) {
  test(`features smoke on page "${host.name}": tabs, default view, load-time badges`, async ({
    page,
  }) => {
    await page.goto(`http://localhost:${host.port}/`);
    await page.waitForLoadState("domcontentloaded");
    await waitForAllWidgets(page);

    // 5 tabs per widget, 9 widgets
    await expect(page.locator("[data-mf-tab]")).toHaveCount(WIDGET_COUNT * 5);

    // Counters is the default view everywhere — the page loads looking
    // exactly like it did before the tabs existed
    await expect(page.getByRole("button", { name: "Local +1" })).toHaveCount(WIDGET_COUNT);
    await expect(page.locator("[data-mf-bars]")).toHaveCount(WIDGET_COUNT);

    // Every host card measured its widget's federation load time
    await expect(page.locator("[data-mf-loadtime]")).toHaveCount(WIDGET_COUNT);
    await expect(page.locator("[data-mf-loadtime]").first()).toContainText("ms");

    // No visible card errors
    await expect(page.getByText("Couldn't load").filter({ visible: true })).toHaveCount(0);
  });
}

// ---------------------------------------------------------- interactive ----

test("federated ball and chat propagate across frameworks", async ({ page }) => {
  await page.goto(HOME);
  await page.waitForLoadState("domcontentloaded");
  await waitForAllWidgets(page);

  // The ball starts at the first registry app (Vue, this page's host).
  await openTab(page, "vue", "ball");
  const vueWidget = await widgetIn(page, "vue");
  await expect(vueWidget.locator("[data-mf-ball]")).toHaveText("0");

  // Passing it teleports it into a random other widget and logs the hop.
  await vueWidget.locator("[data-mf-ball]").click();
  await expect(vueWidget.locator("[data-mf-ball-view]")).toContainText("ball at:");
  const log = page.locator("section").filter({ hasText: "Activity log" });
  await expect(log).toContainText(/passed the ball to/);

  // The receiver's pass counter grew. The passer's "ball at:" line names the
  // receiver — open that widget's Ball tab and read the counter there.
  const holderLabel = (await vueWidget.locator("[data-mf-ball-view]").innerText()) ?? "";
  const holderId = APP_IDS.find(
    (id) => id !== "vue" && holderLabel.includes(APPS[id].label),
  );
  expect(holderId, "ball at line names a known app").toBeTruthy();
  await openTab(page, holderId!, "ball");
  await expect((await widgetIn(page, holderId!)).locator("[data-mf-ball]")).toHaveText("1");

  // Chat: a message sent in the React widget appears in the Svelte widget.
  await openTab(page, "react", "chat");
  const reactWidget = await widgetIn(page, "react");
  await reactWidget.locator("[data-mf-chat-input]").fill("hello mesh");
  await reactWidget.locator("[data-mf-chat-send]").click();

  await openTab(page, "svelte", "chat");
  const svelteWidget = await widgetIn(page, "svelte");
  await expect(svelteWidget.locator("[data-mf-chat-log]")).toContainText("React");
  await expect(svelteWidget.locator("[data-mf-chat-log]")).toContainText("hello mesh");
});

test("board, ping, mood, attribution and identity sync across frameworks", async ({ page }) => {
  await page.goto(HOME);
  await page.waitForLoadState("domcontentloaded");
  await waitForAllWidgets(page);

  // Board: clicking a cell in Solid lights the same cell inside Lit's
  // shadow DOM — positional shared state, not just numbers.
  await openTab(page, "solid", "board");
  await (await widgetIn(page, "solid")).locator("[data-mf-grid-cell='1-2']").click();
  await openTab(page, "lit", "board");
  await expect(
    (await widgetIn(page, "lit")).locator("[data-mf-grid-cell='1-2']"),
  ).toHaveClass(/is-on/);

  // Attribution: two Shared +1 clicks in React show up on React's bar
  // everywhere — sampled in the Svelte widget.
  await openTab(page, "react", "counters");
  const reactWidget = await widgetIn(page, "react");
  const reactShared = reactWidget.getByRole("button", { name: "Shared +1" });
  await reactShared.click();
  await reactShared.click();
  await expect(reactWidget.locator("[data-mf-bar='react']")).toHaveAttribute(
    "data-count",
    "2",
  );
  await openTab(page, "svelte", "counters");
  await expect((await widgetIn(page, "svelte")).locator("[data-mf-bar='react']")).toHaveAttribute(
    "data-count",
    "2",
  );

  // Ping: fired from Alpine while Angular's widget is on another tab —
  // Angular's Pulse tab gets an unseen-activity dot, then the count.
  await openTab(page, "alpine", "pulse");
  await (await widgetIn(page, "alpine")).locator("[data-mf-ping]").click();
  const angularWidget = await widgetIn(page, "angular");
  await expect(angularWidget.locator("[data-mf-tab='pulse'] .mfw-dot")).toBeVisible();

  await openTab(page, "angular", "pulse");
  await expect(angularWidget.locator("[data-mf-ping-count]")).toHaveText(/^[1-9]\d*$/);
  await expect(angularWidget.locator("[data-mf-tab='pulse'] .mfw-dot")).toBeHidden();

  // Mood: set in Angular, read back inside Lit's shadow DOM.
  await angularWidget.locator("[data-mf-mood-set='🎉']").click();
  await expect(angularWidget.locator("[data-mf-mood]")).toHaveText("🎉");
  await openTab(page, "lit", "pulse");
  await expect((await widgetIn(page, "lit")).locator("[data-mf-mood]")).toHaveText("🎉");

  // Identity: the host's own widget runs "at home"; everyone else is a
  // federated guest on this page's port.
  await openTab(page, "vue", "pulse");
  await expect((await widgetIn(page, "vue")).locator("[data-mf-identity]")).toHaveText(
    "running at home",
  );
  await openTab(page, "react", "pulse");
  await expect((await widgetIn(page, "react")).locator("[data-mf-identity]")).toHaveText(
    "federated guest on :5173",
  );
});
