import Image from "next/image";
import Link from "next/link";
import { championIconUrl } from "@/lib/sources/ddragon";
import { cn } from "@/lib/utils";

export interface ChampionIconRef {
  name: string;
  /** Data Dragon id, null when the champion could not be resolved. */
  ddragonId: string | null;
  version: string;
  /** The champion's page under /champions, when it has one. */
  href?: string | null;
}

const SIZES = { xs: 20, sm: 28, md: 36, lg: 48 };

/** Champion portrait from Data Dragon (version pinned by the pipeline), with a text fallback. */
export function ChampionIcon({
  champion,
  size = "md",
  className,
  showName = false,
  dimmed = false,
  linked = false,
}: {
  champion: ChampionIconRef;
  size?: keyof typeof SIZES;
  className?: string;
  showName?: boolean;
  dimmed?: boolean;
  /** Link to the champion's page when it has one. Off by default: many icons sit inside other links. */
  linked?: boolean;
}) {
  const px = SIZES[size];
  const icon = champion.ddragonId ? (
    <Image
      src={championIconUrl(champion.version, champion.ddragonId)}
      alt={champion.name}
      width={px}
      height={px}
      className={cn("rounded-md bg-muted object-cover", dimmed && "opacity-50 grayscale")}
      unoptimized
    />
  ) : (
    <span
      className={cn(
        "inline-flex items-center justify-center rounded-md bg-muted text-[10px] font-semibold text-muted-foreground",
        dimmed && "opacity-50",
      )}
      style={{ width: px, height: px }}
      title={champion.name}
      aria-label={champion.name}
    >
      {champion.name.slice(0, 3)}
    </span>
  );
  const href = linked ? champion.href : null;
  if (!showName) {
    return href ? (
      <Link
        href={href}
        title={champion.name}
        className={cn("inline-flex shrink-0 rounded-md hover:ring-2 hover:ring-brand", className)}
      >
        {icon}
      </Link>
    ) : (
      <span className={cn("inline-flex shrink-0", className)}>{icon}</span>
    );
  }
  const name = <span className={cn("text-sm", dimmed && "text-muted-foreground line-through")}>{champion.name}</span>;
  return href ? (
    <Link href={href} className={cn("group/champ inline-flex items-center gap-2 no-underline", className)}>
      {icon}
      <span className="group-hover/champ:text-brand group-hover/champ:underline">{name}</span>
    </Link>
  ) : (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {icon}
      {name}
    </span>
  );
}
