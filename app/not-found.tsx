import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/page-header";
import { baseOpenGraph, defaultOgImage } from "@/lib/site";

// Own title, noindex instead of the layout's "index, follow" (Next adds its own noindex too), and no canonical
// or og:url: `./` would resolve to /_not-found, which does not exist.
export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: true },
  alternates: { canonical: null },
  openGraph: { ...baseOpenGraph, url: undefined, images: [defaultOgImage] },
};

export default function NotFound() {
  return (
    <div className="py-12">
      <PageHeader
        title="Page not found"
        description="That team, player or series is not in the dataset. Ids change only when Leaguepedia renames a page."
      />
      <Link href="/" className="text-brand underline">
        Back to the home page
      </Link>
    </div>
  );
}
