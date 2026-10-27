import Link from "next/link";
import { SpoilerToggle } from "@/components/spoilers";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { TopNav } from "@/components/layout/nav";
import { UpdatedAgo } from "@/components/layout/updated-ago";
import { site } from "@/lib/site";

export function Header({ updatedAt }: { updatedAt: string }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2 no-underline">
            <span className="inline-block size-2.5 rounded-sm bg-brand" aria-hidden />
            <span className="text-base font-semibold tracking-tight">{site.name}</span>
          </Link>
          <TopNav />
        </div>
        <div className="flex items-center gap-2 sm:gap-3">
          <UpdatedAgo updatedAt={updatedAt} className="hidden sm:inline" />
          <SpoilerToggle />
          <ThemeToggle />
        </div>
      </div>
      <div className="mx-auto max-w-6xl px-4 pb-1.5 sm:hidden">
        <UpdatedAgo updatedAt={updatedAt} />
      </div>
    </header>
  );
}
