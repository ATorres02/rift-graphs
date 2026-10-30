/** Links between pages that carry state in the query string; safe to import from client components. */

/** The comparison page with two teams preselected. */
export function compareTeamsHref(a: string, b: string): string {
  return `/compare?${new URLSearchParams({ type: "teams", a, b })}`;
}
