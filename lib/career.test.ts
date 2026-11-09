import { describe, expect, it } from "vitest";
import { buildCareer, honoursText, inHistory, isTitle, placeLabel, type CareerEntry, type CareerRow } from "./career";
import { careerFileSchema } from "./data/schema";

const row = (over: Partial<CareerRow> = {}): CareerRow => ({
  event: "LCK 2022 Spring Playoffs",
  date: "2022-04-02",
  place: "1",
  team: "T1",
  overviewPage: "LCK/2022 Season/Spring Playoffs",
  league: "LoL Champions Korea",
  split: "Spring",
  isOfficial: true,
  isPlayoffs: true,
  isQualifier: false,
  level: "Primary",
  ...over,
});

describe("isTitle", () => {
  it("counts international events by name, even without tournament data", () => {
    const blank = { league: null, split: null, isOfficial: null, isPlayoffs: null, isQualifier: null, level: null };
    expect(isTitle(row({ ...blank, event: "Worlds 2025" }))).toBe(true);
    expect(isTitle(row({ ...blank, event: "Worlds Season 3" }))).toBe(true);
    expect(isTitle(row({ ...blank, event: "MSI 2017" }))).toBe(true);
    expect(isTitle(row({ ...blank, event: "First Stand 2026" }))).toBe(true);
    expect(isTitle(row({ event: "Esports World Cup 2024", isOfficial: false }))).toBe(true);
  });

  it("counts league playoffs, cups and the single-stage seasons of 2013 and 2014", () => {
    expect(isTitle(row())).toBe(true);
    expect(isTitle(row({ event: "LCK Cup 2026", isPlayoffs: false }))).toBe(true);
    expect(isTitle(row({ event: "Champions 2013 Summer", isPlayoffs: false }))).toBe(true);
  });

  it("does not count a regular season, a road to MSI, a qualifying series or second place", () => {
    expect(isTitle(row({ event: "LCK 2023 Spring", isPlayoffs: false }))).toBe(false);
    expect(isTitle(row({ event: "LCK 2025 Road to MSI" }))).toBe(false);
    expect(isTitle(row({ event: "LCP 2026 Mid Season Qualifying Series" }))).toBe(false);
    expect(isTitle(row({ place: "2" }))).toBe(false);
  });
});

describe("inHistory", () => {
  it("leaves out unofficial events, qualifiers and the season opening", () => {
    expect(inHistory(row({ event: "KeSPA Cup 2025", isOfficial: false }))).toBe(false);
    expect(inHistory(row({ event: "LCK 2021 Regional Finals", isQualifier: true }))).toBe(false);
    expect(inHistory(row({ event: "LCK 2026 Season Opening" }))).toBe(false);
  });
});

describe("buildCareer", () => {
  it("drops a regular season when its playoffs are there, newest first", () => {
    const regular = row({ event: "LCK 2022 Spring", date: "2022-03-20", isPlayoffs: false });
    const older = row({ event: "LCK 2021 Spring Playoffs", date: "2021-04-10", split: "Spring" });
    expect(buildCareer([older, regular, row()]).map((e) => e.event)).toEqual([
      "LCK 2022 Spring Playoffs",
      "LCK 2021 Spring Playoffs",
    ]);
  });

  it("keeps a regular season without playoffs and the best place of repeated rows", () => {
    const regular = row({ event: "LCK 2023 Spring", isPlayoffs: false, place: "3", date: "2023-03-19" });
    const [entry] = buildCareer([regular, { ...regular, place: "1" }]);
    expect(entry.place).toBe("1");
    expect(entry.title).toBe(false);
  });
});

describe("placeLabel", () => {
  it("reads places, ranges and qualifying outcomes", () => {
    expect(placeLabel("1")).toBe("1st");
    expect(placeLabel("22")).toBe("22nd");
    expect(placeLabel("11-12")).toBe("11th-12th");
    expect(placeLabel("5-8")).toBe("5th-8th");
    expect(placeLabel("Q")).toBe("Qualified");
  });
});

describe("careerFileSchema", () => {
  const entry = { event: "Worlds 2025", date: "2025-11-09", place: "1", team: "T1", tier: "worlds", title: true };
  const file = (e: object) => ({ updatedAt: "2026-11-09T12:00:00.000Z", players: { faker: [e] }, teams: {} });

  it("accepts a valid file", () => {
    expect(careerFileSchema.safeParse(file(entry)).success).toBe(true);
  });

  it("rejects markup, a bad date and an unknown tier", () => {
    expect(careerFileSchema.safeParse(file({ ...entry, event: "<script>x</script>" })).success).toBe(false);
    expect(careerFileSchema.safeParse(file({ ...entry, date: "soon" })).success).toBe(false);
    expect(careerFileSchema.safeParse(file({ ...entry, tier: "fake" })).success).toBe(false);
  });
});

describe("honoursText", () => {
  const won = (tier: CareerEntry["tier"], n: number): CareerEntry[] =>
    Array.from({ length: n }, (_, i) => ({
      event: `${tier} ${i}`,
      date: "2025-01-01",
      place: "1",
      team: "T1",
      tier,
      title: true,
    }));

  it("lists the titles in order of weight", () => {
    expect(honoursText([...won("league", 10), ...won("msi", 2), ...won("worlds", 6)])).toBe(
      "6 World titles, 2 MSI and 10 league titles",
    );
  });

  it("uses the singular, and gives nothing without a title", () => {
    expect(honoursText(won("worlds", 1))).toBe("1 World title");
    expect(honoursText([{ ...won("worlds", 1)[0], title: false }])).toBeNull();
  });
});
