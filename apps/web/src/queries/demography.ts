import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";
import type { RingkasanArea } from "@/features/explore/lib/ringkasan-scope";

export type DemographyArea = RingkasanArea | "DM";

export type DemographyScope = {
  area: DemographyArea;
  value: string;
};

export type DemographySegment = {
  key: string;
  label: string;
  count: number;
  percent: number;
  roundedPercent: number;
  color: string;
};

export type DemographySummary = {
  area: DemographyArea;
  areaValue: string | null;
  areaLabel: string;
  totalVoters: number;
  childArea: string;
  childAreaLabel: string;
  tableTitle: string;
  segments: {
    race: DemographySegment[];
    age: DemographySegment[];
    gender: DemographySegment[];
  };
  malayMajority: number;
  nonMalayMajority: number;
  parent: {
    area: DemographyArea;
    value: string;
    label: string;
  } | null;
};

export type DemographyTableRow = {
  area: string;
  code: string;
  name: string;
  parentState: string | null;
  parentParliamentCode: string | null;
  parentParliamentName: string | null;
  parentDunCode: string | null;
  parentDunName: string | null;
  parentDmCode: string | null;
  parentDmName: string | null;
  total: number;
  malayMajority: boolean;
  partyName: string | null;
  race: {
    malay: number;
    chinese: number;
    indian: number;
    bumiSabah: number;
    bumiSarawak: number;
    others: number;
  };
  age: {
    age18_25: number;
    age26_40: number;
    age41_60: number;
    age61Above: number;
  };
  gender: {
    male: number;
    female: number;
  };
  party: {
    pkr: number;
    umno: number;
    ppbm: number;
    pas: number;
  };
  sikap: {
    putih: number;
    kelabu: number;
    hitam: number;
  };
};

export type DemographyTableResult = {
  parentArea: DemographyArea;
  parentValue: string;
  childArea: string;
  childAreaLabel: string;
  tableTitle: string;
  rows: DemographyTableRow[];
  totals: DemographyTableRow | null;
  malayMajority: number;
  nonMalayMajority: number;
};

export type VoterListFilter = {
  filterKind?: "race" | "age" | "gender" | "party" | "sikap";
  filterKey?: string;
};

export type VoterListRow = {
  registerId: number;
  ic: string;
  nama: string;
  jantina: string;
  bangsa: string;
  agama: string;
  age: number;
  negeri: string;
  parlimen: string;
  dun: string;
  dm: string;
  lokaliti: string;
  sikap: string;
  parti: string;
};

export type VoterListResult = {
  total: number;
  rows: VoterListRow[];
};

export function demographyMatchesScope(
  data: { area?: string; areaValue?: string | null } | undefined,
  scope: DemographyScope,
): boolean {
  if (!data?.area) return false;
  return (
    data.area === scope.area &&
    (data.areaValue || "").toUpperCase() === (scope.value || "").toUpperCase()
  );
}

function demographyParams(scope: DemographyScope) {
  const params = new URLSearchParams();
  params.set("area", scope.area);
  if (scope.value) params.set("value", scope.value);
  return params;
}

function tableParams(scope: DemographyScope) {
  const params = new URLSearchParams();
  params.set("parent", scope.area);
  if (scope.value) params.set("view", scope.value);
  return params;
}

export function useDemographySummary(scope: DemographyScope) {
  return useQuery({
    queryKey: queryKeys.explore.demographySummary({
      area: scope.area,
      value: scope.value,
    }),
    queryFn: () =>
      api<DemographySummary>(
        `/explore/demography/summary?${demographyParams(scope)}`,
      ),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
}

export function useDemographyTable(scope: DemographyScope, enabled = true) {
  return useQuery({
    queryKey: queryKeys.explore.demographyTable({
      parent: scope.area,
      view: scope.value,
    }),
    queryFn: () =>
      api<DemographyTableResult>(
        `/explore/demography/table?${tableParams(scope)}`,
      ),
    staleTime: 60_000,
    enabled,
    placeholderData: keepPreviousData,
  });
}

export type VoterListQuery = {
  areaType: DemographyArea | "LOKALITI";
  areaCode?: string;
  areaName?: string;
  filterKind?: VoterListFilter["filterKind"];
  filterKey?: string;
  q?: string;
  jantina?: string;
  bangsa?: string;
  negeri?: string;
  limit?: number;
  offset?: number;
};

export type VoterListArea = Pick<
  VoterListQuery,
  "areaType" | "areaCode" | "areaName"
>;

export type VoterListExportResult = {
  total: number;
  rows: VoterListRow[];
  truncated: boolean;
};

function appendVoterListParams(params: URLSearchParams, query: VoterListQuery) {
  params.set("areaType", query.areaType);
  if (query.areaCode) params.set("areaCode", query.areaCode);
  if (query.areaName) params.set("areaName", query.areaName);
  if (query.filterKind) params.set("filterKind", query.filterKind);
  if (query.filterKey) params.set("filterKey", query.filterKey);
  if (query.q) params.set("q", query.q);
  if (query.jantina) params.set("jantina", query.jantina);
  if (query.bangsa) params.set("bangsa", query.bangsa);
  if (query.negeri) params.set("negeri", query.negeri);
  if (query.limit != null) params.set("limit", String(query.limit));
  if (query.offset != null) params.set("offset", String(query.offset));
}

export function useVoterList(query: VoterListQuery | null) {
  return useQuery({
    queryKey: queryKeys.explore.voterList(
      query
        ? {
            areaType: query.areaType,
            areaCode: query.areaCode,
            areaName: query.areaName,
            filterKind: query.filterKind,
            filterKey: query.filterKey,
            q: query.q,
            jantina: query.jantina,
            bangsa: query.bangsa,
            negeri: query.negeri,
            limit: query.limit,
            offset: query.offset,
          }
        : { disabled: "1" },
    ),
    queryFn: () => {
      if (!query) throw new Error("No query");
      const params = new URLSearchParams();
      appendVoterListParams(params, {
        ...query,
        limit: query.limit ?? 25,
        offset: query.offset ?? 0,
      });
      return api<VoterListResult>(`/explore/voters?${params}`);
    },
    enabled: Boolean(query),
    staleTime: 30_000,
  });
}

export async function fetchVoterListExport(
  query: Omit<VoterListQuery, "limit" | "offset">,
) {
  const params = new URLSearchParams();
  appendVoterListParams(params, query);
  return api<VoterListExportResult>(`/explore/voters/export?${params}`);
}
