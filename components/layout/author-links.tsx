import { site } from "@/lib/site";

/** Brand marks as single-path SVGs (Simple Icons, CC0), drawn in the current text colour. */
const ICONS = {
  linkedin:
    "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  x: "M18.901 1.153h3.68l-8.04 9.19L24 22.846h-7.406l-5.8-7.584-6.638 7.584H.474l8.6-9.83L0 1.154h7.594l5.243 6.932ZM17.61 20.644h2.039L6.486 3.24H4.298Z",
} as const;

const PROFILES = [
  { key: "linkedin", label: "LinkedIn", href: site.author.linkedin },
  { key: "x", label: "X", href: site.author.x },
] as const;

/** The author's name followed by icon links to their public profiles (only those that are set). */
export function AuthorLinks() {
  const profiles = PROFILES.filter((p) => p.href);
  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 align-middle">
      <span className="font-medium text-foreground">{site.author.name}</span>
      {profiles.map((p) => (
        <a
          key={p.key}
          href={p.href}
          target="_blank"
          rel="noopener noreferrer me"
          aria-label={`${site.author.name} on ${p.label}`}
          title={`${site.author.name} on ${p.label}`}
          className="inline-flex size-7 items-center justify-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
        >
          <svg viewBox="0 0 24 24" aria-hidden="true" className="size-4" fill="currentColor">
            <path d={ICONS[p.key]} />
          </svg>
        </a>
      ))}
    </span>
  );
}
