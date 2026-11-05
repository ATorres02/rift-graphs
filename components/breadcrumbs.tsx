import { Fragment } from "react";
import Link from "next/link";
import { breadcrumbJsonLd, jsonLdHtml, type Crumb } from "@/lib/jsonld";
import { site } from "@/lib/site";

/**
 * Where a page sits ("Matches / Quarterfinals / TES vs iG"), above its header, with the same trail as a
 * BreadcrumbList for search engines. Slashes as separators, like the rest of the site; the last item is the page. Its
 * own bottom margin wins over a parent space-y (Tailwind 4 puts that margin below each child), keeping it close.
 */
export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdHtml(breadcrumbJsonLd(items, site.url)) }}
      />
      <nav aria-label="Breadcrumb" className="mb-3 text-xs text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
          {items.map((c, i) => {
            const last = i === items.length - 1;
            return (
              <Fragment key={`${c.label}-${i}`}>
                <li
                  className={last ? "min-w-0 truncate text-foreground" : undefined}
                  aria-current={last ? "page" : undefined}
                >
                  {c.href && !last ? (
                    <Link href={c.href} className="no-underline hover:text-foreground hover:underline">
                      {c.label}
                    </Link>
                  ) : (
                    c.label
                  )}
                </li>
                {last ? null : (
                  <li aria-hidden className="text-muted-foreground/60">
                    /
                  </li>
                )}
              </Fragment>
            );
          })}
        </ol>
      </nav>
    </>
  );
}
