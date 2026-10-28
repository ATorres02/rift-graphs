/**
 * Map-space layout of the Rift scene (100×100, blue base bottom-left, red base
 * top-right) shared by the three.js scene and the HTML overlay. Positions are
 * an approximation of the real map, drawn by us: nothing here is Riot's art.
 */
import type { Role } from "@/lib/data/types";

export type MarkerKind = Role | "dragon" | "baron";

export interface Marker {
  kind: MarkerKind;
  x: number;
  y: number;
  /** Height of the marker above the ground, world units. */
  height: number;
}

export const MARKERS: Marker[] = [
  { kind: "top", x: 14, y: 44, height: 8 },
  { kind: "jungle", x: 33, y: 60, height: 8 },
  { kind: "mid", x: 50, y: 50, height: 8 },
  { kind: "bot", x: 47, y: 86, height: 8 },
  { kind: "support", x: 64, y: 86, height: 8 },
  { kind: "dragon", x: 64, y: 70, height: 14 },
  { kind: "baron", x: 36, y: 30, height: 20 },
];

export const MARKER_LABEL: Record<MarkerKind, string> = {
  top: "Top",
  jungle: "Jungle",
  mid: "Mid",
  bot: "Bot",
  support: "Support",
  dragon: "Dragon",
  baron: "Baron Nashor",
};
