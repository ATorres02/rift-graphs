import type { Metadata } from "next";
import Link from "next/link";
import { ChampionIcon } from "@/components/champion-icon";
import { Headlines, type Headline } from "@/components/headlines";
import { PageHeader, Section } from "@/components/page-header";
import { Spoiler } from "@/components/spoilers";
import { TeamLogo } from "@/components/team-pill";
import { getData, getTimelines, teamRef, type TeamRef } from "@/lib/data/load";
import type { IndexedDataset } from "@/lib/data/index";
import { roundLabel, STAGE_SHORT } from "@/lib/format";
import { computeRecords, pentakills, type RecordEntry, type TournamentRecord } from "@/lib/records";
import { baseOpenGraph, defaultOgImage } from "@/lib/site";
import { cn } from "@/lib/utils";
import { champIcon } from "@/lib/views";

const DESCRIPTION =
  "The records of the 2026 League of Legends World Championship: the longest and shortest games, most kills, damage and CS in one game, pentakills, the biggest gold leads and comebacks, and the most picked and banned champions.";

export const metadata: Metadata = {
  title: "Worlds 2026 records: longest games, most kills and pentakills",
  description: DESCRIPTION,
  openGraph: { ...baseOpenGraph, title: "Worlds 2026 records", description: DESCRIPTION, images: [defaultOgImage] },
};

interface GameContext {
  href: string;
  label: string;
  short: string;
}

function gameContext(data: IndexedDataset, gameId: string | undefined): GameContext | null {
  const g = gameId ? data.gamesById.get(gameId) : undefined;
  const s = g ? data.seriesById.get(g.seriesId) : undefined;
  if (!g || !s) return null;
  return {
    href: `/matches/${s.id}#game-${g.gameNumber}`,
    label: `${roundLabel(s.stage, s.round, s.tab)} – Game ${g.gameNumber}`,
    short: `${s.stage === "swiss" && s.round ? `Swiss R${s.round}` : STAGE_SHORT[s.stage]} G${g.gameNumber}`,
  };
}

function Team({ team, logo = "size-5" }: { team: TeamRef | null; logo?: string }) {
  if (!team) return <span>TBD</span>;
  return (
    <Link href={`/teams/${team.id}`} className="inline-flex items-center gap-1.5 no-underline hover:text-brand">
      <TeamLogo team={team} className={logo} />
      <span>{team.short}</span>
    </Link>
  );
}

/** Who holds a record: a player with champion and team, two teams, a champion, or a player alone. */
function Holder({ data, e, big = false }: { data: IndexedDataset; e: RecordEntry; big?: boolean }) {
  const team = teamRef(e.teamId ? data.teamsById.get(e.teamId) : null);
  const opponent = teamRef(e.opponentTeamId ? data.teamsById.get(e.opponentTeamId) : null);
  const player = e.playerId ? data.playersById.get(e.playerId) : undefined;
  const logo = big ? "size-5 sm:size-6" : "size-4";
  if (e.playerId) {
    return (
      <span className={cn("inline-flex min-w-0 items-center gap-x-2 gap-y-1", big && "flex-wrap")}>
        {e.champion ? <ChampionIcon champion={champIcon(data, e.champion)} size={big ? "md" : "xs"} linked /> : null}
        <Link
          href={`/players/${e.playerId}`}
          className={cn("font-semibold no-underline hover:text-brand", big && "text-lg sm:text-xl")}
        >
          {player?.name ?? e.playerId}
        </Link>
        {big ? <Team team={team} logo={logo} /> : team ? <TeamLogo team={team} className={logo} /> : null}
      </span>
    );
  }
  if (e.champion) {
    return (
      <ChampionIcon
        champion={champIcon(data, e.champion)}
        size={big ? "md" : "xs"}
        showName
        linked
        className={cn("font-semibold", big && "[&>span:last-child]:text-lg sm:[&>span:last-child]:text-xl")}
      />
    );
  }
  return (
    <span className={cn("inline-flex items-center gap-x-2 font-semibold", big && "flex-wrap text-lg sm:text-xl")}>
      <Team team={team} logo={logo} />
      <span className="font-normal text-muted-foreground">vs</span>
      <Team team={opponent} logo={logo} />
    </span>
  );
}

