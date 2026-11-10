import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon, ArrowUpRightIcon, ExternalLinkIcon } from "lucide-react";
import { LocalTime } from "@/components/local-time";
import { Spoiler } from "@/components/spoilers";
import { FinalCountdown } from "@/components/home/final-countdown";
import { ChampionIcon } from "@/components/champion-icon";
import { POSTER_COLOUR, PosterButton, TeamLogoLarge } from "@/components/home/poster-button";
import { Section } from "@/components/page-header";
import { RoleGlyph } from "@/components/rift/role-glyph";
import { chartHref, championRecordChart, compareChart, TEAM_RADAR_MEASURES } from "@/lib/charts/page-charts";
import { championRef, type IndexedDataset, type TeamRef } from "@/lib/data/load";
import type { Role, Series } from "@/lib/data/types";
import { CARD_METRICS, DUEL_LABEL, duelHref, laneDuel, type DuelSide } from "@/lib/duels";
import { bestOfLabel, ROLE_LABEL } from "@/lib/format";
import { STAGE_VENUE, venueLabel } from "@/lib/jsonld";
import { finalArt } from "@/lib/hero-art";
import { compareTeamsHref } from "@/lib/links";
import { ROLES } from "@/lib/metrics";
import { championPool, formatPreview, LANE_CHART_MEASURES, leader, type PreviewMetric } from "@/lib/preview";
import { cn } from "@/lib/utils";
import { champIcon, championHref } from "@/lib/views";

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Short labels for the big numbers of a duel card. */
const SHORT: Record<string, string> = {
  kda: "KDA",
  dpm: "DPM",
  cspm: "CS/min",
  kp: "Kill part.",
  vspm: "Vision/min",
};

/** One half of a duel card: the champion's splash, tinted with the team's colour like the poster. */
function Half({ colour, splash, right }: { colour: string; splash: string | null; right?: boolean }) {
  return (
    <span
      aria-hidden
      className={cn(
        "absolute inset-0",
        right
          ? "[clip-path:polygon(54%_0,100%_0,100%_100%,46%_100%)]"
          : "[clip-path:polygon(0_0,54%_0,46%_100%,0_100%)]",
      )}
      style={{ background: colour }}
    >
      {splash ? (
        <span className={cn("absolute inset-y-0 block w-[56%]", right ? "right-0" : "left-0")}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
          <img
            src={splash}
            alt=""
            width={960}
            height={567}
            loading="lazy"
            decoding="async"
            className="size-full object-cover object-[50%_25%] mix-blend-luminosity contrast-125 saturate-[.65]"
          />
        </span>
      ) : null}
      <span
        className={cn(
          "absolute inset-0 from-black/90 via-black/45 to-black/10",
          right ? "bg-gradient-to-l" : "bg-gradient-to-r",
        )}
      />
    </span>
  );
}

