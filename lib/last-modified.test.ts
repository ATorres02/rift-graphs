import { describe, expect, it } from "vitest";
import { indexDataset } from "./data/index";
import { readDataset } from "./data/load";
import { gameEnd, lastModifiedDates } from "./last-modified";

const data = indexDataset(readDataset());
const when = lastModifiedDates(data, new Date(0));

describe("lastModifiedDates", () => {
  it("dates a played series by its last game and keeps every date at or before the latest game", () => {
    const played = data.series.find((s) => s.status === "finished" && (data.gamesBySeries.get(s.id)?.length ?? 0) > 0)!;
    const games = data.gamesBySeries.get(played.id)!;
    expect(when.series(played).getTime()).toBe(Math.max(...games.map((g) => gameEnd(data, g)!)));
    for (const s of data.series) expect(when.series(s).getTime()).toBeLessThanOrEqual(when.overall.getTime());
  });

  it("gives teams of different fortunes different dates", () => {
    const dates = new Set(data.teams.map((t) => when.team(t.id).getTime()));
    expect(dates.size).toBeGreaterThan(1);
  });

  it("never dates a player or team page before the last change to all of them", () => {
    const floor = new Date("2099-01-01T00:00:00Z");
    const when = lastModifiedDates(data, floor);
    expect(when.team(data.teams[0].id)).toEqual(floor);
    expect(when.player(data.players[0].id)).toEqual(floor);
    expect(when.overall.getTime()).toBeLessThan(floor.getTime());
  });
});
