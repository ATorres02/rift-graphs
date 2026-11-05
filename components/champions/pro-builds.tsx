import type { ReactNode } from "react";
import { ItemIcon, RuneIcon, SpellIcon } from "@/components/loadout-icons";
import type { ChampionBuild } from "@/lib/builds";
import { fmt } from "@/lib/format";
import type { LoadoutIndex } from "@/lib/sources/loadout";

/** One choice and how often the pros made it: icon, name, share bar. */
function ShareRow({ icon, label, games, total }: { icon: ReactNode; label: string; games: number; total: number }) {
  const share = total ? games / total : 0;
  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3">
      {icon}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{label}</span>
        <span className="mt-1 block h-1 rounded-full bg-muted" aria-hidden>
          <span className="block h-1 rounded-full bg-brand" style={{ width: `${Math.round(share * 100)}%` }} />
        </span>
      </span>
      <span className="text-right leading-tight">
        <span className="block text-sm font-semibold tabular">{fmt.pct(share)}</span>
        <span className="block text-[11px] text-muted-foreground tabular">
          {games} of {total}
        </span>
      </span>
    </li>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-2.5">
      <h3 className="kicker text-xs text-brand">{title}</h3>
      {children}
    </div>
  );
}

/** Items, boots, runes and summoner spells the pros used on a champion, from the final inventory of every game. */
export function ProBuilds({ build, loadout }: { build: ChampionBuild; loadout: LoadoutIndex }) {
  const total = build.games;
  const items = build.items.slice(0, 6);
  const boots = build.boots.slice(0, 3);
  const support = build.support.slice(0, 3);
  const keystones = build.keystones.slice(0, 3);
  const spells = build.spells.slice(0, 3);
  const page = build.page;
  return (
    <div className="grid gap-3 lg:grid-cols-2">
      <div className="space-y-5 rounded-xl border bg-card p-4">
        <Block title="Most built items">
          {items.length ? (
            <ul className="space-y-2.5">
              {items.map((i) => (
                <ShareRow
                  key={i.name}
                  icon={<ItemIcon name={i.name} loadout={loadout} size="lg" />}
                  label={i.name}
                  games={i.games}
                  total={total}
                />
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">No finished items yet.</p>
          )}
        </Block>
        {boots.length ? (
          <Block title="Boots">
            <ul className="space-y-2.5">
              {boots.map((i) => (
                <ShareRow
                  key={i.name}
                  icon={<ItemIcon name={i.name} loadout={loadout} size="lg" />}
                  label={i.name}
                  games={i.games}
                  total={total}
                />
              ))}
            </ul>
          </Block>
        ) : null}
        {support.length ? (
          <Block title="Support item">
            <ul className="space-y-2.5">
              {support.map((i) => (
                <ShareRow
                  key={i.name}
                  icon={<ItemIcon name={i.name} loadout={loadout} size="lg" />}
                  label={i.name}
                  games={i.games}
                  total={total}
                />
              ))}
            </ul>
          </Block>
        ) : null}
      </div>

      <div className="space-y-5 rounded-xl border bg-card p-4">
        <Block title="Keystones">
          <ul className="space-y-2.5">
            {keystones.map((k) => (
              <ShareRow
                key={k.name}
                icon={<RuneIcon name={k.name} loadout={loadout} size="lg" />}
                label={k.name}
                games={k.games}
                total={total}
              />
            ))}
          </ul>
        </Block>
        {page ? (
          <Block title="Most used rune page">
            <RunePageView page={page} loadout={loadout} total={total} />
          </Block>
        ) : null}
        {spells.length ? (
          <Block title="Summoner spells">
            <ul className="space-y-2.5">
              {spells.map((s) => (
                <ShareRow
                  key={s.names.join()}
                  icon={
                    <span className="inline-flex gap-1">
                      {s.names.map((n) => (
                        <SpellIcon key={n} name={n} loadout={loadout} size="md" />
                      ))}
                    </span>
                  }
                  label={s.names.join(" and ")}
                  games={s.games}
                  total={total}
                />
              ))}
            </ul>
          </Block>
        ) : null}
      </div>
    </div>
  );
}

function RunePageView({
  page,
  loadout,
  total,
}: {
  page: NonNullable<ChampionBuild["page"]>;
  loadout: LoadoutIndex;
  total: number;
}) {
  const [keystone, ...rest] = page.runes;
  const primary = rest.slice(0, 3);
  const secondary = rest.slice(3, 5);
  const shards = rest.slice(5, 8);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-start gap-x-6 gap-y-3">
        <figure className="space-y-1.5">
          <figcaption className="text-[11px] text-muted-foreground">{page.primaryTree}</figcaption>
          <span className="flex items-center gap-1.5">
            {keystone ? <RuneIcon name={keystone} loadout={loadout} size="lg" /> : null}
            {primary.map((n, i) => (
              <RuneIcon key={i} name={n} loadout={loadout} size="md" />
            ))}
          </span>
        </figure>
        {page.secondaryTree ? (
          <figure className="space-y-1.5">
            <figcaption className="text-[11px] text-muted-foreground">{page.secondaryTree}</figcaption>
            <span className="flex h-8 items-center gap-1.5">
              {secondary.map((n, i) => (
                <RuneIcon key={i} name={n} loadout={loadout} size="md" />
              ))}
            </span>
          </figure>
        ) : null}
        <figure className="space-y-1.5">
          <figcaption className="text-[11px] text-muted-foreground">Shards</figcaption>
          <span className="flex h-8 items-center gap-1.5">
            {shards.map((n, i) => (
              <RuneIcon key={i} name={n} loadout={loadout} size="sm" shard />
            ))}
          </span>
        </figure>
      </div>
      <p className="text-xs text-muted-foreground">
        {[keystone, ...primary, ...secondary].filter(Boolean).join(", ")}. Exactly this page in {page.games} of {total}{" "}
        games.
      </p>
    </div>
  );
}
