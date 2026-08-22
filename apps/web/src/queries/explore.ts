import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";

export type ExploreKpi = {
  id: string;
  label: string;
  value: string | number;
  hint: string;
};

export type PartySeat = {
  party: string;
  color: string;
  seats: number;
};

export type ExploreSummary = {
  source: string;
  mode: string;
  election: string;
  state: string | null;
  kpis: ExploreKpi[];
  partySeats: PartySeat[];
};

export type ExploreState = { name: string; seats: number };

export type GeoFeatureCollection = {
  type: "FeatureCollection";
  kind: "points" | "polygons";
  election: string;
  state: string | null;
  features: Array<{
    type: "Feature";
    geometry: GeoJSON.Geometry;
    properties: {
      code: string;
      name: string;
      state: string;
      party: string;
      color: string;
      member: string;
      electorate: number;
      turnout: number;
    };
  }>;
};

export type ParliamentDetail = {
  code: string;
  name: string;
  state: string;
  party: string;
  partyGroup: string;
  color: string;
  member: string;
  electorate: number;
  ballots: number;
  validVotes: number;
  turnout: number;
  majority: number;
  majorityPercent: number;
  lat: number;
  lng: number;
};

export function useExploreSummary(state: string) {
  return useQuery({
    queryKey: queryKeys.explore.summaryByState(state),
    queryFn: () => {
      const q = state ? `?state=${encodeURIComponent(state)}` : "";
      return api<ExploreSummary>(`/explore/summary${q}`);
    },
    staleTime: 30_000,
  });
}

export function useExploreStates() {
  return useQuery({
    queryKey: queryKeys.explore.states,
    queryFn: () =>
      api<{ states: ExploreState[] }>("/explore/states").then((r) => r.states),
    staleTime: 60_000,
  });
}

export function useExploreGeo(state: string) {
  return useQuery({
    queryKey: queryKeys.explore.geo(state),
    queryFn: () => {
      const q = state ? `?state=${encodeURIComponent(state)}` : "";
      return api<GeoFeatureCollection>(`/explore/geo${q}`);
    },
    staleTime: 60_000,
  });
}

export function useParliamentDetail(code: string | null) {
  return useQuery({
    queryKey: queryKeys.explore.parliament(code || ""),
    queryFn: () =>
      api<{ parliament: ParliamentDetail }>(
        `/explore/parliaments/${encodeURIComponent(code!)}`,
      ).then((r) => r.parliament),
    enabled: Boolean(code),
    staleTime: 60_000,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: queryKeys.health,
    queryFn: () =>
      api<{
        ok: boolean;
        systemDb: { ok: boolean; name: string };
        knowledgeDb: { ok: boolean; name: string | null; mode: string };
      }>("/health"),
    staleTime: 15_000,
  });
}
