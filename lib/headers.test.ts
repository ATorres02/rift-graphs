import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/** Every share card route, as a _headers path: app/matches/[id]/opengraph-image.tsx → /matches/:id/opengraph-image. */
function cardRoutes(dir = "app", base = ""): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.isDirectory()) {
      const seg = e.name.replace(/^\[(.+)\]$/, ":$1");
      return cardRoutes(path.join(dir, e.name), `${base}/${seg}`);
    }
    return /^opengraph-image\.tsx$/.test(e.name) ? [`${base}/opengraph-image`] : [];
  });
}

describe("public/_headers", () => {
  it("serves every share card as a PNG: they are exported without an extension", () => {
    const headers = readFileSync(path.join("public", "_headers"), "utf8");
    const routes = cardRoutes().filter((r) => r !== "/opengraph-image");
    expect(routes.length).toBeGreaterThan(0);
    for (const route of routes) {
      expect(headers, route).toMatch(
        new RegExp(`^${route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\n  Content-Type: image/png$`, "m"),
      );
    }
  });
});
