import Link from "next/link";
import { LocalTime } from "@/components/local-time";
import type { TeamRef } from "@/lib/data/load";
import type { Series } from "@/lib/data/types";
import { bestOfLabel } from "@/lib/format";
import { STAGE_VENUE, venueLabel } from "@/lib/jsonld";
import { Spoiler } from "@/components/spoilers";
import { TeamLogoLarge } from "./poster-button";
import { FinalCountdown } from "./final-countdown";
import { POSTER_COLOUR, PosterButton } from "./poster-button";

interface Art {
  name: string;
  splash: string;
  portrait: string;
}

const PANEL = {
  first: {
    clip: "[clip-path:polygon(0_0,100%_0,100%_42%,0_58%)] sm:[clip-path:polygon(0_0,60%_0,40%_100%,0_100%)]",
    art: "inset-x-0 top-0 h-[58%] sm:inset-y-0 sm:right-auto sm:left-0 sm:h-full sm:w-[60%]",
    position: "object-[100%_0%]",
  },
  second: {
    clip: "[clip-path:polygon(0_58%,100%_42%,100%_100%,0_100%)] sm:[clip-path:polygon(60%_0,100%_0,100%_100%,40%_100%)]",
    art: "inset-x-0 bottom-0 h-[58%] sm:inset-y-0 sm:right-0 sm:left-auto sm:h-full sm:w-[60%]",
    position: "object-top",
  },
};

/** One half of the poster; the clip-path also limits where it can be clicked. */
function Panel({ team, art, at }: { team: TeamRef; art: Art | null; at: keyof typeof PANEL }) {
  return (
    <Link
      href={`/teams/${team.id}`}
      aria-label={`${team.name} team page`}
      className={`absolute inset-0 saturate-[.65] transition-[filter] hover:brightness-110 ${PANEL[at].clip}`}
      style={{ background: POSTER_COLOUR[team.id] }}
    >
      {art ? (
        <span className={`absolute block ${PANEL[at].art}`}>
          {/* eslint-disable-next-line @next/next/no-img-element -- static export */}
          <img
            src={art.splash}
            alt=""
            width={1215}
            height={717}
            fetchPriority="high"
            decoding="async"
            className={`size-full object-cover mix-blend-luminosity contrast-125 ${PANEL[at].position}`}
          />
        </span>
      ) : null}
      <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/15 to-black/40" />
    </Link>
  );
}

