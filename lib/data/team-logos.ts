import { readdirSync } from "node:fs";
import path from "node:path";

/**
 * Team logo files in public/teams/, taken from lolesports.com (see README: they belong to the teams and are not
 * covered by the MIT licence). `<id>.png` works on both themes; `<id>-dark.png` and `<id>-light.png` are made for the
 * dark and the light theme. The list is read at build time, so deleting a file removes that logo from the site.
 */
export interface TeamLogo {
  /** Image shown in the dark theme. */
  dark: string;
  /** Image shown in the light theme. */
  light: string;
  /** The only file was made for the other theme: show it on a contrasting plate in this one. */
  plate?: "light-theme" | "dark-theme";
}

let files: Set<string> | null = null;

function logoFiles(): Set<string> {
  if (!files) {
    try {
      files = new Set(readdirSync(path.join(process.cwd(), "public", "teams")));
    } catch {
      files = new Set();
    }
  }
  return files;
}

export function teamLogo(id: string): TeamLogo | null {
  const has = logoFiles();
  const url = (file: string) => (has.has(file) ? `/teams/${file}` : null);
  const both = url(`${id}.png`);
  if (both) return { dark: both, light: both };
  const dark = url(`${id}-dark.png`);
  const light = url(`${id}-light.png`);
  if (dark && light) return { dark, light };
  if (dark) return { dark, light: dark, plate: "light-theme" };
  if (light) return { dark: light, light, plate: "dark-theme" };
  return null;
}
