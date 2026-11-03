/**
 * Shared pieces of the generated share images (Open Graph cards): the site's dark palette, its display font and team
 * logos inlined as data URLs, since the images are drawn at build time with no server to fetch from.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import type { TeamRef } from "@/lib/data/load";

/** The dark theme as the site renders it (sampled from the page, the tokens are OKLCH). */
export const OG = {
  background: "#030304",
  card: "#080b10",
  muted: "#191d24",
  border: "#172a4d",
  foreground: "#fafafa",
  mutedForeground: "#a1a1a1",
  brand: "#4c96ff",
  /** The bar of the side that does not lead: muted foreground at 45% on the card. */
  trailing: "#56585c",
} as const;

const root = process.cwd();
const read = (...parts: string[]) => readFileSync(path.join(root, ...parts));

let display: Buffer | null = null;

/** Barlow Condensed Bold (SIL OFL, see assets/fonts), the font of the site's headings. */
export function ogFonts() {
  display ??= read("assets", "fonts", "barlow-condensed", "BarlowCondensed-Bold.ttf");
  return [{ name: "Barlow Condensed", data: display, weight: 700 as const, style: "normal" as const }];
}

let wordmark: string | null = null;

/** The horizontal logo for dark backgrounds (its lettering is outlined, so it needs no font). */
export function ogWordmark(): string {
  wordmark ??= `data:image/svg+xml;base64,${read("assets", "rift-graphs-logo", "svg", "logo-horizontal-dark.svg").toString("base64")}`;
  return wordmark;
}

/** A team's logo for a dark background, and whether it needs a light plate (only a light theme file exists). */
export function ogLogo(team: TeamRef): { src: string; plate: boolean } | null {
  if (!team.logo) return null;
  return {
    src: `data:image/png;base64,${read("public", team.logo.dark).toString("base64")}`,
    plate: team.logo.plate === "dark-theme",
  };
}