function Player({
  data,
  side,
  team,
  metrics,
  right,
}: {
  data: IndexedDataset;
  side: DuelSide | null;
  team: TeamRef;
  metrics: { m: PreviewMetric; value: number | null; lead: boolean }[];
  right?: boolean;
}) {
  if (!side) return <span className="display text-3xl font-bold text-white/70">TBD</span>;
  const top = side.champions[0];
  return (
    <div className={cn("flex min-w-0 flex-col gap-2 sm:gap-3", right && "items-end text-right")}>
      <div className={cn("flex items-center gap-2", right && "flex-row-reverse")}>
        <TeamLogoLarge
          team={team}
          className="h-6 w-auto object-contain [filter:drop-shadow(0_0_2px_rgba(0,0,0,0.95))] sm:h-8"
        />
        <span className="kicker text-[10px] text-white/80 sm:text-xs">{team.short}</span>
      </div>
      <Link
        href={`/players/${side.player.playerId}`}
        className="display block max-w-full truncate text-4xl leading-[0.85] font-extrabold text-white no-underline drop-shadow-[0_4px_16px_rgba(0,0,0,0.7)] hover:underline sm:text-7xl"
      >
        {side.player.name}
      </Link>
      {top ? (
        <p className="text-xs text-white/80 sm:text-sm">
          Most played: <span className="font-semibold text-white">{top.champion}</span>, {plural(top.games, "game")}
        </p>
      ) : null}
      <dl className={cn("flex gap-4 sm:gap-6", right && "flex-row-reverse")}>
        {metrics.map(({ m, value, lead }) => (
          <div key={m.key}>
            <dt className="kicker text-[10px] text-white/70">{SHORT[m.key] ?? m.label}</dt>
            <dd
              className={cn(
                "display text-2xl leading-none font-extrabold tabular sm:text-4xl",
                lead ? "text-white" : "text-white/60",
              )}
            >
              {formatPreview(value, m.format)}
            </dd>
          </div>
        ))}
      </dl>
      {side.champions.length > 1 ? (
        <ul className={cn("flex gap-1.5", right && "flex-row-reverse")} aria-label={`${side.player.name}'s champions`}>
          {side.champions.slice(0, 4).map((c) => (
            <li key={c.champion} className="relative" title={`${c.champion}, ${plural(c.games, "game")}`}>
              <ChampionIcon champion={champIcon(data, c.champion)} size="sm" linked />
              <span className="absolute -right-1 -bottom-1 rounded bg-black px-0.5 text-[9px] leading-tight font-semibold text-white tabular">
                {c.games}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** A lane of the final as a poster of its own: both players over their most played champion's splash. */
function DuelPoster({
  data,
  series: s,
  role,
  team1,
  team2,
}: {
  data: IndexedDataset;
  series: Series;
  role: Role;
  team1: TeamRef;
  team2: TeamRef;
}) {
  const duel = laneDuel(data, s, role);
  if (!duel) return null;
  const splash = (side: DuelSide | null) => {
    const ref = side?.champions[0] ? championRef(data, side.champions[0].champion) : null;
    return ref ? finalArt(ref).splash : null;
  };
  const keys = CARD_METRICS(role)
    .filter((k) => k in SHORT)
    .slice(0, 3);
  const picked = keys.flatMap((k) => duel.metrics.filter((m) => m.key === k));
  const numbers = (pick: "a" | "b") =>
    picked.map((m) => ({ m, value: pick === "a" ? m.a : m.b, lead: leader(m) === pick }));
  const names = `${duel.a?.player.name ?? "TBD"} vs ${duel.b?.player.name ?? "TBD"}`;
  return (
    <article aria-label={`${ROLE_LABEL[role]}: ${names}`} className="dark overflow-hidden bg-black text-white">
      {/* The art, the white line and the diamond share one box: the line runs from 54% at the top to 46% at the
          bottom, so it crosses the exact centre, where the diamond sits. */}
      <div className="relative">
        <Half colour={POSTER_COLOUR[team1.id]} splash={splash(duel.a)} />
        <Half colour={POSTER_COLOUR[team2.id]} splash={splash(duel.b)} right />
        <svg aria-hidden viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full">
          <line x1="54" y1="0" x2="46" y2="100" stroke="white" strokeWidth="3" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="absolute top-1/2 left-1/2 grid size-10 -translate-x-1/2 -translate-y-1/2 rotate-45 place-items-center bg-white sm:size-14">
          <RoleGlyph kind={role} className="size-5 -rotate-45 text-black sm:size-7" />
        </div>
        <div className="relative grid grid-cols-[minmax(0,1fr)_2.5rem_minmax(0,1fr)] items-start gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_4rem_minmax(0,1fr)] sm:gap-6 sm:p-7">
          <Player data={data} side={duel.a} team={team1} metrics={numbers("a")} />
          <span aria-hidden />
          <Player data={data} side={duel.b} team={team2} metrics={numbers("b")} right />
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 border-t border-white/15 px-4 py-3 sm:px-7">
        <span className="kicker flex items-center gap-1.5 text-xs text-white/80">
          <RoleGlyph kind={role} className="size-4" />
          {DUEL_LABEL[role]}
        </span>
        <span className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {duel.a && duel.b ? (
            <Link
              href={chartHref(
                compareChart("players", duel.a.player.playerId, duel.b.player.playerId, LANE_CHART_MEASURES),
              )}
              aria-label={`Open in Charts: ${names}`}
              className="inline-flex items-center gap-1 text-sm font-semibold text-white/85 no-underline hover:text-white hover:underline"
            >
              Open in Charts <ArrowUpRightIcon className="size-4" aria-hidden />
            </Link>
          ) : null}
          <PosterButton
            href={duelHref(s.id, role)}
            label={`Full duel: ${names}`}
            className="px-4 py-1.5 text-lg sm:text-xl [&>svg]:size-5"
          >
            Full duel
          </PosterButton>
        </span>
      </div>
    </article>
  );
}

/** The five lanes of the final, one poster each. Numbers are from the games before the final, so never a spoiler. */
export function FinalDuels({
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
      className="pt-8 sm:pt-16"
      title="The five duels"
      description="Lane by lane, with each player's numbers at Worlds 2026 before the final. The brighter number is the better one."
    >
      <div className="-mx-4 space-y-3 sm:mx-0 sm:space-y-5">
        {ROLES.map((role) => (
          <DuelPoster key={role} data={data} series={s} role={role} team1={team1} team2={team2} />
        ))}
      </div>
    </Section>
  );
}

/** Each finalist's five most played champions as tall portraits, each opening its champion page. */
export function FinalPicks({ data, team1, team2 }: { data: IndexedDataset; team1: TeamRef; team2: TeamRef }) {
  return (
    <Section title="Signature picks" description="The champions each finalist has played most at Worlds 2026.">
      <div className="grid gap-6 lg:grid-cols-2">
        {[team1, team2].map((team) => {
          const pool = championPool(data.confirmedGames, team.id);
          return (
            <div key={team.id} className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Link href={`/teams/${team.id}`} className="flex items-center gap-2 no-underline hover:text-brand">
                  <TeamLogoLarge team={team} className="h-7 w-auto object-contain" />
                  <span className="display text-2xl font-bold">{team.name}</span>
                </Link>
                <Link
                  href={chartHref(championRecordChart({ teamId: team.id }, team.short, 10))}
                  aria-label={`Open in Charts: ${team.short} champions`}
                  className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground no-underline hover:text-foreground"
                >
                  Open in Charts <ArrowUpRightIcon className="size-3.5" aria-hidden />
                </Link>
              </div>
              <ol className="grid grid-cols-5 gap-1.5 sm:gap-2">
                {pool.played.map((c) => {
                  const ref = championRef(data, c.champion);
                  const href = championHref(data, c.champion);
                  const art = ref ? finalArt(ref).portrait : null;
                  const body = (
                    <>
                      {art ? (
                        // eslint-disable-next-line @next/next/no-img-element -- static export
                        <img
                          src={art}
                          alt=""
                          width={308}
                          height={560}
                          loading="lazy"
                          decoding="async"
                          className="aspect-[308/560] w-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                      ) : (
                        <span className="block aspect-[308/560] w-full bg-muted" />
                      )}
                      <span className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/10 to-transparent" />
                      <span className="absolute inset-x-0 bottom-0 p-1.5 text-white sm:p-2">
                        <span className="display block truncate text-sm leading-none font-bold sm:text-xl">
                          {c.champion}
                        </span>
                        <span className="text-[10px] text-white/80 sm:text-xs">{plural(c.count, "game")}</span>
                      </span>
                    </>
                  );
                  return (
                    <li key={c.champion} className="relative overflow-hidden rounded-md bg-black">
                      {href ? (
                        <Link
                          href={href}
                          aria-label={`${c.champion} at Worlds 2026`}
                          className="group block no-underline"
                        >
                          {body}
                        </Link>
                      ) : (
                        body
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function DeeperLink({ href, title, text }: { href: string; title: string; text: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center justify-between gap-3 rounded-xl border bg-card p-4 no-underline transition-colors hover:border-brand"
    >
      <span className="min-w-0">
        <span className="display block text-xl font-bold">{title}</span>
        <span className="text-sm text-muted-foreground">{text}</span>
      </span>
      <ArrowRightIcon
        className="size-5 shrink-0 text-brand motion-safe:transition-transform group-hover:translate-x-1"
        aria-hidden
      />
    </Link>
  );
}

/** For whoever wants more than the posters: the detailed views, one tap each. */
export function FinalDeeper({ team1, team2 }: { team1: TeamRef; team2: TeamRef }) {
  const teamChart = compareChart("teams", team1.id, team2.id, Object.keys(TEAM_RADAR_MEASURES));
  return (
    <Section title="Go deeper" description="Every number behind the posters.">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <DeeperLink
          href={compareTeamsHref(team1.id, team2.id)}
          title={`Compare ${team1.short} and ${team2.short}`}
          text="Every team stat side by side."
        />
        <DeeperLink href={chartHref(teamChart)} title="Team radar" text="Both teams on one radar, in Charts." />
        <DeeperLink href={`/teams/${team1.id}`} title={team1.name} text="Roster, champions, trophies and every game." />
        <DeeperLink href={`/teams/${team2.id}`} title={team2.name} text="Roster, champions, trophies and every game." />
        <DeeperLink href="/tournament" title="The bracket" text="How both teams reached the final." />
        <DeeperLink href="/records" title="Tournament records" text="The biggest games and numbers of Worlds 2026." />
      </div>
    </Section>
  );
}

/** On a finalist's page: their lane of the final, in the poster's colours, opening the full duel. */
export function FinalDuelBanner({
  href,
  role,
  player,
  opponent,
  teamIds,
}: {
  href: string;
  role: Role;
  player: string;
  opponent: string | null;
  teamIds: [string, string | null];
}) {
  const [mine, theirs] = teamIds;
  const label = `${player} vs ${opponent ?? "TBD"}`;
  return (
    <Link
      href={href}
      aria-label={`${DUEL_LABEL[role]} duel in the final: ${label}`}
      className="group dark relative flex flex-col gap-4 overflow-hidden bg-black p-4 text-white no-underline sm:flex-row sm:items-center sm:justify-between sm:p-6"
      style={{
        background: `linear-gradient(110deg, ${POSTER_COLOUR[mine] ?? "#000"} 0%, #000 45%, #000 55%, ${theirs ? (POSTER_COLOUR[theirs] ?? "#000") : "#000"} 100%)`,
      }}
    >
      <span className="flex items-center gap-4">
        <TeamLogoLarge
          team={{ id: mine }}
          className="h-12 w-auto object-contain [filter:drop-shadow(0_0_2px_rgba(0,0,0,0.95))] sm:h-16"
        />
        <span>
          <span className="kicker flex items-center gap-1.5 text-xs text-white/85">
            <RoleGlyph kind={role} className="size-4" />
            The final, {DUEL_LABEL[role].toLowerCase()} duel
          </span>
          <span className="display mt-1 block text-4xl leading-none font-extrabold sm:text-5xl">{label}</span>
        </span>
      </span>
      <span className="cut-corner display inline-flex items-center justify-center gap-3 self-start bg-white px-6 py-2.5 text-xl font-extrabold tracking-wide whitespace-nowrap text-black uppercase transition-colors group-hover:bg-zinc-200 sm:self-auto sm:text-2xl">
        Full duel
        <ArrowRightIcon aria-hidden className="size-5 motion-safe:transition-transform group-hover:translate-x-1" />
      </span>
    </Link>
  );
}

/**
 * Between the poster and the duels, in the page's own colours: when and where the final is played, a large countdown
 * and the two ways in (compare, watch). Once it starts the countdown gives way to "Live now", then to the score.
 */
export function FinalMatchInfo({
  series: s,
  team1,
  team2,
  watchUrl,
}: {
  series: Series;
  team1: TeamRef;
  team2: TeamRef;
  watchUrl: string;
}) {
  const venue = STAGE_VENUE.final;
  const details: [string, ReactNode][] = [
    ["Starts", <LocalTime key="t" iso={s.dateTimeUtc} hasTime={s.hasTime} />],
    ["Format", bestOfLabel(s.bestOf)],
    ["Venue", venueLabel(venue)],
    ...(s.patch ? ([["Patch", s.patch]] as [string, ReactNode][]) : []),
  ];
  return (
    <section aria-label="Match information" className="flex flex-col items-center gap-8 text-center sm:gap-10">
      <div className="w-full">
        <p className="kicker mb-4 text-xs text-brand sm:text-sm">
          {s.status === "finished" ? "Final result" : s.status === "live" ? "Happening now" : "Countdown to the final"}
        </p>
        {s.status === "finished" && s.score ? (
          <Spoiler label="Reveal the score">
            <span className="display inline-flex items-center gap-6 text-7xl leading-none font-extrabold sm:text-9xl">
              <span className="text-3xl sm:text-5xl">{team1.short}</span>
              {s.score.team1}-{s.score.team2}
              <span className="text-3xl sm:text-5xl">{team2.short}</span>
            </span>
          </Spoiler>
        ) : s.status === "live" ? (
          <p className="display text-7xl leading-none font-extrabold sm:text-9xl">Live now</p>
        ) : (
          // Wider than the page column, like the poster above: the board is the page's centrepiece until the final.
          <div className="ml-[calc(50%-50vw)] w-screen px-4 sm:px-8">
            <div className="mx-auto max-w-[1600px]">
              <FinalCountdown iso={s.dateTimeUtc} tone="page" />
            </div>
          </div>
        )}
      </div>
      <dl className="flex flex-wrap justify-center gap-x-10 gap-y-5 sm:gap-x-20">
        {details.map(([label, value]) => (
          <div key={label}>
            <dt className="kicker text-xs text-muted-foreground sm:text-sm">{label}</dt>
            <dd className="display mt-1 text-2xl font-bold whitespace-nowrap sm:text-4xl">{value}</dd>
          </div>
        ))}
      </dl>
      <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
        <Link
          href={compareTeamsHref(team1.id, team2.id)}
          className="cut-corner group display inline-flex items-center gap-4 bg-foreground px-8 py-3.5 text-2xl font-extrabold tracking-wide text-background uppercase no-underline transition-opacity hover:opacity-85 sm:px-12 sm:py-5 sm:text-4xl"
        >
          Compare teams
          <ArrowRightIcon
            aria-hidden
            className="size-6 motion-safe:transition-transform group-hover:translate-x-1 sm:size-8"
          />
        </Link>
        <a
          href={watchUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-base font-medium underline hover:text-brand sm:text-lg"
        >
          Watch on lolesports.com <ExternalLinkIcon className="size-4" aria-hidden />
        </a>
      </div>
    </section>
  );
}
