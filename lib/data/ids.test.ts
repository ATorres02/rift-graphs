import { describe, expect, it } from "vitest";
import { cleanText } from "./ids";

describe("cleanText", () => {
  it("decodes entities and strips markup", () => {
    expect(cleanText("&lt;img src=x onerror=alert(1)&gt;")).toBe("img src=x onerror=alert(1)");
  });
  it("strips double-encoded markup", () => {
    expect(cleanText("&amp;lt;script&amp;gt;")).toBe("script");
  });
  it("keeps apostrophes and non-ASCII names", () => {
    expect(cleanText("Anyone&#39;s Legend")).toBe("Anyone's Legend");
    expect(cleanText("LØS")).toBe("LØS");
  });
});
