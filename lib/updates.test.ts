import { describe, expect, it } from "vitest";
import { latestUpdate, UPDATES, updatesByDay, type SiteUpdate } from "./updates";

describe("UPDATES", () => {
  it("is newest first, with valid days and unique anchors", () => {
    for (const u of UPDATES) expect(u.date, u.id).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    const dates = UPDATES.map((u) => u.date);
    expect(dates).toEqual([...dates].sort().reverse());
    const ids = UPDATES.map((u) => u.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^[a-z0-9-]+$/);
  });

  it("links only inside the site and never uses a middle dot", () => {
    for (const u of UPDATES) {
      if (u.link) expect(u.link.href, u.id).toMatch(/^\/(?!\/)/);
      expect(JSON.stringify(u), u.id).not.toContain("·");
    }
  });
});

describe("latestUpdate", () => {
  const list: SiteUpdate[] = [{ id: "a", date: "2026-11-05", kind: "new", title: "A", summary: "" }];

  it("shows the newest update through the seventh day after it", () => {
    expect(latestUpdate(new Date("2026-11-05T08:00:00Z"), 7, list)?.id).toBe("a");
    expect(latestUpdate(new Date("2026-11-12T23:59:00Z"), 7, list)?.id).toBe("a");
    expect(latestUpdate(new Date("2026-11-13T00:01:00Z"), 7, list)).toBeNull();
  });

  it("is null without updates", () => {
    expect(latestUpdate(new Date(), 7, [])).toBeNull();
  });
});

describe("updatesByDay", () => {
  it("groups consecutive entries of the same day", () => {
    const days = updatesByDay();
    expect(days[0].date).toBe(UPDATES[0].date);
    expect(days.flatMap((d) => d.updates)).toEqual(UPDATES);
    expect(new Set(days.map((d) => d.date)).size).toBe(days.length);
  });
});
