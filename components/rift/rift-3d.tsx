"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { MARKERS, MARKER_LABEL, type MarkerKind } from "./layout";
import { RoleGlyph } from "./role-glyph";
import type { RiftScene } from "./scene";
import type { Role } from "@/lib/data/types";
import { championLoadingUrl } from "@/lib/sources/ddragon";
import { cn } from "@/lib/utils";

export interface RiftLeader {
  role: Role;
  playerId: string;
  name: string;
  teamShort: string;
  teamId: string;
  champion: string;
  ddragonId: string | null;
  stat: string;
  statLabel: string;
  games: number;
}

export interface RiftObjective {
  kind: "dragon" | "baron";
  teamId: string | null;
  teamName: string | null;
  stat: string;
  statLabel: string;
}

/** Screen positions (fractions of the canvas) used when WebGL is unavailable and the poster is shown. */
const POSTER_POSITIONS: Record<MarkerKind, [number, number]> = {
  top: [0.31, 0.39],
  jungle: [0.405, 0.5],
  mid: [0.5, 0.43],
  bot: [0.48, 0.7],
  support: [0.58, 0.7],
  dragon: [0.575, 0.58],
  baron: [0.44, 0.32],
};

const ROLE_ORDER: MarkerKind[] = ["top", "jungle", "mid", "bot", "support", "dragon", "baron"];

/**
 * The Rift: a low-poly 3D scene (three.js, loaded only when scrolled into view)
 * with one button per role and objective. A poster image stands in until the
 * scene is ready, when WebGL is missing, or when the visitor prefers reduced motion.
 */
