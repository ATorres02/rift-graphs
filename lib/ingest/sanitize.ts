/**
 * Last cleaning pass of the ingest, run just before the schemas validate the dataset.
 *
 * The schemas reject markup, control characters and non-https stream links, and a rejected dataset stops the whole
 * ingest. Most display text is cleaned where it is read (`cleanText()`), but not every field is, and the manual
 * files and lolesports feed in too. This pass makes the result fail soft: one bad wiki edit costs a character (or a
 * stream link), not the update. The schemas stay as the backstop.
 */

const UNSAFE = /[<>\u0000-\u001F\u007F]/;
const UNSAFE_ALL = new RegExp(UNSAFE.source, "g");

/** Text fields shown in the UI, capped like the schemas' display text. */
const DISPLAY_KEYS = new Set([
  "name",
  "short",
  "region",
  "location",
  "country",
  "residency",
  "realName",
  "nativeName",
  "mvp",
  "champion",
  "coaches",
  "picks",
  "bans",
  "picksByRole",
]);
const DISPLAY_MAX = 160;

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** Returns a cleaned deep copy; `warn` hears about every value it had to change. */
export function sanitizeDataset<T>(value: T, warn: (message: string) => void = () => {}): T {
  const walk = (v: unknown, path: string, key: string | null): unknown => {
    if (typeof v === "string") {
      if (key === "streamUrl") {
        if (isHttpsUrl(v)) return v;
        warn(`${path}: dropped a stream link that is not https`);
        return null;
      }
      let out = v;
      if (UNSAFE.test(out)) {
        out = out.replace(UNSAFE_ALL, "").trim();
        warn(`${path}: removed markup or control characters`);
      }
      if (key !== null && DISPLAY_KEYS.has(key) && out.length > DISPLAY_MAX) {
        out = out.slice(0, DISPLAY_MAX).trim();
        warn(`${path}: cut to ${DISPLAY_MAX} characters`);
      }
      return out;
    }
    // Array items inherit the key of their array (e.g. every pick in "picks").
    if (Array.isArray(v)) return v.map((item, i) => walk(item, `${path}[${i}]`, key));
    if (v && typeof v === "object")
      return Object.fromEntries(
        Object.entries(v as Record<string, unknown>).map(([k, item]) => [k, walk(item, path ? `${path}.${k}` : k, k)]),
      );
    return v;
  };
  return walk(value, "", null) as T;
}
