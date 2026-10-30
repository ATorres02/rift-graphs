import { describe, expect, it } from "vitest";
import type { ChampionRef } from "./data/types";
import { heroArt, heroArtFiles } from "./hero-art";

const leeSin: ChampionRef = { id: "LeeSin", key: "64", name: "Lee Sin" };

describe("heroArt", () => {
  it("uses the site's own copies when both exist", () => {
    const art = heroArt(leeSin, () => true);
    expect(art).toEqual({ name: "Lee Sin", ...heroArtFiles("LeeSin") });
    expect(art.splash).toBe("/art/hero-LeeSin-splash.webp");
  });

  it("falls back to Data Dragon when a copy is missing", () => {
    const art = heroArt(leeSin, (file) => file.endsWith("-splash.webp"));
    expect(art.splash).toBe("https://ddragon.leagueoflegends.com/cdn/img/champion/splash/LeeSin_0.jpg");
    expect(art.portrait).toBe("https://ddragon.leagueoflegends.com/cdn/img/champion/loading/LeeSin_0.jpg");
  });
});
