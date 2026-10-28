/**
 * Generates the dot-matrix world map used on /teams from Natural Earth (public
 * domain, via the world-atlas package):
 *   public/world-dots.svg      every land dot, neutral colour (served as an image)
 *   lib/map/league-dots.json   dots of the countries of each league, inlined by the page for interaction
 * Run once (or when the country→league mapping changes): pnpm exec tsx scripts/build-world-dots.mts
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { geoContains, geoNaturalEarth1 } from "d3-geo";
import { feature } from "topojson-client";
import type { FeatureCollection, Geometry } from "geojson";
import type { Topology } from "topojson-specification";

const require = createRequire(import.meta.url);
const topo = JSON.parse(readFileSync(require.resolve("world-atlas/countries-110m.json"), "utf8")) as Topology;
const countries = feature(topo, topo.objects.countries as never) as unknown as FeatureCollection<
  Geometry,
  { name: string }
>;

const LEAGUES: Record<string, string[]> = {
  LCK: ["South Korea"],
  LPL: ["China"],
  LCS: ["United States of America", "Canada"],
  CBLOL: ["Brazil"],
  LEC: [
    "Spain",
    "Portugal",
    "France",
    "Germany",
    "United Kingdom",
    "Ireland",
    "Italy",
    "Netherlands",
    "Belgium",
    "Luxembourg",
    "Switzerland",
    "Austria",
    "Denmark",
    "Sweden",
    "Norway",
    "Finland",
    "Iceland",
    "Poland",
    "Czechia",
    "Slovakia",
    "Hungary",
    "Romania",
    "Bulgaria",
    "Greece",
    "Croatia",
    "Slovenia",
    "Bosnia and Herz.",
    "Serbia",
    "Montenegro",
    "Kosovo",
    "Macedonia",
    "Albania",
    "Estonia",
    "Latvia",
    "Lithuania",
    "Ukraine",
    "Moldova",
    "Macedonia",
    "Turkey",
    "Cyprus",
    "Saudi Arabia",
    "United Arab Emirates",
    "Qatar",
    "Kuwait",
    "Oman",
    "Egypt",
    "Morocco",
    "Algeria",
    "Tunisia",
    "Jordan",
  ],
  LCP: [
    "Japan",
    "Taiwan",
    "Vietnam",
    "Philippines",
    "Thailand",
    "Indonesia",
    "Malaysia",
    "Australia",
    "New Zealand",
    "Cambodia",
    "Laos",
    "Myanmar",
  ],
};
const leagueOfCountry = new Map<string, string>();
for (const [league, names] of Object.entries(LEAGUES)) for (const n of names) leagueOfCountry.set(n, league);
const known = new Set(countries.features.map((f) => f.properties.name));
for (const n of leagueOfCountry.keys()) if (!known.has(n)) console.warn(`country not in Natural Earth 110m: ${n}`);

const W = 1000;
const H = 520;
const projection = geoNaturalEarth1().fitExtent(
  [
    [8, 8],
    [W - 8, H - 8],
  ],
  { type: "Sphere" },
);
const STEP = 2.2; // degrees between dots
const land = countries.features.filter((f) => f.properties.name !== "Antarctica");

const all: [number, number][] = [];
const league: [number, number, string][] = [];
for (let lat = -56; lat <= 84; lat += STEP) {
  for (let lon = -180; lon < 180; lon += STEP) {
    const hit = land.find((f) => geoContains(f, [lon, lat]));
    if (!hit) continue;
    const p = projection([lon, lat]);
    if (!p) continue;
    const x = Math.round(p[0] * 10) / 10;
    const y = Math.round(p[1] * 10) / 10;
    all.push([x, y]);
    const l = leagueOfCountry.get(hit.properties.name);
    if (l) league.push([x, y, l]);
  }
}
const r = 2.1;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g fill="#6b7280" fill-opacity=".45">${all
  .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`)
  .join("")}</g></svg>`;
writeFileSync("public/world-dots.svg", svg);
writeFileSync("lib/map/league-dots.json", JSON.stringify({ width: W, height: H, radius: r, dots: league }));
console.log(`land dots: ${all.length} · league dots: ${league.length} · svg ${Math.round(svg.length / 1024)} KB`);