function RecordCard({ data, record }: { data: IndexedDataset; record: TournamentRecord }) {
  const [first, ...rest] = record.entries;
  const ctx = gameContext(data, first.gameId);
  const body = (
    <div className="space-y-3">
      <div className="space-y-1.5">
        <p className="display flex items-baseline gap-2 font-bold">
          <span className="text-5xl tabular sm:text-6xl">{first.display}</span>
          {record.unit ? <span className="text-lg text-muted-foreground">{record.unit}</span> : null}
        </p>
        <Holder data={data} e={first} big />
        <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground sm:text-sm">
          {first.playerId && first.champion ? <span>{first.champion}</span> : null}
          {first.detail ? <span className="tabular">{first.detail}</span> : null}
          {ctx ? (
            <Link href={ctx.href} className="underline hover:text-foreground">
              {ctx.label}
            </Link>
          ) : null}
        </p>
      </div>
      {rest.length ? (
        <ol className="space-y-1.5 border-t pt-2.5 text-xs sm:text-sm">
          {rest.map((e, i) => {
            const c = gameContext(data, e.gameId);
            return (
              <li key={i} className="flex items-center gap-2.5">
                <span className="w-4 shrink-0 text-muted-foreground tabular">{e.rank}</span>
                <span className="w-14 shrink-0 font-semibold tabular">{e.display}</span>
                <span className="min-w-0 flex-1 truncate">
                  <Holder data={data} e={e} />
                </span>
                {c ? (
                  <Link href={c.href} className="shrink-0 text-muted-foreground underline hover:text-foreground">
                    {c.short}
                  </Link>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
    </div>
  );
  return (
    <article id={record.key} className="flex scroll-mt-24 flex-col gap-3 rounded-xl border bg-card p-4 sm:p-5">
      <h3 className="kicker text-xs text-brand sm:text-sm">{record.label}</h3>
      {record.spoiler ? (
        <Spoiler as="div" label="Reveal (contains a result)">
          {body}
        </Spoiler>
      ) : (
        body
      )}
      {record.note ? <p className="mt-auto pt-1 text-xs text-muted-foreground">{record.note}</p> : null}
    </article>
  );
}

export default function RecordsPage() {
  const data = getData();
  const groups = computeRecords(data, getTimelines());
  const pentas = pentakills(data);
  const byKey = new Map(groups.flatMap((g) => g.records.map((r) => [r.key, r] as const)));
  const games = data.confirmedGames.length;

  const tile = (key: string, label?: string): Headline | null => {
    const r = byKey.get(key);
    const e = r?.entries[0];
    if (!r || !e) return null;
    const player = e.playerId ? data.playersById.get(e.playerId)?.name : undefined;
    const who = player
      ? `${player}${e.champion ? `, ${e.champion}` : ""}`
      : e.champion
        ? e.champion
        : [e.teamId, e.opponentTeamId].map((id) => data.teamsById.get(id ?? "")?.short ?? "TBD").join(" vs ");
    return { label: label ?? r.label, value: e.display, detail: who, href: `#${r.key}` };
  };
  const headlines = [
    tile("longest-game"),
    tile("most-kills", "Most kills by a player"),
    tile("most-banned"),
    pentas.length
      ? {
          label: pentas.length === 1 ? "Pentakill" : "Pentakills",
          value: String(pentas.reduce((a, p) => a + p.count, 0)),
          detail: pentas
            .slice(0, 2)
            .map((p) => `${data.playersById.get(p.playerId)?.name ?? p.playerId}, ${p.champion}`)
            .join("; "),
          href: "#pentakills",
        }
      : null,
  ].filter((h): h is Headline => h !== null);

  return (
    <div className="space-y-10">
      <div>
        <PageHeader
          eyebrow="Worlds 2026"
          title="Records"
          description={`The standout numbers of the 2026 World Championship, from ${games} confirmed games. They update after every game; anything that gives away a result stays hidden in spoiler mode.`}
        />
        <Headlines items={headlines} className="lg:grid-cols-4" />
      </div>

      {groups.map((g) => (
        <Section key={g.key} id={g.key} title={g.title} description={g.description}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {g.records.map((r) => (
              <RecordCard key={r.key} data={data} record={r} />
            ))}
          </div>
        </Section>
      ))}

      <Section
        id="pentakills"
        title="Pentakills"
        description={pentas.length ? "Every pentakill of the tournament, in order." : "No pentakills yet."}
      >
        {pentas.length ? (
          <ul className="divide-y rounded-xl border bg-card">
            {pentas.map((p, i) => {
              const ctx = gameContext(data, p.gameId);
              return (
                <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-3">
                  <Holder
                    data={data}
                    e={{
                      rank: i + 1,
                      value: p.count,
                      display: String(p.count),
                      playerId: p.playerId,
                      teamId: p.teamId,
                      champion: p.champion,
                    }}
                    big
                  />
                  <span className="flex items-center gap-2 text-sm text-muted-foreground">
                    vs <Team team={teamRef(data.teamsById.get(p.opponentTeamId))} />
                    {p.count > 1 ? <span>({p.count})</span> : null}
                    {ctx ? (
                      <Link href={ctx.href} className="underline hover:text-foreground">
                        {ctx.label}
                      </Link>
                    ) : null}
                  </span>
                </li>
              );
            })}
          </ul>
        ) : null}
      </Section>
    </div>
  );
}
