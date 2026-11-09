/**
 * Career history of the players and teams at the tournament, from Leaguepedia, into data/career.json.
 *
 * Usage: pnpm career [--force]
 *
 * Careers change slowly, so a run within 6 hours of the last one does nothing unless forced. The tournament being
 * played is left out: its results live on the site already and would spoil them here.
 * data/team-lineage.json lists, per team, the older names of the same organization (reviewed by hand).
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { buildCareer, type CareerEntry, type CareerRow } from "../lib/career";
import { asString, LeaguepediaClient, type CargoRow } from "../lib/sources/leaguepedia";

const CURRENT = /^2026 Season World Championship/;
const MAX_AGE_MS = 6 * 3600 * 1000;
const root = process.cwd();
const OUT = path.join(root, "data/career.json");

const json = async <T>(file: string): Promise<T> => JSON.parse(await readFile(path.join(root, file), "utf8")) as T;
const sqlIn = (v: string[]) => v.map((x) => `"${x.replace(/"/g, '\\"')}"`).join(",");
const flag = (v: unknown): boolean | null => (v === null || v === undefined ? null : Number(v) === 1);
const chunk = <T>(a: T[], n: number) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

const FIELDS =
  "R.Event=Event,R.Date=EventDate,CONCAT(R.Place)=Place,R.Team=Team,R.OverviewPage=Page,T.League=League,T.Split=Split,T.IsOfficial=Official,T.IsPlayoffs=Playoffs,T.IsQualifier=Qualifier,T.TournamentLevel=Level";

function toRow(r: CargoRow): CareerRow | null {
  const event = asString(r.Event);
  const date = asString(r.EventDate);
  const place = asString(r.Place);
  const team = asString(r.Team);
  const overviewPage = asString(r.Page);
  if (!event || !date || !place || !team || !overviewPage || CURRENT.test(overviewPage)) return null;
  return {
    event,
    date: date.slice(0, 10),
    place,
    team,
    overviewPage,
    league: asString(r.League),
    split: asString(r.Split),
    isOfficial: flag(r.Official),
    isPlayoffs: flag(r.Playoffs),
    isQualifier: flag(r.Qualifier),
    level: asString(r.Level),
  };
}

async function main() {
  const force = process.argv.includes("--force");
  try {
    const last = await json<{ updatedAt: string }>("data/career.json");
    if (!force && Date.now() - Date.parse(last.updatedAt) < MAX_AGE_MS) {
      console.log("[career] updated less than 6 hours ago; nothing to do");
      return;
    }
  } catch {
    /* first run */
  }
  const client = new LeaguepediaClient({
    transport: "export",
    credentials: null,
    log: (m) => console.log(`[career] ${m}`),
  });
  const dataset = "data/worlds-2026";
  const players = await json<{ id: string; page: string }[]>(`${dataset}/players.json`);
  const teams = await json<{ id: string; page: string }[]>(`${dataset}/teams.json`);
  const lineage = await json<Record<string, string[]>>("data/team-lineage.json");

  const playerId = new Map(players.map((p) => [p.page.toLowerCase(), p.id]));
  const playerRows = new Map<string, CareerRow[]>();
  for (const part of chunk(
    players.map((p) => p.page),
    40,
  )) {
    const rows = await client.query({
      tables: "TournamentPlayers=P,TournamentResults=R,Tournaments=T",
      joinOn: "P.PageAndTeam=R.PageAndTeam,R.OverviewPage=T.OverviewPage",
      fields: `P.Link=Link,${FIELDS}`,
      where: `P.Link IN (${sqlIn(part)}) AND (R.Showmatch IS NULL OR R.Showmatch=0)`,
    });
    for (const r of rows) {
      const id = playerId.get((asString(r.Link) ?? "").toLowerCase());
      const row = toRow(r);
      if (id && row) (playerRows.get(id) ?? playerRows.set(id, []).get(id)!).push(row);
    }
  }

  const pageToTeam = new Map<string, string>();
  for (const t of teams)
    for (const page of [t.page, ...(lineage[t.id] ?? [])]) pageToTeam.set(page.toLowerCase(), t.id);
  const teamRows = new Map<string, CareerRow[]>();
  for (const part of chunk([...pageToTeam.keys()], 40)) {
    const rows = await client.query({
      tables: "TournamentResults=R,Tournaments=T",
      joinOn: "R.OverviewPage=T.OverviewPage",
      fields: FIELDS,
      where: `R.Team IN (${sqlIn(part)}) AND (R.Showmatch IS NULL OR R.Showmatch=0)`,
    });
    for (const r of rows) {
      const id = pageToTeam.get((asString(r.Team) ?? "").toLowerCase());
      const row = toRow(r);
      if (id && row) (teamRows.get(id) ?? teamRows.set(id, []).get(id)!).push(row);
    }
  }

  const build = (m: Map<string, CareerRow[]>) =>
    Object.fromEntries(
      [...m].sort(([a], [b]) => a.localeCompare(b)).map(([id, rows]) => [id, buildCareer(rows)]),
    ) as Record<string, CareerEntry[]>;
  const out = { updatedAt: new Date().toISOString(), players: build(playerRows), teams: build(teamRows) };
  await writeFile(OUT, JSON.stringify(out, null, 1) + "\n");
  console.log(
    `[career] ${Object.keys(out.players).length} players, ${Object.keys(out.teams).length} teams (${client.requestCount} requests)`,
  );
}

main().catch((err: unknown) => {
  console.error("[career] failed; the last file stays:", err);
  process.exit(1);
});
