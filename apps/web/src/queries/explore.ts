import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";
import type {
  MapFilters,
  MapLevel,
  Presentation,
} from "@/stores/explore-workspace";

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
  level?: string;
  presentation?: string;
  state: string | null;
  kpis: ExploreKpi[];
  partySeats: PartySeat[];
};

export type ExploreState = { name: string; seats: number };

export type GeoFeatureProperties = {
  code: string;
  name: string;
  state: string;
  party: string;
  partyGroup: string;
  partyColor: string;
  groupColor: string;
  color: string;
  member: string;
  electorate: number;
  turnout: number;
  majorityPercent: number;
  majority: number;
  government: string;
  electoralType: "parliament" | "dun";
};

export type GeoFeatureCollection = {
  type: "FeatureCollection";
  kind: "points" | "polygons";
  election: string;
  level?: string;
  presentation?: string;
  state: string | null;
  features: Array<{
    type: "Feature";
    geometry: GeoJSON.Geometry;
    properties: GeoFeatureProperties;
  }>;
};

export type SeatDetail = {
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
  electoralType: "parliament" | "dun";
  parliamentCode?: string;
  displayCode: string;
  displayParty: string;
  memberPhoto: string;
  memberPhotoFallback: string;
  partyLogo: string;
  groupLogo: string;
  partyLogoFallback: string;
  groupLogoFallback: string;
  hidePartyLogo: boolean;
};

export type ParliamentDetail = SeatDetail;

export type FilterOptions = {
  level: string;
  presentation: string;
  states: string[];
  groups: string[];
  parties: string[];
};

export type SearchOption = {
  code: string;
  mapCode: string;
  name: string;
  electoralType: "parliament" | "dun";
  state: string;
  member: string;
  party: string;
  partyGroup: string;
  color: string;
  display: string;
  parliamentCode?: string;
};

export type SeatListRow = {
  mapCode: string;
  member: string;
  partyGroup: string;
  party: string;
  seatLabel: string;
  voters: number;
  government: string;
  state: string;
  year: string;
  majority: number;
  majorityPercent: number;
  turnout: number;
  parliamentCode?: string;
};

function qs(params: Record<string, string | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== "") sp.set(k, v);
  }
  const s = sp.toString();
  return s ? `?${s}` : "";
}

export function useExploreSummary(opts: {
  state: string;
  level: MapLevel;
  presentation: Presentation;
}) {
  return useQuery({
    queryKey: queryKeys.explore.summaryKey(opts),
    queryFn: () =>
      api<ExploreSummary>(
        `/explore/summary${qs({
          state: opts.state,
          level: opts.level,
          presentation: opts.presentation,
        })}`,
      ),
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
}

export function useExploreStates(
  level: MapLevel,
  presentation: Presentation,
) {
  return useQuery({
    queryKey: queryKeys.explore.statesKey(level, presentation),
    queryFn: () =>
      api<{ states: ExploreState[] }>(
        `/explore/states${qs({ level, presentation })}`,
      ).then((r) => r.states),
    staleTime: 60_000,
  });
}

export function useExploreGeo(opts: {
  state: string;
  level: MapLevel;
  presentation: Presentation;
  /** When false, return center points only (faster national overview). */
  polygons?: boolean;
}) {
  const polygons = opts.polygons !== false;
  return useQuery({
    queryKey: queryKeys.explore.geoKey({ ...opts, polygons }),
    queryFn: () =>
      api<GeoFeatureCollection>(
        `/explore/geo${qs({
          state: opts.state,
          level: opts.level,
          presentation: opts.presentation,
          polygons: polygons ? "1" : "0",
        })}`,
      ),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useFilterOptions(
  level: MapLevel,
  presentation: Presentation,
) {
  return useQuery({
    queryKey: queryKeys.explore.filterOptions(level, presentation),
    queryFn: () =>
      api<FilterOptions>(
        `/explore/filter-options${qs({ level, presentation })}`,
      ),
    staleTime: 120_000,
  });
}

export function useSeatSearch(q: string, presentation: Presentation) {
  return useQuery({
    queryKey: queryKeys.explore.search(q, presentation),
    queryFn: () =>
      api<{
        groups: Array<{ state: string; options: SearchOption[] }>;
        total: number;
      }>(`/explore/search${qs({ q, presentation })}`),
    staleTime: 30_000,
  });
}

export function useSeatList(
  enabled: boolean,
  opts: {
    level: MapLevel;
    presentation: Presentation;
    filters: MapFilters;
  },
) {
  const f = opts.filters;
  const params = {
    level: opts.level,
    presentation: opts.presentation,
    state: f.state && f.state !== "0" ? f.state : "",
    majority: f.majority.value !== "0" ? f.majority.value : "",
    majorityMode: f.majority.mode || "",
    turnout: f.turnout !== "0" ? f.turnout : "",
    group: f.group !== "0" ? f.group : "",
    party: f.party !== "0" ? f.party : "",
    government: f.government !== "0" ? f.government : "",
  };
  return useQuery({
    queryKey: queryKeys.explore.seats(params),
    queryFn: () =>
      api<{ columns: string[]; rows: SeatListRow[] }>(
        `/explore/seats${qs(params)}`,
      ),
    enabled,
    staleTime: 15_000,
  });
}

export function useParliamentDetail(
  code: string | null,
  presentation: Presentation = "normal",
) {
  return useQuery({
    queryKey: queryKeys.explore.parliamentKey(code || "", presentation),
    queryFn: () =>
      api<{ parliament: SeatDetail }>(
        `/explore/parliaments/${encodeURIComponent(code!)}${qs({ presentation })}`,
      ).then((r) => r.parliament),
    enabled: Boolean(code),
    staleTime: 60_000,
  });
}

export function useDunDetail(
  code: string | null,
  presentation: Presentation = "normal",
) {
  return useQuery({
    queryKey: queryKeys.explore.dun(code || "", presentation),
    queryFn: () =>
      api<{ dun: SeatDetail }>(
        `/explore/duns/${encodeURIComponent(code!)}${qs({ presentation })}`,
      ).then((r) => r.dun),
    enabled: Boolean(code),
    staleTime: 60_000,
  });
}

export function useSeatDetail(
  code: string | null,
  electoralType: "parliament" | "dun" | null,
  presentation: Presentation,
) {
  const isDun = electoralType === "dun";
  const par = useParliamentDetail(isDun ? null : code, presentation);
  const dun = useDunDetail(isDun ? code : null, presentation);
  if (isDun) return dun;
  return par;
}

export async function verifyOps66Password(password: string) {
  return api<{ ok: boolean }>("/explore/ops66/verify", {
    method: "POST",
    body: JSON.stringify({ password }),
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
