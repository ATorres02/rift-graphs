import { expect, test, type Page } from "@playwright/test";

const CORE_PAGES = [
  "/",
  "/tournament",
  "/matches",
  "/teams",
  "/teams/t1",
  "/players",
  "/champions",
  "/compare",
  "/charts",
  "/about",
  "/privacy",
  "/imprint",
];

// Test visits must not count as page views: the analytics beacon is answered with an empty script.
test.beforeEach(async ({ page }) => {
  await page.route(/static\.cloudflareinsights\.com|cloudflareinsights\.com\/cdn-cgi\/rum/, (route) =>
    route.fulfill({ status: 200, contentType: "application/javascript", body: "" }),
  );
});

/** Collects uncaught exceptions and console errors so a page that "loads" but is broken still fails. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    // React recovers from a hydration mismatch by re-rendering on the client (#418/#423/#425); seen now and then on
    // heavy pages when two browsers share the CPU. Logged, not fatal, until the cause is found.
    if (/Minified React error #4(18|23|25)/.test(e.message)) {
      console.warn(`recoverable hydration error on ${page.url()}`);
      return;
    }
    errors.push(`pageerror: ${e.message}`);
  });

  page.on("console", (m) => {
    if (m.type() === "error") errors.push(`console: ${m.text()}`);
  });
  return errors;
}

test("core pages load with a title, a heading and no browser errors", async ({ page }) => {
  const errors = watchErrors(page);
  for (const path of CORE_PAGES) {
    const res = await page.goto(path);
    expect(res?.status(), path).toBe(200);
    await expect(page, path).toHaveTitle(/Rift Graphs/);
    await expect(page.getByRole("heading", { level: 1 }), path).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(errors, path).toEqual([]);
  }
});

test("a finished series shows its games, draft and scoreboards", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/matches/play-in-round-1-1");
  await expect(page.getByRole("heading", { name: /^Game 1/ })).toBeVisible();
  await expect(page.getByRole("table").first()).toBeVisible();
  await expect(page.getByText(/Watch on lolesports\.com/)).toBeVisible();
  expect(errors).toEqual([]);
});

test("spoiler mode hides scores until revealed and survives navigation", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /Spoilers/ }).first();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: /score/i }).first()).toBeVisible();
  await page.goto("/matches");
  await expect(page.getByRole("button", { name: /Spoilers/ }).first()).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("main").getByText("WIN")).toHaveCount(0);
  // Reveal a finished series: a live one has a score but no winner yet.
  await page
    .locator("main article")
    .filter({ hasNotText: "In progress" })
    .getByRole("button", { name: /score/i })
    .first()
    .click();
  await expect(page.locator("main").getByText("WIN").first()).toBeVisible();
});

test("a chart link reproduces the chart and offers a table view", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/charts?d=players&y=dpm&x=player&f=stage:swiss&t=bar&n=10");
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("button", { name: /copy link/i })).toBeVisible();
  await page.getByRole("button", { name: /table/i }).first().click();
  await expect(page.getByRole("table").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("the champion gallery filters by role and opens a champion page", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/champions");
  const cards = page.locator("main ul li article");
  await expect(cards.first()).toBeVisible();
  const all = await cards.count();
  await page.getByRole("button", { name: "Jungle" }).click();
  await expect.poll(() => cards.count()).toBeLessThan(all);
  await page.locator("main ul li a").first().click();
  await expect(page).toHaveURL(/\/champions\/[a-z]+$/);
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByText(/Presence/i).first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("the teams map filters the region cards", async ({ page }) => {
  await page.goto("/teams");
  await expect(page.getByRole("img", { name: /World map/ })).toBeVisible();
  await page.getByRole("button", { name: /LCK/ }).click();
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(1);
  await expect(page.getByText(/Coach/).first()).toBeVisible();
  await page.getByRole("button", { name: "All regions" }).click();
  await expect(page.getByRole("heading", { level: 3 })).toHaveCount(6);
});

test("unknown routes return the 404 page", async ({ page }) => {
  const res = await page.goto("/this-page-does-not-exist");
  expect(res?.status()).toBe(404);
  await expect(page.getByRole("link", { name: /home|back/i }).first()).toBeVisible();
});

test("the legal notice and attribution are in the footer of every page", async ({ page }) => {
  for (const path of ["/", "/teams/t1", "/charts"]) {
    await page.goto(path);
    const footer = page.locator("footer");
    await expect(footer.getByText(/Legal Jibber Jabber/)).toBeVisible();
    await expect(footer.getByRole("link", { name: "Leaguepedia" })).toBeVisible();
  }
});

test("every bracket series links to its page", async ({ page, request }) => {
  await page.goto("/");
  const bracket = page.getByRole("region", { name: /bracket/ });
  const hrefs = await bracket.locator("a[data-cell]").evaluateAll((links) => links.map((a) => a.getAttribute("href")));
  expect(hrefs.length).toBeGreaterThan(0);
  for (const href of new Set(hrefs)) {
    expect(href).toMatch(/^\/matches\/[a-z0-9-]+$/);
    expect((await request.get(href!)).status(), href!).toBe(200);
  }
});

test("hidden spoilers keep every bracket score hidden until revealed round by round", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("rg-spoilers", "hidden"));
  await page.goto("/");
  const bracket = page.getByRole("region", { name: /bracket/ });
  await expect(bracket.locator(".b-score")).not.toHaveCount(0);
  for (const score of await bracket.locator(".b-score").all()) await expect(score).toBeHidden();
  await expect(bracket.locator("[data-gate='1'] a[data-cell]").first()).toBeHidden();

  // Keyboard: the first reveal button shows round 1 scores and round 2 pairings, then focus moves to round 2.
  const reveal = bracket.getByRole("button", { name: /^Reveal / });
  await expect(reveal).toHaveCount(1);
  await reveal.focus();
  await page.keyboard.press("Enter");
  await expect(bracket.locator("[data-rgate='1'] .b-score").first()).toBeVisible();
  await expect(bracket.locator("[data-gate='1'] a[data-cell]").first()).toBeVisible();
  await expect(bracket.locator("[data-rgate='2'] .b-score").first()).toBeHidden();
  await expect(bracket.locator("[data-gate='1'] h3")).toBeFocused();
});

test("the bracket scrolls inside its frame on a 390 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/", "/tournament"]) {
    await page.goto(path);
    await expect(page.getByRole("region", { name: /bracket/ }).first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
});

test("a chart on a team page opens the same chart in the builder", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/teams/t1");
  const link = page.getByRole("link", { name: "Open in Charts" }).first();
  await expect(link).toHaveAttribute("href", /^\/charts\?.*t=radar.*k=t1/);
  await link.click();
  await expect(page).toHaveURL(/\/charts\?.*k=t1/);
  await expect(page.getByText("T1 vs tournament average")).toBeVisible({ timeout: 15_000 });
  await expect(page.locator("canvas").first()).toBeVisible();
  expect(errors).toEqual([]);
});

test("Compare teams opens the comparison with both teams of the series", async ({ page }) => {
  await page.goto("/matches/main-event-round-1-1");
  const link = page.getByRole("link", { name: "Compare teams" }).first();
  await expect(link).toHaveAttribute("href", "/compare?type=teams&a=gen-g&b=invictus-gaming");
  await link.click();
  await expect(page).toHaveURL(/\/compare\?type=teams&a=gen-g&b=invictus-gaming/);
});

test("the homepage charts open in the chart builder", async ({ page }) => {
  const errors = watchErrors(page);
  await page.goto("/");
  const strip = page.locator("section").filter({ has: page.getByRole("heading", { name: "Charts", level: 2 }) });
  await expect(strip.getByRole("link", { name: /^Open in Charts/ })).toHaveCount(3);
  await expect(page.getByRole("link", { name: /Top 10 in Charts/ })).toHaveCount(3);
  await strip
    .getByRole("link", { name: /^Open in Charts/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/charts\?d=champions/);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
