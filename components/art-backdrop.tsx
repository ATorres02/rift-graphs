import { championLoadingUrl } from "@/lib/sources/ddragon";
import { cn } from "@/lib/utils";

export interface ArtRef {
  /** Data Dragon champion id, e.g. "Ahri". */
  ddragonId: string;
  /** Vertical position of the crop, 0–100. Loading art is a portrait: the face sits in the upper third. */
  focus?: number;
}

/**
 * Blurred, darkened champion art behind a header. Decorative (empty alt) and
 * always covered by a gradient to `background`, so text keeps its contrast.
 */
export function ArtBackdrop({ art, className }: { art: ArtRef; className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element -- remote art, decorative, no optimiser in a static export */}
      <img
        src={championLoadingUrl(art.ddragonId)}
        alt=""
        width={308}
        height={560}
        decoding="async"
        className="size-full scale-110 object-cover opacity-70 blur-sm"
        style={{ objectPosition: `center ${art.focus ?? 20}%` }}
      />
      <div className="absolute inset-0 bg-gradient-to-r from-background via-background/85 to-background/40" />
      <div className="absolute inset-0 bg-gradient-to-t from-background/90 to-transparent" />
    </div>
  );
}
