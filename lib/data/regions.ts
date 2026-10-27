/**
 * Region labels and colour tokens.
 *
 * Leaguepedia's `Teams.Region` reports a region name ("Korea", "China", …). The
 * league codes shown in the UI come from the SPEC's list (LCK, LPL, LEC, LCS,
 * LCP, CBLOL) and are a presentation mapping, not data from Cargo.
 */
export interface RegionInfo {
  /** Short code shown next to the team pill. */
  code: string;
  /** Region name as reported by Leaguepedia. */
  name: string;
  /** CSS custom property that holds the region colour. */
  cssVar: string;
}

const REGIONS: Record<string, RegionInfo> = {
  Korea: { code: "LCK", name: "Korea", cssVar: "--region-lck" },
  China: { code: "LPL", name: "China", cssVar: "--region-lpl" },
  EMEA: { code: "LEC", name: "EMEA", cssVar: "--region-lec" },
  "North America": { code: "LCS", name: "North America", cssVar: "--region-lcs" },
  "Asia Pacific": { code: "LCP", name: "Asia Pacific", cssVar: "--region-lcp" },
  Brazil: { code: "CBLOL", name: "Brazil", cssVar: "--region-cblol" },
};

export const REGION_ORDER = ["Korea", "China", "EMEA", "North America", "Asia Pacific", "Brazil"];

export function regionInfo(region: string): RegionInfo {
  return REGIONS[region] ?? { code: region, name: region, cssVar: "--region-other" };
}
