import Link from "next/link";
import { riotNotice, site } from "@/lib/site";

/** Legal footer, as required by the SPEC's "Marco legal" section. */
export function Footer() {
  return (
    <footer className="mt-12 border-t pb-20 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-sm text-muted-foreground">
        <p>{riotNotice}</p>
        <p>
          Data:{" "}
          <a href={site.leaguepedia.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            Leaguepedia
          </a>{" "}
          (
          <a href={site.leaguepedia.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
            {site.leaguepedia.license}
          </a>
          ). Champion icons from Riot&apos;s Data Dragon. No team logos or player photos are used.
        </p>
        <p>
          Developed with AI by{" "}
          {site.author.linkedin ? (
            <a href={site.author.linkedin} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              {site.author.name}
            </a>
          ) : (
            <span>{site.author.name}</span>
          )}
          . Free, no ads, no accounts.
        </p>
        <nav aria-label="Legal" className="flex flex-wrap gap-x-4 gap-y-1">
          <Link href="/about" className="underline hover:text-foreground">
            About
          </Link>
          <Link href="/privacy" className="underline hover:text-foreground">
            Privacy
          </Link>
          <Link href="/imprint" className="underline hover:text-foreground">
            Imprint
          </Link>
          {site.repoUrl ? (
            <a href={site.repoUrl} target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
              Source code
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
