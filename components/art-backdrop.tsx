import { championLoadingUrl, championSplashUrl } from "@/lib/sources/ddragon";
import { cn } from "@/lib/utils";

export interface ArtRef {
  /** Data Dragon champion id, e.g. "Ahri". */
  ddragonId: string;
  /** Vertical position of the crop, 0–100. Splash art is landscape: faces usually sit around the upper third. */
  focus?: number;
}

/**
 * Champion art behind a header, lightly blurred and fully visible. Wide screens
 * get the splash (1215 px wide) so nothing looks upscaled; phones get the
 * lighter portrait. The image overflows the frame by 12 px so the blur never
 * fades at the edges, and a gradient on the text side keeps the contrast.
 */
export function ArtBackdrop({ art, className }: { art: ArtRef; className?: string }) {
  const bleed = { width: "calc(100% + 24px)", height: "calc(100% + 24px)" };
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 m-0 overflow-hidden bg-background", className)}
    >
      <picture>
        <source media="(min-width: 640px)" srcSet={championSplashUrl(art.ddragonId)} />
        <img
          src={championLoadingUrl(art.ddragonId)}
          alt=""
          width={1215}
          height={717}
          decoding="async"
          className="absolute -left-3 -top-3 max-w-none object-cover blur-[1.5px]"
          style={{ ...bleed, objectPosition: `center ${art.focus ?? 30}%` }}
        />
      </picture>
      <div className="absolute inset-0 bg-gradient-to-r from-background/85 via-background/45 to-transparent" />
    </div>
  );
}
