import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { queryKeys } from "@/queries/keys";

export type GlobalSearchSuggestion = {
  value: string;
  label: string;
  id: string;
  type: string;
  totalRecords: number;
  icon: string;
  extras: Record<string, unknown>;
  ic: string;
  member?: string;
  party?: string;
  partyGroup?: string;
  groupLogo?: string;
  partyLogo?: string;
  groupLogoFallback?: string;
  partyLogoFallback?: string;
  hidePartyLogo?: boolean;
  state?: string;
  electoralType?: "parliament" | "dun";
  mapCode?: string;
  photo?: string;
  photoLocal?: string;
  photoFallback?: string;
};

export type GlobalSearchResponse = {
  source: string;
  totalRecords: number;
  suggestions: GlobalSearchSuggestion[];
};

export function formatGlobalSearchCount(n: number): string {
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)} M`;
  }
  if (n >= 1_000) {
    const k = n / 1_000;
    return `${Number.isInteger(k) ? k : k.toFixed(1)} K`;
  }
  return n.toLocaleString("en-MY");
}

export function useGlobalSearchMeta() {
  return useQuery({
    queryKey: queryKeys.globalSearch.meta,
    queryFn: () =>
      api<{ totalRecords: number; source: string }>("/global-search/meta"),
    staleTime: 300_000,
  });
}

export function useGlobalSearchDebounced(q: string, enabled = true) {
  const [debounced, setDebounced] = useState(q);
  const [isDebouncing, setIsDebouncing] = useState(false);

  useEffect(() => {
    setIsDebouncing(true);
    const id = window.setTimeout(() => {
      setDebounced(q);
      setIsDebouncing(false);
    }, 1000);
    return () => window.clearTimeout(id);
  }, [q]);

  const query = useQuery({
    queryKey: queryKeys.globalSearch.search(debounced),
    queryFn: () =>
      api<GlobalSearchResponse>(
        `/global-search?q=${encodeURIComponent(debounced)}&limit=50`,
      ),
    enabled: enabled && debounced.trim().length > 0,
    staleTime: 30_000,
  });

  return { ...query, isDebouncing };
}
