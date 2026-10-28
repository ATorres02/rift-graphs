import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Imprint", description: `Imprint (Impressum) for ${site.name}.` };

export default function ImprintPage() {
  const { name, address, email } = site.imprint;
  // Show whatever has been published (name and email alone are enough for a non-commercial site).
  const hasDetails = Boolean(name || address || email);
  return (
    <article className="max-w-3xl space-y-6 text-muted-foreground">
      <PageHeader title="Imprint" description="Information about the person responsible for this website." />
      {hasDetails ? (
        <address className="not-italic">
          {name ? <p className="font-medium text-foreground">{name}</p> : null}
          {address
            .split("\n")
            .filter(Boolean)
            .map((line, i) => (
              <p key={i}>{line}</p>
            ))}
          {email ? (
            <p>
              <a href={`mailto:${email}`} className="underline">
                {email}
              </a>
            </p>
          ) : null}
        </address>
      ) : (
        <p className="rounded-xl border border-dashed p-4">The contact details will be published here soon.</p>
      )}
      <p>
        {site.name} is a private, non-commercial fan project. It is not affiliated with, endorsed or sponsored by Riot
        Games or any of the teams shown.
      </p>
    </article>
  );
}
