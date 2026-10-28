import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy",
  description: `Privacy notice for ${site.name}: no cookies, no accounts, no tracking.`,
};

export default function PrivacyPage() {
  return (
    <article className="max-w-3xl space-y-6 text-muted-foreground">
      <PageHeader title="Privacy notice" description="Short version: this site does not collect personal data." />
      <section className="space-y-2">
        <h2 className="display text-2xl font-bold text-foreground">What the site stores in your browser</h2>
        <p>
          Two preferences are kept in your browser&apos;s local storage and never leave it: the colour theme (light or
          dark) and whether results are hidden (spoiler mode). No cookies are set.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="display text-2xl font-bold text-foreground">Hosting</h2>
        <p>
          The site is a set of static pages served by Cloudflare&apos;s content delivery network. Like any web server,
          the provider may keep short-lived technical logs (IP address, requested page, time) to operate and secure the
          service.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="display text-2xl font-bold text-foreground">Analytics</h2>
        {site.analytics.cfBeaconToken ? (
          <p>
            Page views are counted with Cloudflare Web Analytics, which uses no cookies, no local storage and no
            persistent identifiers; it reports aggregated figures (pages, countries, browsers) only. You can block it
            with any content blocker and the site works the same.
          </p>
        ) : (
          <p>
            No analytics are active. If usage statistics are added later they will be cookie-free and aggregated, and
            this page will say so.
          </p>
        )}
      </section>
      <section className="space-y-2">
        <h2 className="display text-2xl font-bold text-foreground">Third-party requests</h2>
        <p>
          Champion icons are loaded from Riot Games&apos; Data Dragon content delivery network
          (ddragon.leagueoflegends.com). Your browser sends the usual request metadata to that server when it fetches an
          image.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="display text-2xl font-bold text-foreground">Players&apos; data</h2>
        <p>
          Statistics shown here concern professional players&apos; public activity in an official competition and are
          sourced from Leaguepedia under the CC BY-SA licence.
        </p>
      </section>
      <section className="space-y-2">
        <h2 className="display text-2xl font-bold text-foreground">Contact</h2>
        <p>
          {site.imprint.email ? (
            <a href={`mailto:${site.imprint.email}`} className="underline">
              {site.imprint.email}
            </a>
          ) : (
            "See the imprint page."
          )}
        </p>
      </section>
    </article>
  );
}
