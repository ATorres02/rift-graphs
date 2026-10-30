import Link from "next/link";
import { AuthorLinks } from "@/components/layout/author-links";
import { NAV } from "@/components/layout/nav-items";
import { riotNotice, site } from "@/lib/site";

/** Legal footer, as required by the SPEC's "Marco legal" section. */
export function Footer() {
  return (
    <footer className="mt-12 border-t pb-20 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-4 px-4 py-8 text-sm text-muted-foreground">
        <p>{riotNotice}</p>
        <p>
          Data:{" "}
          <a
            href={site.leaguepedia.url}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            Leaguepedia
          </a>{" "}
          (
          <a
            href={site.leaguepedia.licenseUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-foreground"
          >
            {site.leaguepedia.license}
          </a>
          ). Champion art from Riot&apos;s Data Dragon, role and objective icons from the League client, team logos from
          lolesports.com. No player photos are used.
        </p>
        <p>
          Free, no ads, no accounts. Developed with AI by <AuthorLinks />
        </p>
        <nav aria-label="Site" className="flex flex-wrap gap-x-4 gap-y-1">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className="hover:text-foreground">
              {item.label}
            </Link>
          ))}
        </nav>
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
            <a
              href={site.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-foreground"
            >
              Source code
            </a>
          ) : null}
        </nav>
      </div>
    </footer>
  );
}
