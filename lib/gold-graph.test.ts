import { describe, expect, it } from "vitest";
import type { GameTimeline, TimelineTeam } from "./sources/livestats";
import { clock, goldGraph, goldLabel } from "./gold-graph";

const team = (gold: number[], o: Partial<TimelineTeam> = {}): TimelineTeam => ({
  gold,
  kills: gold.map(() => 0),
  towers: gold.map(() => 0),
  inhibitors: gold.map(() => 0),
  barons: gold.map(() => 0),
  dragons: gold.map(() => 0),
  dragonTypes: [],
  ...o,
});

const timeline = (blue: TimelineTeam, red: TimelineTeam, end = 95): GameTimeline => ({
  esportsGameId: "1",
  step: 30,
  t: [0, 30, 60, end],
  end,
  pausedSeconds: 0,
  blue,
  red,
});

describe("goldGraph", () => {
  it("draws blue minus red every step, the last point at the end of the game", () => {
    const g = goldGraph(timeline(team([2500, 3100, 4000, 6000]), team([2500, 3000, 4600, 5000])));
    expect(g.points).toEqual([
      { t: 0, diff: 0 },
      { t: 30, diff: 100 },
      { t: 60, diff: -600 },
      { t: 95, diff: 1000 },
    ]);
    expect(g.lead).toEqual({ blue: { value: 1000, t: 95 }, red: { value: 600, t: 60 } });
    expect(g.scale).toBe(2000);
    expect(g.end).toBe(95);
  });

  it("marks each dragon and baron at the sample where its count goes up, by type", () => {
    const blue = team([0, 0, 0, 0], {
      dragons: [0, 1, 1, 2],
      dragonTypes: ["infernal", "elder"],
      barons: [0, 0, 1, 1],
    });
    const red = team([0, 0, 0, 0], { dragons: [0, 0, 1, 1], dragonTypes: ["ocean"] });
    const g = goldGraph(timeline(blue, red));
    expect(g.events).toEqual([
      { t: 30, side: "blue", kind: "dragon", label: "Infernal drake" },
      { t: 60, side: "blue", kind: "baron", label: "Baron Nashor" },
      { t: 60, side: "red", kind: "dragon", label: "Ocean drake" },
      { t: 95, side: "blue", kind: "dragon", label: "Elder dragon" },
    ]);
    expect(g.lead).toEqual({ blue: null, red: null });
  });
});

describe("labels", () => {
  it("reads the clock and short gold", () => {
    expect(clock(0)).toBe("0:00");
    expect(clock(1862)).toBe("31:02");
    expect(goldLabel(850)).toBe("+850");
    expect(goldLabel(-6230)).toBe("-6.2k");
    expect(goldLabel(12000)).toBe("+12k");
    expect(goldLabel(5000, false)).toBe("5k");
  });
});
