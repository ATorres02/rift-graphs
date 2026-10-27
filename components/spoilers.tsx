"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { EyeIcon, EyeOffIcon } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export const SPOILER_STORAGE_KEY = "rl-spoilers";

/** Runs before paint so a visitor with spoilers hidden never sees a result flash. */
export const SPOILER_INIT_SCRIPT = `(function(){try{if(localStorage.getItem("${SPOILER_STORAGE_KEY}")==="hidden"){document.documentElement.dataset.spoilers="hidden"}}catch(e){}})();`;

type Mode = "unknown" | "hidden" | "shown";

const SpoilerContext = createContext<{ mode: Mode; setHidden: (hidden: boolean) => void }>({
  mode: "unknown",
  setHidden: () => {},
});

export function SpoilerProvider({ children }: { children: ReactNode }) {
  const [mode, setMode] = useState<Mode>("unknown");

  useEffect(() => {
    setMode(document.documentElement.dataset.spoilers === "hidden" ? "hidden" : "shown");
  }, []);

  const setHidden = useCallback((hidden: boolean) => {
    const next: Mode = hidden ? "hidden" : "shown";
    setMode(next);
    document.documentElement.dataset.spoilers = next;
    try {
      localStorage.setItem(SPOILER_STORAGE_KEY, next);
    } catch {
      /* storage unavailable: the choice lasts for this page only */
    }
  }, []);

  return <SpoilerContext.Provider value={{ mode, setHidden }}>{children}</SpoilerContext.Provider>;
}

export function useSpoilers() {
  return useContext(SpoilerContext);
}

export function SpoilerToggle({ className }: { className?: string }) {
  const { mode, setHidden } = useSpoilers();
  const hidden = mode === "hidden";
  return (
    <label className={cn("flex cursor-pointer items-center gap-2 text-sm text-muted-foreground", className)}>
      {hidden ? <EyeOffIcon className="size-4" aria-hidden /> : <EyeIcon className="size-4" aria-hidden />}
      <span className="hidden sm:inline">Hide results</span>
      <Switch checked={hidden} onCheckedChange={(checked) => setHidden(Boolean(checked))} aria-label="Hide results (spoiler mode)" />
    </label>
  );
}

interface SpoilerProps {
  children: ReactNode;
  /** Text on the reveal button. */
  label?: string;
  className?: string;
  as?: "span" | "div";
}

/**
 * Wraps a score, winner or anything that spoils a result. Hidden content is
 * replaced by a reveal button while spoiler mode is on.
 */
export function Spoiler({ children, label = "Reveal", className, as = "span" }: SpoilerProps) {
  const { mode } = useSpoilers();
  const [revealed, setRevealed] = useState(false);
  const Tag = as;

  if (mode === "hidden" && !revealed) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setRevealed(true);
        }}
        className={cn(
          "inline-flex items-center gap-1 rounded-md border border-dashed border-border px-2 py-0.5 text-xs font-medium text-muted-foreground transition-colors hover:border-brand hover:text-foreground",
          className,
        )}
      >
        <EyeOffIcon className="size-3.5" aria-hidden />
        {label}
      </button>
    );
  }
  return <Tag className={cn(mode === "unknown" && "spoiler-blur", className)}>{children}</Tag>;
}
