"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FEATURED_HREF, NAV } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Section links for wide screens; the header decides where it shows (inline or on its own row). */
export function TopNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn("items-center gap-1", className)}>
      {NAV.map((item) => {
        const active = isActive(pathname, item.href);
        const featured = item.href === FEATURED_HREF;
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground no-underline transition-colors hover:bg-accent hover:text-foreground",
              featured && "inline-flex items-center gap-1.5 text-brand",
              active && "bg-accent text-foreground",
            )}
          >
            {featured ? <Icon className="size-4 text-brand" aria-hidden /> : null}
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BottomNav() {
  const pathname = usePathname();
  // Six slots on mobile; champions, compare and about are reachable from the footer and in-page links.
  const items = NAV.filter((n) => ["/", "/tournament", "/matches", "/teams", "/players", "/charts"].includes(n.href));
  return (
    <nav
      aria-label="Main (mobile)"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 backdrop-blur md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="grid grid-cols-6">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const featured = item.href === FEATURED_HREF;
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium no-underline",
                  active ? "text-brand" : "text-muted-foreground",
                )}
              >
                {/* The featured section keeps its icon on a brand tile, so it stands out even when not open. */}
                <Icon
                  className={cn(
                    "size-5",
                    featured && "-my-1 box-content rounded-md bg-brand-soft px-2 py-1 text-brand",
                  )}
                  aria-hidden
                />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
