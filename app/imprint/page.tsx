import type { Metadata } from "next";
import { PageHeader } from "@/components/page-header";
import { site } from "@/lib/site";

export const metadata: Metadata = { title: "Imprint", description: `Imprint (Impressum) for ${site.name}.` };

export default function ImprintPage() {
  const { name, address, email } = site.imprint;
  const complete = Boolean(name && address);
  return (
    <article className="max-w-3xl space-y-6 text-muted-foreground">
      <PageHeader title="Imprint" description="Information about the person responsible for this website." />
      {complete ? (
        <address className="not-italic">
          <p className="font-medium text-foreground">{name}</p>
          {address.split("\n").map((line, i) => (
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
        <p className="rounded-xl border border-dashed p-4">
          The imprint details have not been published yet. They are read from the <code>NEXT_PUBLIC_IMPRINT_NAME</code>,{" "}
          <code>NEXT_PUBLIC_IMPRINT_ADDRESS</code> and <code>NEXT_PUBLIC_IMPRINT_EMAIL</code> environment variables at build time.
        </p>
      )}
      <p>
        {site.name} is a private, non-commercial fan project. It is not affiliated with, endorsed or sponsored by Riot Games or any of the teams
        shown.
      </p>
    </article>
  );
}
