/* eslint-disable @next/next/no-img-element -- static export with unoptimized images: next/image would emit the same <img>, and these are tiny cached SVGs */
import Link from "next/link";
import { site } from "@/lib/site";

/**
 * The Rift Graphs logo from the brand kit (assets/rift-graphs-logo): the horizontal lockup, or the mark
 * alone on very narrow screens, in its dark or light variant following the site theme (class "dark" on <html>).
 * The SVGs are served from public/brand and never recoloured or stretched.
 */
export function BrandLogo() {
  return (
    <Link href="/" aria-label={`${site.name}, home`} className="flex shrink-0 items-center no-underline">
      <span className="hidden min-[360px]:contents">
        <img src="/brand/logo-horizontal-light.svg" alt="" width={133} height={28} className="h-7 w-auto dark:hidden" />
        <img
          src="/brand/logo-horizontal-dark.svg"
          alt=""
          width={133}
          height={28}
          className="hidden h-7 w-auto dark:block"
        />
      </span>
      <span className="contents min-[360px]:hidden">
        <img src="/brand/logo-mark-light.svg" alt="" width={28} height={28} className="size-7 dark:hidden" />
        <img src="/brand/logo-mark.svg" alt="" width={28} height={28} className="hidden size-7 dark:block" />
      </span>
    </Link>
  );
}