export function Rift3D({ leaders, objectives }: { leaders: RiftLeader[]; objectives: RiftObjective[] }) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RiftScene | null>(null);
  const buttons = useRef(new Map<MarkerKind, HTMLButtonElement>());
  const [status, setStatus] = useState<"idle" | "loading" | "ready" | "poster">("idle");
  const [active, setActive] = useState<MarkerKind | null>(null);

  // Load the scene when the section scrolls into view.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        setStatus("loading");
        // Wait for an idle moment so the three.js download and scene build never compete with the page's own load.
        const idle = (cb: () => void) =>
          typeof window.requestIdleCallback === "function"
            ? window.requestIdleCallback(cb, { timeout: 2000 })
            : window.setTimeout(cb, 300);
        idle(() =>
          import("./scene")
            .then(({ createRiftScene }) => {
              const c = canvas.current;
              const b = box.current;
              if (!c || !b) return;
              const rect = b.getBoundingClientRect();
              const scene = createRiftScene(c, rect.width, rect.height);
              scene.resize(rect.width, rect.height);
              scene.setReducedMotion(reduced);
              sceneRef.current = scene;
              setStatus("ready");
            })
            .catch(() => setStatus("poster")),
        );
      },
      // Only when the section is really on screen (no early margin): a visitor who never scrolls down never pays for it.
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Keep the canvas sized to the box and the buttons glued to the projected marker positions.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      sceneRef.current?.resize(rect.width, rect.height);
    });
    ro.observe(el);
    let raf = 0;
    const place = () => {
      const rect = el.getBoundingClientRect();
      for (const m of MARKERS) {
        const btn = buttons.current.get(m.kind);
        if (!btn) continue;
        const p = sceneRef.current?.project(m.kind) ?? null;
        const x = p ? p.x : POSTER_POSITIONS[m.kind][0] * rect.width;
        const y = p ? p.y : POSTER_POSITIONS[m.kind][1] * rect.height;
        btn.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
      }
      raf = requestAnimationFrame(place);
    };
    place();
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  const onPointerMove = (e: React.PointerEvent) => {
    const rect = box.current?.getBoundingClientRect();
    if (!rect || !sceneRef.current) return;
    sceneRef.current.setPointer(
      ((e.clientX - rect.left) / rect.width - 0.5) * 2,
      ((e.clientY - rect.top) / rect.height - 0.5) * 2,
    );
  };

  const leader = active && active !== "dragon" && active !== "baron" ? leaders.find((l) => l.role === active) : null;
  const objective = active === "dragon" || active === "baron" ? objectives.find((o) => o.kind === active) : null;

  return (
    <div className="space-y-3">
      <div
        ref={box}
        onPointerMove={onPointerMove}
        onPointerLeave={() => sceneRef.current?.setPointer(0, 0)}
        className="relative aspect-[4/3] w-full overflow-hidden rounded-md border bg-[#07080c] sm:aspect-[16/10]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- our own render of the scene, shown until WebGL takes over */}
        <img
          src="/rift-poster.jpg"
          alt=""
          width={1400}
          height={900}
          loading="lazy"
          decoding="async"
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-500",
            status === "ready" ? "opacity-0" : "opacity-100",
          )}
        />
        <canvas
          ref={canvas}
          className={cn("absolute inset-0 size-full", status === "ready" ? "opacity-100" : "opacity-0")}
          aria-hidden
        />
        {MARKERS.map((m) => {
          const isObjective = m.kind === "dragon" || m.kind === "baron";
          return (
            <button
              key={m.kind}
              ref={(el) => {
                if (el) buttons.current.set(m.kind, el);
                else buttons.current.delete(m.kind);
              }}
              type="button"
              onClick={() => setActive((a) => (a === m.kind ? null : m.kind))}
              aria-pressed={active === m.kind}
              aria-label={MARKER_LABEL[m.kind]}
              className={cn(
                "absolute left-0 top-0 flex size-11 items-center justify-center rounded-full border-2 bg-[#07080c]/90 text-white shadow-lg backdrop-blur transition-[transform,border-color,box-shadow] hover:scale-110",
                isObjective ? (m.kind === "dragon" ? "border-orange-400" : "border-violet-400") : "border-brand",
                active === m.kind && "ring-4 ring-white/30",
              )}
            >
              <RoleGlyph
                kind={m.kind}
                className={isObjective ? (m.kind === "dragon" ? "text-orange-300" : "text-violet-300") : "text-brand"}
              />
            </button>
          );
        })}
        {status === "loading" ? (
          <span className="kicker absolute bottom-3 left-3 text-[10px] text-white/60">Loading the Rift</span>
        ) : null}
      </div>

      <div role="group" aria-label="Pick a role" className="flex flex-wrap gap-1.5">
        {ROLE_ORDER.map((k) => (
          <button
            key={k}
            type="button"
            onClick={() => setActive((a) => (a === k ? null : k))}
            aria-pressed={active === k}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors hover:border-brand",
              active === k ? "border-brand bg-brand text-brand-foreground" : "bg-card text-muted-foreground",
            )}
          >
            <RoleGlyph kind={k} className="size-3.5" />
            {MARKER_LABEL[k]}
          </button>
        ))}
      </div>

      {leader ? (
        <div className="flex flex-wrap items-center gap-4 rounded-md border bg-card p-3 sm:p-4">
          {leader.ddragonId ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote art, fixed box
            <img
              src={championLoadingUrl(leader.ddragonId)}
              alt=""
              width={308}
              height={560}
              loading="lazy"
              decoding="async"
              className="h-28 w-16 rounded object-cover"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            <p className="kicker text-[11px] text-brand">
              {MARKER_LABEL[leader.role]} leader by {leader.statLabel}
            </p>
            <p className="display text-3xl font-bold">
              <Link href={`/players/${leader.playerId}`} className="no-underline hover:underline">
                {leader.name}
              </Link>{" "}
              <span className="text-xl text-muted-foreground">{leader.teamShort}</span>
            </p>
            <p className="text-sm text-muted-foreground">
              {leader.stat} over {leader.games} games, most played {leader.champion}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/players?role=${leader.role}`}
              className="cut-corner bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground no-underline hover:brightness-110"
            >
              All {MARKER_LABEL[leader.role].toLowerCase()} players
            </Link>
            <Link
              href={`/champions?role=${leader.role}`}
              className="cut-corner border bg-background px-4 py-2 text-sm font-semibold no-underline hover:border-brand"
            >
              Champions in this role
            </Link>
          </div>
        </div>
      ) : objective ? (
        <div className="flex flex-wrap items-center gap-4 rounded-md border bg-card p-3 sm:p-4">
          <RoleGlyph
            kind={objective.kind}
            className={cn("size-10", objective.kind === "dragon" ? "text-orange-300" : "text-violet-300")}
          />
          <div className="min-w-0 flex-1">
            <p className="kicker text-[11px] text-brand">{MARKER_LABEL[objective.kind]} control</p>
            <p className="display text-3xl font-bold">
              {objective.teamId ? (
                <Link href={`/teams/${objective.teamId}`} className="no-underline hover:underline">
                  {objective.teamName}
                </Link>
              ) : (
                "No data yet"
              )}
            </p>
            <p className="text-sm text-muted-foreground">
              {objective.stat} {objective.statLabel}
            </p>
          </div>
          <Link
            href="/teams"
            className="cut-corner bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground no-underline hover:brightness-110"
          >
            All teams
          </Link>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          Tap a role on the Rift to see who leads it, or Dragon and Baron for the teams that control them.
        </p>
      )}
    </div>
  );
}
