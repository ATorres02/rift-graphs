import { describe, expect, it } from "vitest";
import { buildChart } from "./build";
import { TEMPLATES } from "./templates";
import { indexDataset } from "@/lib/data/index";
import { readDataset } from "@/lib/data/load";
import { runQuery } from "@/lib/query";

/** Integration check against the committed dataset: every template must draw something. */
describe("chart templates on the real dataset", () => {
  const data = indexDataset(readDataset());
  for (const t of TEMPLATES) {
    it(`"${t.name}" produces a chart`, () => {
      const result = runQuery(t.config, data);
      expect(result.problems).toEqual([]);
      // Knockout-stage templates legitimately have no games until 3 Nov; everything else must have rows.
      if (
        t.config.filters.stages?.every((s) => ["quarterfinals", "semifinals", "final"].includes(s)) &&
        result.universeGames === 0
      ) {
        expect(result.emptyReason).toMatch(/stage filter/);
        return;
      }
      expect(result.emptyReason).toBeNull();
      expect(result.rows.length).toBeGreaterThan(0);
      const built = buildChart(result);
      expect(built.title.length).toBeGreaterThan(0);
      expect(built.table.rows.length).toBeGreaterThan(0);
    });
  }
});
