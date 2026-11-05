import { describe, expect, it } from "vitest";
import type { Series } from "./data/types";
import { seriesNumberInStage, seriesTitleLabel, weekdayDate } from "./series-labels";

const s = (id: string, stage: Series["stage"], dateTimeUtc: string, round: number | null = null) =>
  ({ id, stage, round, dateTimeUtc }) as Series;

describe("series labels", () => {
  const all = [
    s("sf-2", "semifinals", "2026-11-08T22:00:00Z"),
    s("sf-1", "semifinals", "2026-11-07T22:00:00Z"),
    s("f-1", "final", "2026-11-14T19:00:00Z"),
  ];

  it("numbers series in schedule order within their stage", () => {
    expect(seriesNumberInStage(all, all[0])).toBe(2);
    expect(seriesNumberInStage(all, all[1])).toBe(1);
  });

  it("names the round", () => {
    expect(seriesTitleLabel(all[2], 1)).toBe("Final");
    expect(seriesTitleLabel(all[0], 2)).toBe("Semifinal 2");
    expect(seriesTitleLabel({ stage: "swiss", round: 5 }, 3)).toBe("Swiss Round 5, match 3");
  });

  it("reads the day in UTC", () => {
    expect(weekdayDate("2026-11-14T19:00:00Z")).toBe("Sat 14 Nov");
  });
});
