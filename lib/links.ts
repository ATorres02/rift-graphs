/** Links between pages that carry state in the query string; safe to import from client components. */

/** The comparison page with two teams preselected. */
export function compareTeamsHref(a: string, b: string): string {
  return `/compare?${new URLSearchParams({ type: "teams", a, b })}`;
}

/** The comparison page with two players preselected. */
export function comparePlayersHref(a: string, b: string): string {
  return `/compare?${new URLSearchParams({ type: "players", a, b })}`;
}

/**
 * Where a series' stage points in its breadcrumb. Knockout rounds go to the bracket on /tournament: search crawlers
 * are kept off `/matches?` (robots.txt), so a trail through it would end at a page they may not read.
 */
export function stageCrumbHref(stage: string): string {
  return stage === "quarterfinals" || stage === "semifinals" || stage === "final"
    ? "/tournament"
    : `/matches?stage=${stage}`;
}
