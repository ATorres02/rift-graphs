"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { FEATURED_HREF, FINAL_HREF, NAV } from "@/components/layout/nav-items";
import { cn } from "@/lib/utils";

const FINAL_STYLE = "bg-gradient-to-r from-[#17B7E6] to-[#C39A4E] font-semibold text-black hover:text-black";

function isActive(pathname: string, href: string) {
  if (href === "/matches" && pathname.startsWith(FINAL_HREF)) return false;
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

/** Section links for wide screens; the header decides where it shows (inline or on its own row). */
export function TopNav({ className }: { className?: string }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className={cn("items-center gap-1", className)}>
      {/* Compare stays out of this row, or the tabs run into the controls on its right; the footer links to it. */}
      {NAV.filter((n) => n.href !== "/compare").map((item) => {
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
              item.href === FINAL_HREF && FINAL_STYLE,
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
  // Until the final is over its tab takes Tournament's place: the bracket is on the homepage.
  const items = NAV.filter((n) => ["/", FINAL_HREF, "/matches", "/teams", "/players", "/charts"].includes(n.href));
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
                    item.href === FINAL_HREF && `-my-1 box-content rounded-md px-2 py-1 ${FINAL_STYLE}`,
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
