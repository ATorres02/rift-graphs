/**
 * Screenshots of the key pages (mobile and desktop, dark by default) from a running
 * static server, for visual review. Usage: pnpm build && pnpm exec wrangler dev --port 8787
 * then `pnpm exec tsx scripts/screenshots.mts [outDir]` (BASE, ONLY=home,teams, LIGHT=1, FOLD=1).
 */
import { chromium } from "@playwright/test";
import { readFileSync } from "node:fs";

const base = process.env.BASE ?? "http://127.0.0.1:8787";
const outDir = process.argv[2] ?? "test-results/screenshots";
const players = JSON.parse(readFileSync("data/worlds-2026/players.json", "utf8")) as { id: string }[];
const pages: [string, string][] = [
  ["home", "/"],
  ["tournament", "/tournament"],
  ["matches", "/matches"],
  ["match", "/matches/play-in-round-1-1"],
  ["teams", "/teams"],
  ["team", "/teams/t1"],
  ["players", "/players"],
  ["player", `/players/${players.find((p) => p.id === "faker")?.id ?? players[0].id}`],
  ["champions", "/champions"],
  ["charts", "/charts?d=players&y=dpm&x=player&f=stage:swiss&t=bar&n=10"],
  ["compare", "/compare?type=teams&a=t1&b=gen-g"],
  ["about", "/about"],
];
const viewports = { mobile: { width: 390, height: 844 }, desktop: { width: 1280, height: 800 } };
const only = process.env.ONLY?.split(",");

const browser = await chromium.launch();
for (const [vpName, viewport] of Object.entries(viewports)) {
  const ctx = await browser.newContext({
    viewport,
    deviceScaleFactor: 1,
    colorScheme: process.env.LIGHT ? "light" : "dark",
  });
  const page = await ctx.newPage();
  for (const [name, path] of pages) {
    if (only && !only.includes(name)) continue;
    await page.goto(base + path, { waitUntil: "networkidle" });
    if (process.env.LIGHT) {
      await page.evaluate(() => document.documentElement.classList.remove("dark"));
    }
    await page.waitForTimeout(800);
    const fullPage = !process.env.FOLD;
    await page.screenshot({ path: `${outDir}/${name}-${vpName}${process.env.LIGHT ? "-light" : ""}.png`, fullPage });
    console.log("shot", name, vpName);
  }
  await ctx.close();
}
await browser.close();
