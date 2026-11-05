/** How a series is named before its teams are known, for titles: "Final", "Semifinal 2", "Swiss Round 5, match 3". */
import type { Series } from "@/lib/data/types";

/** 1-based position of a series among those of its stage (and round), in schedule order. */
export function seriesNumberInStage(all: Series[], s: Series): number {
  const peers = all
    .filter((x) => x.stage === s.stage && x.round === s.round)
    .sort((a, b) => a.dateTimeUtc.localeCompare(b.dateTimeUtc) || a.id.localeCompare(b.id));
  return peers.findIndex((x) => x.id === s.id) + 1;
}

export function seriesTitleLabel(s: Pick<Series, "stage" | "round">, n: number): string {
  switch (s.stage) {
    case "final":
      return "Final";
    case "semifinals":
      return `Semifinal ${n}`;
    case "quarterfinals":
      return `Quarterfinal ${n}`;
    case "swiss":
      return `Swiss Round ${s.round ?? ""}, match ${n}`.replace("Round , ", "stage, ");
    case "playin":
      return `Play-In Round ${s.round ?? ""}, match ${n}`.replace("Round , ", "");
  }
}

const weekday = new Intl.DateTimeFormat("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

/** "Sat 14 Nov" from an ISO date (UTC, as the schedule is). */
export const weekdayDate = (iso: string) => weekday.format(new Date(iso));