function Side({ team, className, right }: { team: TeamRef; className: string; right?: boolean }) {
  return (
    <div
      aria-hidden
      className={`pointer-events-none absolute flex flex-col gap-1.5 sm:gap-2 ${right ? "items-end" : "items-start"} ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, sized by CSS */}
      <img
        src={`/teams/large/${team.id}.png`}
        alt=""
        className="h-10 w-auto object-contain [filter:drop-shadow(0_0_2px_rgba(0,0,0,0.95))_drop-shadow(0_3px_18px_rgba(0,0,0,0.95))] sm:h-24"
      />
      <span className="display text-[4.75rem] leading-[0.8] font-extrabold text-white drop-shadow-[0_6px_24px_rgba(0,0,0,0.6)] sm:text-[clamp(9rem,17vw,16rem)]">
        {team.short}
      </span>
    </div>
  );
}

/**
 * The final's poster, full width, one diagonal half per team: on the homepage while the final is the next series, and
 * at the top of the final's own page (`onSeriesPage`: the teams join the heading, and the time and buttons move to their own band).
 */
export function FinalHero({
  series: s,
  team1,
  team2,
  art1,
  art2,
  onSeriesPage = false,
}: {
  series: Series;
  team1: TeamRef;
  team2: TeamRef;
  art1: Art | null;
  art2: Art | null;
  onSeriesPage?: boolean;
}) {
  const live = s.status === "live";
  const champion = s.status === "finished" ? [team1, team2].find((t) => t.id === s.winnerId) : undefined;
  return (
    <section
      className={`dark ml-[calc(50%-50vw)] w-screen bg-black text-white ${onSeriesPage ? "" : "-mt-6 sm:-mt-8"}`}
    >
      <div className="relative h-[400px] overflow-hidden sm:h-[min(640px,72vh)] sm:min-h-[520px]">
        <Panel team={team1} art={art1} at="first" />
        <Panel team={team2} art={art2} at="second" />
        <svg
          aria-hidden
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="pointer-events-none absolute inset-0 size-full"
        >
          <line
            x1="6"
            y1="57.04"
            x2="94"
            y2="42.96"
            className="sm:hidden"
            stroke="white"
            strokeWidth="3"
            vectorEffect="non-scaling-stroke"
          />
          <line
            x1="56.8"
            y1="16"
            x2="42"
            y2="90"
            className="hidden sm:block"
            stroke="white"
            strokeWidth="4"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
        <div className="pointer-events-none absolute inset-x-0 top-3 z-10 text-center sm:top-6">
          <h1 className="display text-2xl font-extrabold tracking-wide uppercase drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] sm:text-5xl">
            The Worlds 2026 Final
            {onSeriesPage ? (
              <span className="sr-only">
                : {team1.name} vs {team2.name}
              </span>
            ) : null}
          </h1>
          {onSeriesPage ? null : (
            <p className="sr-only">
              {team1.name} vs {team2.name}
            </p>
          )}
        </div>
        <Side team={team1} className="top-14 left-5 sm:top-auto sm:bottom-10 sm:left-[max(2rem,calc(50vw-36rem))]" />
        <Side team={team2} right className="right-5 bottom-4 sm:right-[max(2rem,calc(50vw-36rem))] sm:bottom-10" />
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-1/2 z-10 grid size-12 -translate-x-1/2 -translate-y-1/2 rotate-45 place-items-center bg-white sm:size-20"
        >
          <span className="display -rotate-45 text-xl font-extrabold text-black sm:text-4xl">VS</span>
        </div>
      </div>
      {champion ? (
        <div className="text-center [&>button]:mt-5 [&>button]:px-4 [&>button]:py-2 [&>button]:text-base">
          <Spoiler as="div" label="Reveal the world champion">
            <div style={{ background: `linear-gradient(100deg, ${POSTER_COLOUR[champion.id]}, #000 80%)` }}>
              <div className="mx-auto flex max-w-6xl flex-col items-center gap-4 px-4 py-6 text-center sm:flex-row sm:gap-8 sm:py-8 sm:text-left">
                <TeamLogoLarge
                  team={champion}
                  className="h-20 w-auto object-contain [filter:drop-shadow(0_0_2px_rgba(0,0,0,0.95))_drop-shadow(0_3px_18px_rgba(0,0,0,0.95))] sm:h-36"
                />
                <div className="min-w-0 flex-1">
                  <p className="display text-3xl leading-none font-extrabold tracking-wide uppercase sm:text-5xl">
                    World champion
                  </p>
                  <p className="display mt-1 text-6xl leading-none font-extrabold sm:text-8xl">{champion.name}</p>
                </div>
                {s.score ? (
                  <p className="display text-6xl leading-none font-extrabold whitespace-nowrap sm:text-8xl">
                    {s.score.team1}-{s.score.team2}
                  </p>
                ) : null}
              </div>
            </div>
          </Spoiler>
        </div>
      ) : null}
      {/* On the final's own page the time, place and buttons sit in their own band below the poster. */}
      {onSeriesPage ? null : (
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            {champion ? null : live ? (
              <p className="display text-5xl font-extrabold">Live now</p>
            ) : (
              <FinalCountdown iso={s.dateTimeUtc} />
            )}
            <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-zinc-300 sm:text-sm">
              <LocalTime iso={s.dateTimeUtc} hasTime={s.hasTime} />
              <span>{bestOfLabel(s.bestOf)}</span>
              <span>{venueLabel(STAGE_VENUE.final)}</span>
            </p>
          </div>
          <PosterButton href={`/matches/${s.id}`} label={`Final preview: ${team1.name} vs ${team2.name}`}>
            {champion ? "Relive the final" : live ? "Follow the series" : "Match preview"}
          </PosterButton>
        </div>
      )}
    </section>
  );
}
