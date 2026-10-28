import Image from "next/image";
import { championIconUrl } from "@/lib/sources/ddragon";
import { cn } from "@/lib/utils";

export interface ChampionIconRef {
  name: string;
  /** Data Dragon id, null when the champion could not be resolved. */
  ddragonId: string | null;
  version: string;
}

const SIZES = { xs: 20, sm: 28, md: 36, lg: 48 };

/** Champion portrait from Data Dragon (version pinned by the pipeline), with a text fallback. */
export function ChampionIcon({
  champion,
  size = "md",
  className,
  showName = false,
  dimmed = false,
}: {
  champion: ChampionIconRef;
  size?: keyof typeof SIZES;
  className?: string;
  showName?: boolean;
  dimmed?: boolean;
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
  if (!showName) return <span className={cn("inline-flex shrink-0", className)}>{icon}</span>;
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      {icon}
      <span className={cn("text-sm", dimmed && "text-muted-foreground line-through")}>{champion.name}</span>
    </span>
  );
}
