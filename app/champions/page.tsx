import type { Metadata } from "next";
import { ChampionIcon } from "@/components/champion-icon";
import { ChampionGallery, type GalleryChampion } from "@/components/champions/gallery";
import { ChampionsTable, type ChampionRow } from "@/components/champions-table";
import { Chart } from "@/components/charts/chart";
import { Headlines, type Headline } from "@/components/headlines";
import { ProvisionalNote } from "@/components/provisional";
import { PageHeader, Section } from "@/components/page-header";
import { Spoiler } from "@/components/spoilers";
import type { BarSpec } from "@/lib/charts/spec";
import { championRef, getData } from "@/lib/data/load";
import { fmt, ROLE_LABEL } from "@/lib/format";
import { aggregateChampions, ROLES } from "@/lib/metrics";
import { normalizeChampionName } from "@/lib/sources/ddragon";
import { champIcon } from "@/lib/views";
import { chartHref, championPresenceChart } from "@/lib/charts/page-charts";

export const metadata: Metadata = {
  title: "Champions",
  description:
    "Every champion drafted at the 2026 World Championship as a gallery: presence, pick and ban rates and win rates by role, plus the champions nobody has touched.",
};

const MIN_PICKS_FOR_WINRATE = 3;

export default function ChampionsPage() {
  const data = getData();
  const champs = aggregateChampions(data.confirmedGames, data.playerGames);
  const games = data.confirmedGames.length;

  const used = new Set(champs.map((c) => normalizeChampionName(c.champion)));
  const unused = data.champions.champions.filter((c) => !used.has(normalizeChampionName(c.name)));

  const bestWinRate = champs
    .filter((c) => c.picks >= MIN_PICKS_FOR_WINRATE)
    .sort((a, b) => (b.winRate ?? 0) - (a.winRate ?? 0) || b.picks - a.picks)[0];
  const mostBanned = [...champs].sort((a, b) => b.bans - a.bans || b.picks - a.picks)[0];
  const mostPicked = [...champs].sort((a, b) => b.picks - a.picks || b.bans - a.bans)[0];
  const headlines: Headline[] = [
    champs[0]
      ? {
          label: "Highest presence",
          value: fmt.pct(champs[0].presence),
          detail: `${champs[0].champion}, ${champs[0].picks} picks, ${champs[0].bans} bans in ${games} games`,
        }
      : { label: "Highest presence", value: "–" },
    mostPicked
      ? {
          label: "Most picked",
          value: String(mostPicked.picks),
          detail: `${mostPicked.champion}, ${fmt.pct(mostPicked.picks / Math.max(games, 1))} of games`,
        }
      : { label: "Most picked", value: "–" },
    mostBanned
      ? {
          label: "Most banned",
          value: String(mostBanned.bans),
          detail: `${mostBanned.champion}, ${fmt.pct(mostBanned.banRate)} of games`,
        }
      : { label: "Most banned", value: "–" },
    bestWinRate
      ? {
          label: `Best win rate (${MIN_PICKS_FOR_WINRATE}+ picks)`,
          value: fmt.pct(bestWinRate.winRate),
          detail: `${bestWinRate.champion}, ${bestWinRate.wins}–${bestWinRate.picks - bestWinRate.wins}`,
          spoiler: true,
        }
      : { label: "Best win rate", value: "–" },
  ];

  const gallery: GalleryChampion[] = champs.map((c) => {
    const ref = championRef(data, c.champion);
    return {
      name: c.champion,
      ddragonId: ref?.id ?? null,
      title: ref?.title ?? null,
      presence: c.presence,
      picks: c.picks,
      bans: c.bans,
      wins: c.wins,
      winRate: c.winRate,
      byRole: c.byRole,
    };
  });

  const top = champs.slice(0, 20);
  const bar: BarSpec = {
    type: "bar",
    stacked: true,
    categories: top.map((c) => c.champion),
    series: [
      { name: "Picks", values: top.map((c) => c.picks) },
      { name: "Bans", values: top.map((c) => c.bans) },
    ],
  };

  const rows: ChampionRow[] = champs.map((c) => ({
    champion: champIcon(data, c.champion),
    presence: c.presence,
    picks: c.picks,
    bans: c.bans,
    wins: c.wins,
    winRate: c.winRate,
    roles: ROLES.filter((r) => c.byRole[r])
      .map((r) => `${ROLE_LABEL[r]} ${c.byRole[r]!.games}`)
      .join(", "),
    byRole: c.byRole,
  }));

  return (
    <div className="space-y-8">
      <PageHeader
        title="Champions"
        description={`${champs.length} champions picked or banned across ${games} games on patch ${data.tournament.patch ?? "?"}; ${unused.length} never appeared in a draft. Tap a card for the full story of a champion.`}
      />
      <Headlines items={headlines} className="lg:grid-cols-4" />
      <ProvisionalNote meta={data.meta} />

      <Section
        title="The draft, champion by champion"
        description="Sorted by presence. Pick a role to rank them by games in that role."
      >
        <ChampionGallery champions={gallery} games={games} />
      </Section>

      <Section
        title="Presence: picks + bans"
        description="Top 20 champions by presence. Presence is the share of games where a champion was picked or banned."
      >
        <Chart
          builderHref={chartHref(championPresenceChart())}
          spec={bar}
          table={{ columns: ["Champion", "Picks", "Bans"], rows: top.map((c) => [c.champion, c.picks, c.bans]) }}
          height={360}
          description={`Stacked bars of picks and bans for the 20 most present champions; ${top[0]?.champion ?? "none"} leads with ${top[0] ? fmt.pct(top[0].presence) : "–"} presence.`}
        />
      </Section>

      <Section
        title="Never picked or banned"
        description={`${unused.length} champions available on patch ${data.tournament.patch ?? "?"} that no team has drafted.`}
      >
        <ul className="flex flex-wrap gap-1.5">
          {unused.map((c) => (
            <li
              key={c.id}
              className="flex items-center gap-1.5 rounded-md border bg-card px-1.5 py-1 text-xs"
              title={c.name}
            >
              <ChampionIcon champion={{ name: c.name, ddragonId: c.id, version: data.champions.version }} size="xs" />
              <span className="hidden sm:inline">{c.name}</span>
            </li>
          ))}
        </ul>
      </Section>

      <details className="rounded-xl border bg-card p-4">
        <summary className="cursor-pointer text-sm font-medium">All champions as a table (sortable, by role)</summary>
        <div className="mt-3">
          <Spoiler as="div" label="Reveal table (win rates reveal results)">
            <ChampionsTable rows={rows} />
          </Spoiler>
        </div>
      </details>
    </div>
  );
}
