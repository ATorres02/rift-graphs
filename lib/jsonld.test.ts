import { describe, expect, it } from "vitest";
import { breadcrumbJsonLd, jsonLdHtml, seriesEventJsonLd, STAGE_VENUE } from "./jsonld";

describe("jsonLdHtml", () => {
  it("does not let a value close the script element", () => {
    const html = jsonLdHtml({ name: "</script><img src=x onerror=alert(1)>" });
    expect(html).not.toContain("</script>");
    expect(html).toContain("\\u003c/script");
  });

  it("keeps the JSON readable and round-trippable", () => {
    const value = { name: "Anyone's Legend", count: 3 };
    expect(JSON.parse(jsonLdHtml(value))).toEqual(value);
  });
});

describe("seriesEventJsonLd", () => {
  const event = seriesEventJsonLd({
    name: "Invictus Gaming vs Gen.G, Semifinals",
    description: "Preview",
    url: "https://riftgraphs.com/matches/main-event-semifinals-1",
    image: "https://riftgraphs.com/matches/main-event-semifinals-1/opengraph-image",
    startDate: "2026-11-07T22:00:00Z",
    stage: "semifinals",
    competitors: ["Invictus Gaming", "Gen.G"],
    streamUrl: "https://lolesports.com",
  });

  it("has the location Google requires: the venue and the stream", () => {
    expect(event.location[0]).toMatchObject({ "@type": "Place", name: "Credit Union of Texas Event Center" });
    expect(event.location[1]).toEqual({ "@type": "VirtualLocation", url: "https://lolesports.com" });
    expect(event.eventAttendanceMode).toBe("https://schema.org/MixedEventAttendanceMode");
    expect(event.competitor).toHaveLength(2);
  });

  it("leaves the teams out while they are not known, and every stage has a venue", () => {
    const tbd = seriesEventJsonLd({
      ...event,
      stage: "final",
      competitors: [],
      streamUrl: "https://lolesports.com",
    } as never);
    expect("competitor" in tbd).toBe(false);
    for (const stage of ["playin", "swiss", "quarterfinals", "semifinals", "final"] as const)
      expect(STAGE_VENUE[stage].name.length).toBeGreaterThan(0);
  });
});

describe("breadcrumbJsonLd", () => {
  it("numbers the trail and links all but the current page", () => {
    const list = breadcrumbJsonLd(
      [
        { label: "Matches", href: "/matches" },
        { label: "Quarterfinals", href: "/matches?stage=quarterfinals" },
        { label: "TES vs iG" },
      ],
      "https://riftgraphs.com",
    );
    expect(list.itemListElement.map((i) => i.position)).toEqual([1, 2, 3]);
    expect(list.itemListElement[1]).toMatchObject({ item: "https://riftgraphs.com/matches?stage=quarterfinals" });
    expect("item" in list.itemListElement[2]).toBe(false);
  });
});
