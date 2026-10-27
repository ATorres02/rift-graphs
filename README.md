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

Copy `.env.example` to `.env.local` and fill in the public variables (author, LinkedIn, imprint, site URL).

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

## Project layout

- `app/` routes: home, tournament, matches, teams, players, champions, about, privacy, imprint
- `components/` UI (spoiler mode, local times, team pills, champion icons, charts with table view, tables)
- `lib/data/` dataset types, Zod schemas, loader; `lib/metrics.ts` derived metrics; `lib/draft.ts`, `lib/standings.ts`
- `lib/sources/` Leaguepedia Cargo client and Data Dragon helpers
- `scripts/ingest.ts` pipeline; `data/worlds-2026/` generated dataset
- `docs/SPEC.md` original specification (Spanish); `NOTES.md` implementation notes (Spanish)
