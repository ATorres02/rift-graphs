/** Helpers to turn Leaguepedia page names into stable, URL-safe ids. */

const CHAR_MAP: Record<string, string> = {
  Ø: "O",
  ø: "o",
  Đ: "D",
  đ: "d",
  ß: "ss",
  Æ: "AE",
  æ: "ae",
  Œ: "OE",
  œ: "oe",
  Ł: "L",
  ł: "l",
};

export function slugify(input: string): string {
  const mapped = Array.from(input, (c) => CHAR_MAP[c] ?? c).join("");
  return mapped
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** "Thanatos (Park Seung-kyu)" → "Thanatos". Leaguepedia disambiguates player pages with a real-name suffix. */
export function aliasFromPage(page: string): string {
  return page.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

const ENTITIES: Record<string, string> = {
  "&amp;": "&",
  "&nbsp;": " ",
  "&quot;": '"',
  "&#39;": "'",
  "&apos;": "'",
  "&lt;": "<",
  "&gt;": ">",
};

/** Decodes the handful of HTML entities Leaguepedia leaks into Cargo text fields (applied twice for double-escaped values). */
export function decodeEntities(input: string): string {
  const once = (s: string) =>
    s.replace(/&(amp|nbsp|quot|#39|apos|lt|gt);/g, (m) => ENTITIES[m] ?? m).replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)));
  return once(once(input)).replace(/\s+/g, " ").trim();
}

/** "2026 Season World Championship/Main Event_Round 1_1" → "main-event-round-1-1". Unique within a tournament. */
export function idFromCargoKey(key: string): string {
  const tail = key.includes("/") ? key.slice(key.lastIndexOf("/") + 1) : key;
  return slugify(tail);
}
