# Rift Ledger

Free, fan-made statistics site for the 2026 League of Legends World Championship: matches, teams, players,
champions and drafts, rebuilt automatically from [Leaguepedia](https://lol.fandom.com) data.

Rift Ledger was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games.
Riot Games does not endorse or sponsor this project. Data: Leaguepedia (CC BY-SA).

## Stack

Next.js 15 (App Router, static generation), TypeScript strict, Tailwind CSS v4, shadcn/ui, Apache ECharts,
TanStack Table, Zod, Vitest. No database and no server: the ingest script writes JSON files that the site reads
at build time.

## Getting started

```bash
pnpm install
pnpm dev          # http://localhost:3000
pnpm test         # Vitest
pnpm typecheck
pnpm lint
pnpm build
```

Copy `.env.example` to `.env.local` and fill in the public variables (author, LinkedIn, imprint, site URL). `.env.local` and every other `.env*` file are ignored by git and must never be committed; `NEXT_PUBLIC_*` values end up in the public bundle, so they hold only public information. Leaguepedia bot credentials go in GitHub Actions secrets.

## Data pipeline

```bash
pnpm ingest            # refresh data/worlds-2026/*.json from Leaguepedia
pnpm ingest --force    # rewrite even when nothing changed
```

`scripts/ingest.ts` queries Leaguepedia's Cargo tables (paginated, throttled, with usage-limit detection and
exponential backoff), normalises the rows into seven entities, validates every game (10 player rows, 5 per side,
kills add up, duration > 0) and writes `data/worlds-2026/*.json` plus `meta.json`. Games that fail validation are
left out and listed as pending so the site never shows zeros.

`.github/workflows/ingest.yml` runs it every 15 minutes on match days (17:00–04:00 UTC) and every 6 hours
otherwise; it commits only when the data changed. See `NOTES.md` for Cargo quirks and decisions.

## Chart builder

Every chart on `/charts` is described by a short URL, for example `/charts?d=players&y=dpm&x=player&f=stage:swiss&t=bar&n=10` (data, measures, group-by, filters, chart type, top N). Opening the link reproduces the chart; the page exports PNG (with an attribution watermark) and CSV, and every chart has a table view and a text description.

## Project layout

- `app/` routes: home, tournament, matches, teams, players, champions, charts (builder), compare, about, privacy, imprint; `app/api/dataset` (static JSON for the browser) and `app/api/og/chart` (Open Graph preview of a chart)
- `components/` UI (spoiler mode, local times, team pills, champion icons, charts with table view, tables)
- `lib/data/` dataset types, Zod schemas, loader and shared indexing; `lib/metrics.ts` derived metrics; `lib/draft.ts`, `lib/standings.ts`
- `lib/query.ts` chart builder query engine (measures, dimensions, filters, validation); `lib/charts/` chart specs, builder, URL codec, templates
- `lib/sources/` Leaguepedia Cargo client and Data Dragon helpers
- `scripts/ingest.ts` pipeline; `data/worlds-2026/` generated dataset
- `docs/SPEC.md` original specification (Spanish); `NOTES.md` implementation notes (Spanish)
