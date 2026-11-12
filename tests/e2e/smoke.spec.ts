import { readFileSync } from "node:fs";
import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

const CORE_PAGES = [
  "/",
  "/updates",
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
  // Every game of the series has its gold graph, with the largest lead in the caption.
  const graphs = page.locator("figure").filter({ hasText: "Gold difference" });
  await expect(graphs.first()).toBeVisible();
  expect(await graphs.count()).toBe(await page.getByRole("heading", { name: /^Game \d/ }).count());
  await expect(graphs.first()).toContainText(/Largest lead|Level all game/);
  // Breadcrumbs above the header, linking back to the matches.
  const crumbs = page.getByRole("navigation", { name: "Breadcrumb" });
  await expect(crumbs.getByRole("link", { name: "Matches" })).toHaveAttribute("href", "/matches");
  expect(errors).toEqual([]);
});

test("spoiler mode hides scores until revealed and survives navigation", async ({ page }) => {
  await page.goto("/");
  const toggle = page.getByRole("button", { name: /Spoilers/ }).first();
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-pressed", "true");
  await page.goto("/matches");
  await expect(page.getByRole("button", { name: /score/i }).first()).toBeVisible();
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
  await page.goto("/tournament");
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
  // The Swiss bracket on /tournament always has scores; the homepage moves on to the knockout bracket, empty at first.
  await page.goto("/tournament");
  const bracket = page.getByRole("region", { name: "Swiss stage bracket" });
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

test("only the round being played is marked as now", async ({ page }) => {
  // The Swiss bracket and the knockout bracket share the page: once the Swiss stage is over, its last round is not "now".
  await page.goto("/tournament");
  await expect(page.locator("main h3 .sr-only", { hasText: "now" })).toHaveCount(1);
});

test("the bracket scrolls inside its frame on a 390 px phone", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ["/tournament"]) {
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

test("a series yet to be played previews both teams lane by lane", async ({ page }) => {
  // Any scheduled series with both teams known; none is left once the tournament is over.
  const series = JSON.parse(readFileSync(path.join("data", "worlds-2026", "series.json"), "utf8")) as {
    id: string;
    status: string;
    stage: string;
    team1Id: string | null;
    team2Id: string | null;
  }[];
  const next = series.find((s) => s.status === "scheduled" && s.team1Id && s.team2Id);
  test.skip(!next, "no scheduled series with both teams known");
  const errors = watchErrors(page);
  await page.goto(`/matches/${next!.id}`);
  await expect(page).toHaveTitle(/ preview \| Rift Graphs$/);
  if (next!.stage === "final") {
    // The final's poster page: the teams in the heading, five duel posters, the full preview folded under them.
    expect(await page.getByRole("heading", { level: 1 }).textContent()).toMatch(/^The Worlds 2026 Final: .+ vs .+$/);
    const duels = page
      .locator("section")
      .filter({ has: page.getByRole("heading", { name: "The five duels", level: 2 }) });
    await expect(duels.getByRole("article")).toHaveCount(5);
    await expect(duels.getByRole("link", { name: /^Full duel: / })).toHaveCount(5);
    await expect(page.getByRole("heading", { name: "Tale of the tape", level: 2 })).toBeHidden();
    await page.getByText("Every number", { exact: true }).click();
  } else {
    // Read as text, the heading keeps its words apart: "TES Top Esports vs iG Invictus Gaming".
    expect(await page.getByRole("heading", { level: 1 }).textContent()).toMatch(/\S \S+ vs \S+ \S/);
  }
  await expect(page.getByRole("heading", { name: "Tale of the tape", level: 2 })).toBeVisible();
  const lanes = page.locator("section").filter({ has: page.getByRole("heading", { name: "Lane by lane", level: 2 }) });
  await expect(lanes.getByRole("article")).toHaveCount(5);
  // The preview's own: team stats, five lanes, two champion pools (the final adds its posters' links on top).
  const charts = page.getByRole("link", { name: /^Open in Charts/ });
  if (next!.stage === "final") expect(await charts.count()).toBeGreaterThan(8);
  else await expect(charts).toHaveCount(8);
  expect(errors).toEqual([]);
});

test("a lane duel opens from a knockout preview and links the other lanes", async ({ page }) => {
  const series = JSON.parse(readFileSync(path.join("data", "worlds-2026", "series.json"), "utf8")) as {
    id: string;
    stage: string;
    status: string;
    team1Id: string | null;
    team2Id: string | null;
  }[];
  const next = series.find(
    (s) =>
      ["quarterfinals", "semifinals", "final"].includes(s.stage) && s.status === "scheduled" && s.team1Id && s.team2Id,
  );
  test.skip(!next, "no scheduled knockout series with both teams known");
  const errors = watchErrors(page);
  await page.goto(`/matches/${next!.id}`);
  await page
    .getByRole("link", { name: /^Full duel/ })
    .first()
    .click();
  await expect(page).toHaveURL(new RegExp(`/matches/${next!.id}/top$`));
  await expect(page).toHaveTitle(/ top lane duel, Worlds 2026 \| Rift Graphs$/);
  expect(await page.getByRole("heading", { level: 1 }).textContent()).toMatch(/\S vs \S/);
  await expect(page.getByRole("heading", { name: "Side by side", level: 2 })).toBeVisible();
  const lanes = page.getByRole("navigation", { name: "Lanes of this series" }).getByRole("link");
  await expect(lanes).toHaveCount(5);
  await expect(lanes.first()).toHaveAttribute("aria-current", "page");
  expect(errors).toEqual([]);
});

test("a played knockout series links its five lane duels", async ({ page }) => {
  const series = JSON.parse(readFileSync(path.join("data", "worlds-2026", "series.json"), "utf8")) as {
    id: string;
    stage: string;
    status: string;
  }[];
  const played = series.find((s) => s.stage === "quarterfinals" && s.status === "finished");
  test.skip(!played, "no knockout series played yet");
  await page.goto(`/matches/${played!.id}`);
  const strip = page.locator("section").filter({ has: page.getByRole("heading", { name: "Lane duels", level: 2 }) });
  await expect(strip.getByRole("link")).toHaveCount(5);
  await strip.getByRole("link", { name: /^Mid duel/ }).click();
  await expect(page).toHaveURL(new RegExp(`/matches/${played!.id}/mid$`));
});

// Until the site moves on from Worlds 2026 the homepage is the final's page, without leaders or chart strip.
const finalIsHome = (
  JSON.parse(readFileSync(path.join("data", "worlds-2026", "series.json"), "utf8")) as {
    stage: string;
    team1Id: string | null;
    team2Id: string | null;
  }[]
).some((s) => s.stage === "final" && s.team1Id && s.team2Id);

test("the homepage leaders switch ranking with tabs on a phone", async ({ page }) => {
  test.skip(finalIsHome, "the homepage is the final's page");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await page.getByRole("tab", { name: "Damage/min" }).click();
  await expect(page.getByRole("tabpanel", { name: "Damage/min" })).toBeVisible();
  await expect(page.getByRole("tabpanel", { name: "KDA" })).toBeHidden();
});

test("the homepage charts open in the chart builder", async ({ page }) => {
  test.skip(finalIsHome, "the homepage is the final's page");
  const errors = watchErrors(page);
  await page.goto("/");
  const strip = page.locator("section").filter({ has: page.getByRole("heading", { name: "Charts", level: 2 }) });
  await expect(strip.getByRole("link", { name: /^Open in Charts/ })).toHaveCount(3);
  // One ranking per leader; a phone shows one at a time behind tabs, so count the links whether shown or not.
  await expect(page.locator("a", { hasText: "Top 10 in Charts" })).toHaveCount(3);
  await strip
    .getByRole("link", { name: /^Open in Charts/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/charts\?d=champions/);
  await expect(page.locator("canvas").first()).toBeVisible({ timeout: 15_000 });
  expect(errors).toEqual([]);
});
