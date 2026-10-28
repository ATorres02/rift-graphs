import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { getData } from "@/lib/data/load";
import { riotNotice, site } from "@/lib/site";

export const metadata: Metadata = {
  title: "About",
  description: `What ${site.name} is, where the data comes from and the legal notices behind this fan project.`,
};

export default function AboutPage() {
  const { meta, tournament } = getData();
  return (
    <article className="max-w-3xl space-y-3">
      <PageHeader
        title={`About ${site.name}`}
        description="A free, fan-made statistics site for the 2026 World Championship. Not affiliated with Riot Games or any team."
      />

      <h2 className="text-lg font-semibold">What it is</h2>
      <p className="text-muted-foreground">
        {site.name} turns the public match data of the 2026 League of Legends World Championship into something you can
        read in a minute: results in your time zone, team and player profiles, champion presence and full drafts. Every
        number on the site is derived from the same per-game rows, so the pages and the upcoming chart builder always
        agree.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Data sources</h2>
      <ul className="list-disc space-y-2 pl-5 text-muted-foreground">
        <li>
          Match, team, player and draft data comes from{" "}
          <a href={site.leaguepedia.url} target="_blank" rel="noopener noreferrer" className="underline">
            Leaguepedia
          </a>
          , licensed under{" "}
          <a href={site.leaguepedia.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">
            CC BY-SA
          </a>
          . It is maintained by volunteers, so scoreboards can take minutes to hours to appear after a game; until then
          a series shows &ldquo;Data on the way&rdquo; instead of zeros.
        </li>
        <li>
          Provisional results (who won a series, the score, whether it is in progress) come from the schedule of{" "}
          <a href={site.lolesportsUrl} target="_blank" rel="noopener noreferrer" className="underline">
            lolesports.com
          </a>{" "}
          or are typed by hand from the broadcast. They carry a &ldquo;Provisional&rdquo; tag until Leaguepedia confirms
          them.
        </li>
        <li>
          Champion names and icons come from Riot&apos;s{" "}
          <a href={site.dataDragonUrl} target="_blank" rel="noopener noreferrer" className="underline">
            Data Dragon
          </a>{" "}
          (version {tournament.ddragonVersion}, matching patch {tournament.patch ?? "unknown"}).
        </li>
        <li>
          No team logos, player photos or official artwork are used. Teams are identified by their tag on a pill
          coloured by region.
        </li>
        <li>
          Data was last refreshed on {meta.updatedAt.replace("T", " ").replace("Z", " UTC")}. The site rebuilds itself
          every 15 minutes on match days and every 6 hours otherwise.
        </li>
      </ul>

      <h2 className="mt-8 text-lg font-semibold">How fresh is the data</h2>
      <p className="text-muted-foreground">
        Results are published within minutes of each game and carry a &ldquo;Provisional&rdquo; tag. Detailed stats
        (drafts, scoreboards, objectives) arrive when Leaguepedia publishes them, usually the same day, and the tag
        disappears. Provisional results count for records, the Swiss standings and the bracket; player and champion
        rankings and the chart builder only use games confirmed by Leaguepedia. If two sources disagree, Leaguepedia
        wins.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Legal notice</h2>
      <p className="rounded-xl border bg-card p-4 text-sm">{riotNotice}</p>
      <p className="text-muted-foreground">
        This is a non-commercial community project: no paywall, no donations, no company behind it. Team names and
        player aliases belong to their respective owners and are used descriptively.
      </p>

      <h2 className="mt-8 text-lg font-semibold">Who made it</h2>
      <p className="text-muted-foreground">
        Developed with AI by{" "}
        {site.author.linkedin ? (
          <a href={site.author.linkedin} target="_blank" rel="noopener noreferrer" className="underline">
            {site.author.name}
          </a>
        ) : (
          site.author.name
        )}
        {site.repoUrl ? (
          <>
            {" "}
            · the source code is{" "}
            <a href={site.repoUrl} target="_blank" rel="noopener noreferrer" className="underline">
              public
            </a>
          </>
        ) : null}
        .
      </p>

      <h2 className="mt-8 text-lg font-semibold">Privacy and imprint</h2>
      <p className="text-muted-foreground">
        The site sets no cookies and has no accounts. Read the{" "}
        <Link href="/privacy" className="underline">
          privacy notice
        </Link>{" "}
        and the{" "}
        <Link href="/imprint" className="underline">
          imprint
        </Link>
        .
      </p>
    </article>
  );
}
