import Link from "next/link";
import { PageHeader } from "@/components/page-header";

export default function NotFound() {
  return (
    <div className="py-12">
      <PageHeader title="Page not found" description="That team, player or series is not in the dataset. Ids change only when Leaguepedia renames a page." />
      <Link href="/" className="text-brand underline">
        Back to the home page
      </Link>
    </div>
  );
}
