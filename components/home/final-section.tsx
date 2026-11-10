import Link from "next/link";
import { ChampionIcon } from "@/components/champion-icon";
import { Section } from "@/components/page-header";
import { RoleGlyph } from "@/components/rift/role-glyph";
import type { IndexedDataset, TeamRef } from "@/lib/data/load";
import type { Role, Series } from "@/lib/data/types";
import { duelHref, laneDuel, type DuelSide } from "@/lib/duels";
import { ROLE_LABEL } from "@/lib/format";
import { compareTeamsHref } from "@/lib/links";
import { ROLES } from "@/lib/metrics";
import { champIcon } from "@/lib/views";
import { POSTER_COLOUR, PosterButton } from "./poster-button";

function TeamCard({ team, right }: { team: TeamRef; right?: boolean }) {
  const colour = POSTER_COLOUR[team.id];
  return (
    <Link
      href={`/teams/${team.id}`}
      aria-label={`${team.name} team page`}
      className={`group relative flex items-center gap-4 overflow-hidden p-5 text-white no-underline sm:p-6 ${right ? "flex-row-reverse text-right" : ""}`}
      style={{ background: `linear-gradient(${right ? 250 : 110}deg, ${colour}, #000 85%)` }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, sized by CSS */}
      <img
        src={`/teams/large/${team.id}.png`}
        alt=""
        className="h-14 w-20 object-contain [filter:drop-shadow(0_0_2px_rgba(0,0,0,0.95))_drop-shadow(0_3px_16px_rgba(0,0,0,0.95))] sm:h-16 sm:w-24"
      />
      <span>
        <span className="display block text-4xl leading-none font-extrabold sm:text-5xl">{team.short}</span>
        <span className="kicker mt-1 block text-[11px] text-white/80 group-hover:text-white">Team page</span>
      </span>
    </Link>
  );
}

function DuelPlayer({ data, side, right }: { data: IndexedDataset; side: DuelSide | null; right?: boolean }) {
  const champion = side?.champions[0]?.champion;
  return (
    <span
      className={`flex min-w-0 items-center gap-2 ${right ? "flex-row-reverse text-right max-sm:order-3" : "max-sm:order-1"}`}
    >
      {champion ? <ChampionIcon champion={champIcon(data, champion)} size="sm" /> : null}
      {side ? (
        // Above the card's own link: the name opens the player's page, the rest of the card the duel.
        <Link
          href={`/players/${side.player.playerId}`}
          className="display relative z-10 truncate text-xl leading-none font-bold text-white no-underline hover:underline sm:text-2xl"
        >
          {side.player.name}
        </Link>
      ) : (
        <span className="display truncate text-xl leading-none font-bold sm:text-2xl">TBD</span>
      )}
    </span>
  );
}

function DuelCard({
  data,
  series,
  role,
  a,
  b,
}: {
  data: IndexedDataset;
  series: Series;
  role: Role;
  a: string;
  b: string;
}) {
  const duel = laneDuel(data, series, role);
  return (
    <div
      className="group relative block overflow-hidden text-white"
      style={{ background: `linear-gradient(115deg, ${a} 0 49.4%, #fff 49.4% 50.6%, ${b} 50.6%)` }}
    >
      <span className="relative flex h-full flex-col gap-2.5 bg-black/60 p-3.5 transition-colors group-hover:bg-black/45 max-sm:grid max-sm:grid-cols-[1fr_auto_1fr] max-sm:items-center max-sm:px-3 max-sm:py-2">
        <Link
          href={duelHref(series.id, role)}
          aria-label={`${ROLE_LABEL[role]} duel: ${duel?.a?.player.name ?? "TBD"} vs ${duel?.b?.player.name ?? "TBD"}`}
          className="absolute inset-0"
        />
        <span className="kicker flex items-center gap-1.5 text-[11px] text-white/85 max-sm:order-2">
          <RoleGlyph kind={role} className="size-4" />
          <span className="max-sm:sr-only">{ROLE_LABEL[role]}</span>
        </span>
        <DuelPlayer data={data} side={duel?.a ?? null} />
        <DuelPlayer data={data} side={duel?.b ?? null} right />
      </span>
    </div>
  );
}

/** Below the homepage poster: the way into both teams, the comparison and the five lane duels of the final. */
export function FinalSection({
  data,
  series: s,
  team1,
  team2,
}: {
  data: IndexedDataset;
  series: Series;
  team1: TeamRef;
  team2: TeamRef;
}) {
  return (
    <Section
      title="Inside the final"
      description={`Both finalists and the five duels that ${s.status === "finished" ? "decided" : "will decide"} it.`}
    >
      <div className="grid items-center gap-3 md:grid-cols-[1fr_auto_1fr]">
        <TeamCard team={team1} />
        <PosterButton href={compareTeamsHref(team1.id, team2.id)} className="border border-black/10">
          Compare teams
        </PosterButton>
        <TeamCard team={team2} right />
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {ROLES.map((role) => (
          <DuelCard
            key={role}
            data={data}
            series={s}
            role={role}
            a={POSTER_COLOUR[team1.id]}
            b={POSTER_COLOUR[team2.id]}
          />
        ))}
      </div>
    </Section>
  );
}
