import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowRightIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/* A one-off for the final: each side takes the colour of its team's logo. */
export const POSTER_COLOUR: Record<string, string> = { "bilibili-gaming": "#17B7E6", "gen-g": "#C39A4E" };

/** A finalist's high-resolution logo (public/teams/large). */
export function TeamLogoLarge({ team, className }: { team: { id: string }; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- static export, sized by CSS
  return <img src={`/teams/large/${team.id}.png`} alt="" className={className} />;
}

/** The final's call to action: solid white with a cut corner, like the poster's VS mark. */
export function PosterButton({
  href,
  label,
  children,
  className,
}: {
  href: string;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "cut-corner group display inline-flex items-center justify-center gap-3 bg-white px-8 py-3.5 text-2xl font-extrabold tracking-wide whitespace-nowrap text-black uppercase no-underline transition-colors hover:bg-zinc-200 sm:text-3xl",
        className,
      )}
    >
      {children}
      <ArrowRightIcon aria-hidden className="size-6 motion-safe:transition-transform group-hover:translate-x-1" />
    </Link>
  );
}
