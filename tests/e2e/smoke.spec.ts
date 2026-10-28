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

/** Collects uncaught exceptions and console errors so a page that "loads" but is broken still fails. */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
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
    await expect(page, path).toHaveTitle(/Rift Ledger/);
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
  const toggle = page.getByRole("switch", { name: /Hide results/ }).first();
  await toggle.click();
  await expect(toggle).toBeChecked();
  await expect(page.getByRole("button", { name: /score/i }).first()).toBeVisible();
  await page.goto("/matches");
  await expect(page.getByRole("switch", { name: /Hide results/ }).first()).toBeChecked();
  await expect(page.locator("main").getByText("WIN")).toHaveCount(0);
  await page.getByRole("button", { name: /score/i }).first().click();
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
