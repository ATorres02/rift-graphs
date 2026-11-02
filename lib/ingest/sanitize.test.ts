import { describe, expect, it } from "vitest";
import { teamSchema } from "@/lib/data/schema";
import { sanitizeDataset } from "./sanitize";

describe("sanitizeDataset", () => {
  it("strips markup and control characters from every string, at any depth", () => {
    const warnings: string[] = [];
    const out = sanitizeDataset(
      { teams: [{ name: "T<b>1</b>", country: "Korea\u0007", coaches: ["A<i>"] }], picks: ["Ahri", "<Zed>"] },
      (w) => warnings.push(w),
    );
    expect(out).toEqual({ teams: [{ name: "Tb1/b", country: "Korea", coaches: ["Ai"] }], picks: ["Ahri", "Zed"] });
    expect(warnings).toHaveLength(4);
    expect(warnings[0]).toContain("teams[0].name");
  });

  it("keeps https stream links and drops any other", () => {
    const out = sanitizeDataset([
      { streamUrl: "https://www.twitch.tv/riotgames" },
      { streamUrl: "javascript:alert(1)" },
      { streamUrl: "http://example.com" },
      { streamUrl: null },
    ]);
    expect(out.map((s) => s.streamUrl)).toEqual(["https://www.twitch.tv/riotgames", null, null, null]);
  });

  it("caps display text at the schema's length and leaves clean data untouched", () => {
    const long = "x".repeat(200);
    const clean = { name: "Anyone's Legend", short: "AL", page: long };
    expect(sanitizeDataset(clean)).toEqual(clean);
    expect(sanitizeDataset({ name: long }).name).toHaveLength(160);
  });

  it("turns a team the schema would reject into one it accepts", () => {
    const team = {
      id: "t1",
      name: "T1",
      short: "T1<script>",
      page: "T1",
      region: "Korea",
      location: "Seoul\u0000",
      stages: ["main"],
      roster: [],
      coaches: [],
      seed: null,
    };
    expect(teamSchema.safeParse(team).success).toBe(false);
    expect(teamSchema.safeParse(sanitizeDataset(team)).success).toBe(true);
  });
});
