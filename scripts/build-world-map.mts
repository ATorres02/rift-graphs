/**
 * Generates the flat world map used on /teams from Natural Earth (public domain,
 * via the world-atlas package):
 *   public/world-base.svg            every country as a neutral shape (served as an image)
 *   lib/map/league-countries.json    the countries of each league as SVG paths, inlined by the page for hover and tap
 * Run once (or when the country→league mapping changes): pnpm exec tsx scripts/build-world-map.mts
 */
import { createRequire } from "node:module";
import { readFileSync, writeFileSync } from "node:fs";
import { geoNaturalEarth1, geoPath } from "d3-geo";
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
  // LCS: North and Central America (Riot, 2026). CBLOL: South America, Brazil and LATAM South.
  LCS: [
    "United States of America",
    "Canada",
    "Mexico",
    "Guatemala",
    "Belize",
    "Honduras",
    "El Salvador",
    "Nicaragua",
    "Costa Rica",
    "Panama",
    "Cuba",
    "Haiti",
    "Dominican Rep.",
    "Jamaica",
    "Puerto Rico",
    "Trinidad and Tobago",
    "Bahamas",
  ],
  CBLOL: [
    "Brazil",
    "Argentina",
    "Chile",
    "Peru",
    "Colombia",
    "Ecuador",
    "Bolivia",
    "Paraguay",
    "Uruguay",
    "Venezuela",
    "Guyana",
    "Suriname",
  ],
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
    "Lebanon",
    "Israel",
    "Iraq",
    "Libya",
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
    "Brunei",
    "Papua New Guinea",
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
    [6, 6],
    [W - 6, H - 6],
  ],
  { type: "Sphere" },
);
const path = geoPath(projection);
const round = (d: string) => d.replace(/(\d+\.\d{2})\d+/g, "$1");

const base: string[] = [];
const league: { code: string; name: string; d: string }[] = [];
for (const f of countries.features) {
  if (f.properties.name === "Antarctica") continue;
  const d = path(f);
  if (!d) continue;
  base.push(`<path d="${round(d)}"/>`);
  const code = leagueOfCountry.get(f.properties.name);
  if (code) league.push({ code, name: f.properties.name, d: round(d) });
}
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><g fill="#8b93a3" fill-opacity=".22" stroke="#8b93a3" stroke-opacity=".22" stroke-width=".7" stroke-linejoin="round">${base.join("")}</g></svg>`;
writeFileSync("public/world-base.svg", svg);
writeFileSync("lib/map/league-countries.json", JSON.stringify({ width: W, height: H, countries: league }));
console.log(
  `countries: ${base.length} · league countries: ${league.length} · base svg ${Math.round(svg.length / 1024)} KB · league json ${Math.round(JSON.stringify(league).length / 1024)} KB`,
);
