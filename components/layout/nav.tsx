"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { HomeIcon, SwordsIcon, ShieldIcon, UsersIcon, SparklesIcon, TrophyIcon, InfoIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const NAV = [
  { href: "/", label: "Home", icon: HomeIcon },
  { href: "/tournament", label: "Tournament", icon: TrophyIcon },
  { href: "/matches", label: "Matches", icon: SwordsIcon },
  { href: "/teams", label: "Teams", icon: ShieldIcon },
  { href: "/players", label: "Players", icon: UsersIcon },
  { href: "/champions", label: "Champions", icon: SparklesIcon },
  { href: "/about", label: "About", icon: InfoIcon },
] as const;

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

export function TopNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
      {NAV.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={isActive(pathname, item.href) ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground",
            isActive(pathname, item.href) && "bg-accent text-foreground",
          )}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  const items = NAV.filter((n) => n.href !== "/about");
  return (
    <nav aria-label="Main (mobile)" className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden" style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      <ul className="grid grid-cols-6">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn("flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium no-underline", active ? "text-brand" : "text-muted-foreground")}
              >
                <Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
