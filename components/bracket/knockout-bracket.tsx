import { LocalTime } from "@/components/local-time";
import type { IndexedDataset } from "@/lib/data/load";
import { knockoutBracket, type KnockoutColumn } from "@/lib/bracket";
import { STAGE_LABEL } from "@/lib/format";
import { BracketFrame } from "./bracket-frame";
import { bracketMinWidth, G, groupHeight, outcomeHeight, placeAt, stack, stackHeight, type Placed } from "./geometry";
import { at, BlockHead, BracketColumn, bracketCss, cellTeam, Connectors, MatchSlot, TeamsBox } from "./parts";

const TITLES: Record<KnockoutColumn["stage"], string> = {
  quarterfinals: "Quarterfinals",
  semifinals: "Semifinals",
  final: "Final",
};

/** Four columns would stretch to a quarter of the page each; this keeps the boxes close to the Swiss ones. */
const MAX_COLUMN = 240;

const REVEAL: Record<KnockoutColumn["stage"], string> = {
  quarterfinals: "",
  semifinals: "Reveal semifinals",
  final: "Reveal final",
};

/**
 * Single-elimination bracket from the quarterfinals to the champion. Each pair of series feeds the one at the same
 * position in the next column; `knockoutBracket` orders them once the semifinal teams are known.
 */
export function KnockoutBracket({ data, id = "knockout" }: { data: IndexedDataset; id?: string }) {
  const bracket = knockoutBracket(data.series);
  if (!bracket) return null;
  const { columns } = bracket;
  const cell = groupHeight(1);

  // First column stacked; every later box centred between the two that feed it.
  const placed: Placed[][] = [
    stack(
      columns[0].slots.map(() => cell),
      stackHeight(columns[0].slots.map(() => cell)),
    ),
  ];
  for (let c = 1; c < columns.length; c++) {
    const prev = placed[c - 1];
    placed.push(
      columns[c].slots.map((_, i) => {
        const feeders = [prev[2 * i], prev[2 * i + 1]].filter(Boolean);
        const anchor = feeders.length ? feeders.reduce((a, p) => a + p.anchor, 0) / feeders.length : prev[0].anchor;
        return placeAt(anchor - G.head - G.cell / 2, cell);
      }),
    );
  }
  const finalAnchor = placed[placed.length - 1][0].anchor;
  const champion = placeAt(finalAnchor - G.head - G.outcome / 2, outcomeHeight());
  const height = Math.max(...placed.flat().map((p) => p.top + p.height), champion.top + champion.height);

  const steps = columns.length;
  const currentIndex = bracket.currentStage
    ? columns.findIndex((c) => c.stage === bracket.currentStage) + 1
    : steps + 1;
  const teamIds = Array.from(
    new Set(columns.flatMap((c) => c.slots.flatMap((s) => [s?.team1Id, s?.team2Id])).filter((t): t is string => !!t)),
  );
  const championTeam = cellTeam(data, bracket.championId)?.team;

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: bracketCss(steps, teamIds) }} />
      <BracketFrame steps={steps} label="Knockout bracket">
        <div className="flex" style={{ minWidth: bracketMinWidth(columns.length + 1) }}>
          {columns.flatMap((col, c) => {
            const index = c + 1;
            const toNext = (placed[c + 1] ?? [champion]).map((p) => p.anchor);
            return [
              <BracketColumn
                key={col.stage}
                id={`${id}-${col.stage}`}
                index={index}
                title={TITLES[col.stage]}
                current={index === currentIndex}
                height={height}
                revealLabel={REVEAL[col.stage]}
                maxWidth={MAX_COLUMN}
              >
                {col.slots.map((s, i) => {
                  const p = placed[c][i];
                  return (
                    <div key={s?.id ?? `tbd-${i}`} className="absolute inset-x-0" style={at(p.top, p.height)}>
                      <BlockHead>
                        {s ? <LocalTime iso={s.dateTimeUtc} mode="day" hasTime={s.hasTime} /> : "TBD"}
                        {s ? ` / Bo${s.bestOf}` : ""}
                      </BlockHead>
                      <ul>
                        <MatchSlot
                          series={s}
                          team1={cellTeam(data, s?.team1Id ?? null)}
                          team2={cellTeam(data, s?.team2Id ?? null)}
                          context={`${STAGE_LABEL[col.stage]}${s ? `, Bo${s.bestOf}` : ""}`}
                          step={index}
                        />
                      </ul>
                    </div>
                  );
                })}
              </BracketColumn>,
              <Connectors
                key={`gap-${col.stage}`}
                height={height}
                links={placed[c].map((p, i) => [p.anchor, toNext[Math.floor(i / 2)] ?? toNext[0]])}
              />,
            ];
          })}
          <BracketColumn
            id={`${id}-champion`}
            index={steps + 1}
            title="Champion"
            current={currentIndex === steps + 1}
            height={height}
            revealLabel="Reveal champion"
            maxWidth={MAX_COLUMN}
          >
            <div className="absolute inset-x-0" style={at(champion.top, champion.height)}>
              <BlockHead accent>World champion</BlockHead>
              <TeamsBox teams={championTeam ? [championTeam] : []} slots={1} tone="brand" withName />
            </div>
          </BracketColumn>
        </div>
      </BracketFrame>
    </>
  );
}
