"use client";

import { useEffect, useState } from "react";
import { indexDataset, type IndexedDataset } from "./index";
import type { Dataset } from "./types";

let cached: Promise<IndexedDataset> | null = null;

/** Fetches `/api/dataset` once per page load and indexes it in memory (about 65 KB over the wire). */
export function loadDatasetInBrowser(version: string): Promise<IndexedDataset> {
  if (!cached) {
    cached = fetch(`/api/dataset?v=${encodeURIComponent(version)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`Dataset request failed with HTTP ${res.status}`);
        return res.json() as Promise<Dataset>;
      })
      .then(indexDataset)
      .catch((err: unknown) => {
        cached = null;
        throw err;
      });
  }
  return cached;
}

export function useDataset(version: string): { data: IndexedDataset | null; error: string | null } {
  const [data, setData] = useState<IndexedDataset | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    loadDatasetInBrowser(version)
      .then((d) => active && setData(d))
      .catch((e: unknown) => active && setError(e instanceof Error ? e.message : String(e)));
    return () => {
      active = false;
    };
  }, [version]);
  return { data, error };
}
