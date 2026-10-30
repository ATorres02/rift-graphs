# Rift Graphs

Free, fan-made statistics site for the 2026 League of Legends World Championship: matches, teams, players,
champions and drafts, rebuilt automatically from [Leaguepedia](https://lol.fandom.com) data.

Rift Graphs was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games.
Riot Games does not endorse or sponsor this project. Data: Leaguepedia (CC BY-SA).

## Stack

Next.js 15 (App Router, static export), TypeScript strict, Tailwind CSS v4, shadcn/ui, Apache ECharts,
TanStack Table, Zod, Vitest. No database and no server: the ingest script writes JSON files that the site reads
at build time, and the exported folder is served by Cloudflare Workers (Static Assets).

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # Vitest
pnpm typecheck
pnpm lint
pnpm build
pnpm test:e2e     # Playwright smoke tests against the export (needs `pnpm build` and `pnpm exec playwright install chromium`)
```

`.github/workflows/ci.yml` runs all of the above on every pull request into `main`. `scripts/screenshots.mts` captures
the key pages (mobile and desktop) from a running `wrangler dev` for visual review.

Copy `.env.example` to `.env.local` and fill in the public variables (author, LinkedIn, imprint, site URL, Cloudflare Web Analytics token). `.env.local` and every other `.env*` file are ignored by git and must never be committed; `NEXT_PUBLIC_*` values end up in the public bundle, so they hold only public information. Leaguepedia bot credentials and the lolesports key go in GitHub Actions secrets.

## Data pipeline

```bash
pnpm ingest            # refresh data/worlds-2026/*.json from Leaguepedia
pnpm ingest --force    # rewrite even when nothing changed
```

`scripts/ingest.ts` queries Leaguepedia's Cargo tables (paginated, throttled, with usage-limit detection and
exponential backoff), normalises the rows into seven entities, validates every game (10 player rows, 5 per side,
kills add up, duration > 0) and writes `data/worlds-2026/*.json` plus `meta.json`. Games that fail validation are
left out and listed as pending so the site never shows zeros.

Three sources are merged by priority in `lib/ingest/merge.ts`: **Leaguepedia** (validated, final) >
**manual files** in `data/manual/` (one JSON per game typed by hand, see `data/manual/README.md`) > the
**unofficial lolesports API** (series state, score and winner only, enabled by `LOLESPORTS_API_KEY`). Series and
games carry `source` and `provisional`; disagreements between sources go to `data/worlds-2026/conflicts.json` and
`meta.json` lists what was applied, superseded or ignored. Provisional results count for standings and the bracket
but not for rankings or the chart builder.

`.github/workflows/ingest.yml` runs it and commits only when the data changed, then calls the deploy workflow.
On match days it is started by the Worker's cron (`worker/index.ts`, every 2 minutes): it compares the published
`/api/schedule.json` with the lolesports state and starts the workflow as soon as a match starts (even ahead of
its slot), a game ends or a series ends, plus every 15 minutes while a series is in play for Leaguepedia's
scoreboards (`lib/ingest/trigger.ts`). GitHub's own schedule (every 15 minutes on match days, every 6 hours
otherwise) and pushes that touch `data/manual/` remain as fallbacks. `scripts/probe-lolesports.ts` dumps raw lolesports
responses into the git-ignored `.ingest-cache/` when the API needs a look.

## Deployment

`pnpm build` writes the static site to `out/`; `.github/workflows/deploy.yml` builds it and uploads it with
`wrangler deploy` on every push to `main` (and after every data commit). Configuration lives in `wrangler.jsonc`;
`public/_headers` sets cache and security headers. The workflow needs two repository secrets,
`CLOUDFLARE_API_TOKEN` (Workers Scripts: Edit) and `CLOUDFLARE_ACCOUNT_ID`, and reads the public `NEXT_PUBLIC_*`
values from repository variables. The Worker's cron needs two Worker secrets, set in the Cloudflare dashboard:
`GITHUB_DISPATCH_TOKEN` (fine-grained token, Actions: read and write on this repository only) and
`LOLESPORTS_API_KEY`. To preview the export locally:

```bash
pnpm build
pnpm exec wrangler dev   # serves out/ the way Cloudflare will, at http://localhost:8787
```

## Chart builder

Every chart on `/charts` is described by a short URL, for example `/charts?d=players&y=dpm&x=player&f=stage:swiss&t=bar&n=10` (data, measures, group-by, filters, chart type, top N). Opening the link reproduces the chart; the page exports PNG (with an attribution watermark) and CSV, and every chart has a table view and a text description.

## Project layout

- `app/` routes: home, tournament, matches, teams, players, champions, charts (builder), compare, about, privacy, imprint; `app/api/dataset.json` (static JSON for the browser); `opengraph-image.tsx` files for series, teams and the chart builder
- `components/` UI (spoiler mode, local times, team pills, champion icons, provisional tags, charts with table view, tables)
- `lib/data/` dataset types, Zod schemas, loader and shared indexing; `lib/metrics.ts` derived metrics; `lib/draft.ts`, `lib/standings.ts`
- `lib/query.ts` chart builder query engine (measures, dimensions, filters, validation); `lib/charts/` chart specs, builder, URL codec, templates
- `lib/sources/` Leaguepedia Cargo client, lolesports client, manual-file schema and Data Dragon helpers; `lib/ingest/merge.ts` source merging
- `scripts/ingest.ts` pipeline; `data/worlds-2026/` generated dataset; `data/manual/` hand-typed provisional games
- `wrangler.jsonc`, `public/_headers`, `.github/workflows/` ingest and deploy; `worker/index.ts` 404 fallback and the
  match-day cron (`lib/ingest/trigger.ts` decides when to refresh)

## License

The code is released under the [MIT License](LICENSE), copyright 2026 Alex Torres. Some content in the repository
is not covered by it:

- `data/worlds-2026/` is derived from [Leaguepedia](https://lol.fandom.com) and shared under
  [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/), like its source.
- Champion art (loaded from Riot's Data Dragon) and the role and objective icons in `public/icons/` belong to Riot
  Games and are used under Riot's "Legal Jibber Jabber" policy.
- Team logos in `public/teams/` come from lolesports.com and belong to their teams. They are shown only to identify
  each team and are not covered by the MIT License.
- The Rift Graphs name and logo (`assets/rift-graphs-logo/`, `public/brand/`) are not licensed for reuse.
