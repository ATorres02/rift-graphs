import { describe, expect, it } from "vitest";
import { indexDataset } from "./data/index";
import { readDataset } from "./data/load";
import { CARD_METRICS, DUEL_STAGES, duelHref, duelSeries, gamesBefore, isRole, laneDuel } from "./duels";
import { ROLES } from "./metrics";

const data = indexDataset(readDataset());

describe("duelSeries", () => {
  it("keeps knockout series with both teams known", () => {
    const list = duelSeries(data);
    for (const s of list) {
      expect(DUEL_STAGES).toContain(s.stage);
      expect(s.team1Id && s.team2Id, s.id).toBeTruthy();
    }
  });
});

describe("gamesBefore", () => {
  it("leaves out the series itself and everything that started at the same time or later", () => {
    for (const s of duelSeries(data)) {
      for (const g of gamesBefore(data, s)) {
        expect(g.seriesId).not.toBe(s.id);
        expect(data.seriesById.get(g.seriesId)!.dateTimeUtc < s.dateTimeUtc, g.id).toBe(true);
      }
    }
  });
});

describe("laneDuel", () => {
  it("pairs a player of each team per lane, with the numbers and the meetings from before the series", () => {
    for (const s of duelSeries(data)) {
      const before = new Set(gamesBefore(data, s).map((g) => g.id));
      for (const role of ROLES) {
        const duel = laneDuel(data, s, role)!;
        expect(duel, `${s.id} ${role}`).not.toBeNull();
        expect(duel.a?.teamId).toBe(s.team1Id);
        expect(duel.b?.teamId).toBe(s.team2Id);
        expect(duel.metrics.some((m) => m.key === "cspm")).toBe(role !== "support");
        for (const key of CARD_METRICS(role)) expect(duel.metrics.map((m) => m.key)).toContain(key);
        for (const side of [duel.a, duel.b]) {
          const games = side?.champions.reduce((n, c) => n + c.games, 0) ?? 0;
          expect(games).toBe(side?.stats?.games ?? 0);
        }
        for (const m of duel.meetings) {
          expect(before.has(m.game.id)).toBe(true);
          expect(m.a.role).toBe(role);
          expect(m.b.role).toBe(role);
          expect(m.a.side).not.toBe(m.b.side);
          expect(m.a.playerId).toBe(duel.a!.player.playerId);
          expect(m.b.playerId).toBe(duel.b!.player.playerId);
        }
      }
    }
  });

  it("is null for a series without both teams", () => {
    const open = data.series.find((s) => !s.team1Id || !s.team2Id);
    if (open) expect(laneDuel(data, open, "mid")).toBeNull();
  });
});

describe("helpers", () => {
  it("knows the roles and builds the page path", () => {
    expect(isRole("support")).toBe(true);
    expect(isRole("adc")).toBe(false);
    expect(duelHref("main-event-semifinals-1", "top")).toBe("/matches/main-event-semifinals-1/top");
  });
});
