import { LocalDayRange } from "@/components/local-time";
import type { IndexedDataset } from "@/lib/data/load";
import { swissBracket, type SwissBlock, type SwissColumn } from "@/lib/bracket";
import { BracketFrame } from "./bracket-frame";
import { bracketMinWidth, groupHeight, outcomeHeight, stack, stackHeight, type Placed } from "./geometry";
import { at, BlockHead, BracketColumn, bracketCss, cellTeam, Connectors, MatchSlot, TeamsBox } from "./parts";

const blockHeight = (b: SwissBlock) => (b.kind === "group" ? groupHeight(b.slots.length) : outcomeHeight());

/** Lines from each group to the groups its winners and losers play next. */
function links(from: SwissColumn, fromPlaced: Placed[], to: SwissColumn, toPlaced: Placed[]): [number, number][] {
  const out: [number, number][] = [];
  from.blocks.forEach((b, i) => {
    if (b.kind !== "group") return;
    for (const [w, l] of [
      [b.wins + 1, b.losses],
      [b.wins, b.losses + 1],
    ]) {
      const j = to.blocks.findIndex((x) => x.wins === w && x.losses === l);
      if (j >= 0) out.push([fromPlaced[i].anchor, toPlaced[j].anchor]);
    }
  });
  return out;
}

/**
 * The Swiss stage as the official graphic draws it: a column per round with a group per record, qualified and
 * eliminated boxes where they are decided, every series a link to its page.
 */
export function SwissBracket({ data, id = "swiss" }: { data: IndexedDataset; id?: string }) {
  const teamIds = data.teams.filter((t) => t.stages.includes("main")).map((t) => t.id);
  const bracket = swissBracket(data.series, teamIds);
  const heights = bracket.columns.map((c) => c.blocks.map(blockHeight));
  const height = Math.max(...heights.map(stackHeight));
  const placed = heights.map((h) => stack(h, height));
  const currentColumn = bracket.currentRound ?? bracket.columns.length;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: bracketCss(bracket.rounds, teamIds) }} />
      <BracketFrame steps={bracket.rounds} label="Swiss stage bracket">
        <div className="flex" style={{ minWidth: bracketMinWidth(bracket.columns.length) }}>
          {bracket.columns.flatMap((col, c) => {
            const index = c + 1;
            const column = (
              <BracketColumn
                key={`col-${index}`}
                id={`${id}-col-${index}`}
                index={index}
                title={col.outcomesOnly ? `Round ${col.round} results` : `Round ${col.round}`}
                current={index === currentColumn}
                height={height}
                revealLabel={col.outcomesOnly ? `Reveal round ${col.round} results` : `Reveal round ${col.round}`}
              >
                {col.blocks.map((b, i) => {
                  const p = placed[c][i];
                  const record = `${b.wins}-${b.losses}`;
                  if (b.kind === "outcome") {
                    const qualified = b.result === "qualified";
                    return (
                      <div key={b.key} className="absolute inset-x-0" style={at(p.top, p.height)}>
                        <BlockHead record={record} accent={qualified}>
                          {qualified ? (
                            <>
                              Qualified <span className="text-muted-foreground">{b.places}</span>
                            </>
                          ) : (
                            "Eliminated"
                          )}
                        </BlockHead>
                        <TeamsBox
                          teams={b.teamIds.flatMap((t) => cellTeam(data, t)?.team ?? [])}
                          slots={b.slots}
                          tone={qualified ? "brand" : "muted"}
                        />
                      </div>
                    );
                  }
                  const days = b.days;
                  return (
                    <div key={b.key} className="absolute inset-x-0" style={at(p.top, p.height)}>
                      <BlockHead
                        record={
                          <>
                            {record}
                            <span className="sr-only"> group,</span>
                          </>
                        }
                      >
                        {days.length ? <LocalDayRange from={days[0]} to={days[days.length - 1]} /> : "TBD"}
                        {b.bestOf ? ` / Bo${b.bestOf}` : ""}
                      </BlockHead>
                      <ul className="space-y-1.5">
                        {b.slots.map((s, k) => (
                          <MatchSlot
                            key={s?.id ?? `tbd-${k}`}
                            series={s}
                            team1={cellTeam(data, s?.team1Id ?? null)}
                            team2={cellTeam(data, s?.team2Id ?? null)}
                            context={`Round ${b.round}, ${record} group${b.bestOf ? `, Bo${b.bestOf}` : ""}`}
                            step={b.round}
                          />
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </BracketColumn>
            );
            const next = bracket.columns[c + 1];
            return next
              ? [
                  column,
                  <Connectors
                    key={`gap-${index}`}
                    height={height}
                    links={links(col, placed[c], next, placed[c + 1])}
                  />,
                ]
              : [column];
          })}
        </div>
      </BracketFrame>
    </>
  );
}
