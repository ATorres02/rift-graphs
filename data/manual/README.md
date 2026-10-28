# Manual game files

Provisional results typed by hand when a game is over but Leaguepedia has not published it yet. One JSON file per
game, named `<series>-g<n>.json` (series id as in the site URL `/matches/<series>`, `n` = game number), for example
`main-event-round-4-1-g1.json`.

Start from `_template.json`: it lists every field with a short explanation in the `_help` keys (ignored by the
pipeline). The only required fields are `series`, `game`, `blue`, `red`, `winner`, `duration` and `picks`; add
`stage`, `date`, `bestOf` and `teams` when the series is not on the site yet.

## From a phone

1. On github.com open the `data/manual` folder, tap "Add file", "Create new file".
2. Name it `<series>-g<n>.json`, paste the template, edit the values, commit to `main`.
3. The ingest workflow runs on that push. If the data changed, the site is deployed a few minutes later. The game
   shows the "Provisional" tag until Leaguepedia publishes it.

## What the pipeline does with them

- Priority per field: Leaguepedia (validated) > manual file > lolesports API. When Leaguepedia publishes the game,
  it replaces the manual one; the file is kept and listed as superseded in `meta.json`. Disagreements are written to
  `data/worlds-2026/conflicts.json` for review.
- A file that does not validate is skipped and listed in `meta.json` under `sources.manual.invalid` (also printed
  in the workflow log). It never breaks the build.
- Manual games count for series scores, standings and the bracket, but not for player or champion rankings nor for
  the chart builder until Leaguepedia confirms them.
