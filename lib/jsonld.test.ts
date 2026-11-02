import { describe, expect, it } from "vitest";
import { jsonLdHtml } from "./jsonld";

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
