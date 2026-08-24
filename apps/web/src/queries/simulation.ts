import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { queryKeys } from "./keys";

export type GainLossParam = { group: string; pct: number };
export type TransferParam = { from: string; to: string; pct: number };
export type GroupingParam = { label: string; members: string[] };

export type SimulationChart = {
  labels: string[];
  values: number[];
  colors: string[];
};

export type SimulationSeat = {
  parliament_code: string;
  parliament_name: string;
  election_type: string;
  election_year: string;
  election_state: string;
  total_electorate: number;
  total_ballots: number;
  tov: number;
  election_verdict: {
    menang: {
      group?: string;
      party?: string;
      vote_won?: number;
      majority?: number;
    };
    kalah: Array<{ group: string; party: string; vote_won: number }>;
  };
  parties: Array<{
    group: string;
    party: string;
    vote_won: number;
    sim_vote_won?: number;
    sim_vote_diff?: number;
    gainloss_pct?: number;
  }>;
  simulation?: {
    total_votes: number;
    vote_change: number;
    tov: number;
    menang: {
      group?: string;
      party?: string;
      vote_won?: number;
      majority?: number;
    };
    kalah: Array<{ group: string; party: string; vote_won: number }>;
  };
  simulation_grouped?: {
    menang?: {
      label?: string;
      members?: string[];
      votes?: number;
      majority?: number;
    };
    kalah?: Array<{ label: string; votes: number; members: string[] }>;
  };
  simulation_source?: string;
  individual_sim_name?: string;
};

export type BatchPayload = {
  areaType: "parlimen" | "dun";
  scopeArea: "NEGARA" | "NEGERI" | "PARLIMEN" | "DUN";
  scopeName?: string;
  seatCodes: string[];
  gainloss?: GainLossParam[];
  transfer?: TransferParam[];
  grouping?: GroupingParam | null;
  individualOverrides?: Array<{
    mapCode: string;
    gainloss: GainLossParam[];
    transfer: TransferParam[];
    grouping?: GroupingParam | null;
    simName?: string;
  }>;
};

export type BatchResult = {
  meta: {
    all_parties?: string[];
    partyTotals?: Record<string, number>;
    scopeTitle?: string;
    total_selected_parliament?: number;
  };
  parliament: SimulationSeat[];
  chart: SimulationChart;
  summary?: { asal: SimulationChart; simulasi: SimulationChart };
};

export type SimulationSeatList = {
  areaType: string;
  scopeArea: string;
  scopeName: string | null;
  scopeTitle: string;
  seats: Array<{
    code: string;
    name: string;
    state: string;
    label: string;
    parliamentCode?: string;
  }>;
};

export type SimulationSave = {
  id: string;
  name: string;
  mode: "BATCH" | "INDIVIDUAL";
  area: string;
  areaName: string | null;
  areaType: string;
  mapCode: string | null;
  selectedCodes: string[];
  gainloss: GainLossParam[];
  transfer: TransferParam[];
  grouping: GroupingParam | null;
  partyConfig: Record<string, { party_gov: boolean }>;
  partyChanges: unknown[];
  resultMeta: Record<string, unknown>;
  chart: SimulationChart | null;
  lastActivity: string;
  createdAt: string;
  updatedAt: string;
};

export type PartyConfigEntry = {
  party_name: string;
  party_gov: boolean;
  party_gov_dun: boolean;
  party_color: string;
  effective_gov: boolean;
  overridden: boolean;
};

export function useSimulationSeats(
  areaType: string,
  scopeArea: string,
  scopeName: string,
  enabled = true,
) {
  const q = new URLSearchParams({
    areaType,
    scopeArea,
    ...(scopeName ? { scopeName } : {}),
  });
  return useQuery({
    queryKey: queryKeys.simulation.seats(areaType, scopeArea, scopeName),
    queryFn: () => api<SimulationSeatList>(`/simulation/seats?${q}`),
    enabled,
  });
}

export function useBatchInit() {
  return useMutation({
    mutationFn: (payload: BatchPayload) =>
      api<BatchResult>("/simulation/batch/init", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

export function useBatchRun() {
  return useMutation({
    mutationFn: (payload: BatchPayload) =>
      api<BatchResult>("/simulation/batch/run", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

export function useIndividualInit() {
  return useMutation({
    mutationFn: (payload: { areaType: "parlimen" | "dun"; mapCode: string }) =>
      api<BatchResult & { mapCode: string }>("/simulation/individual/init", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

export function useIndividualRun() {
  return useMutation({
    mutationFn: (payload: {
      areaType: "parlimen" | "dun";
      mapCode: string;
      tovPct?: number;
      gainloss?: GainLossParam[];
      transfer?: TransferParam[];
      grouping?: GroupingParam | null;
    }) =>
      api<BatchResult & { mapCode: string }>("/simulation/individual/run", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

export function useIndividualMatches() {
  return useMutation({
    mutationFn: (payload: {
      areaType: "parlimen" | "dun";
      seatCodes: string[];
    }) =>
      api<{ matches: SimulationSave[] }>("/simulation/individual/matches", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}

export function useIndividualFromBatch() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      areaType: "parlimen" | "dun";
      seats: Array<{ mapCode: string; simName?: string }>;
      gainloss: GainLossParam[];
      transfer: TransferParam[];
      grouping?: GroupingParam | null;
    }) =>
      api<{ saves: SimulationSave[] }>("/simulation/individual/from-batch", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulation", "saves"] });
    },
  });
}

export function useSimulationSaves(mode?: string, mapCode?: string) {
  const q = new URLSearchParams();
  if (mode) q.set("mode", mode);
  if (mapCode) q.set("mapCode", mapCode);
  const qs = q.toString();
  return useQuery({
    queryKey: queryKeys.simulation.saves(mode, mapCode),
    queryFn: () =>
      api<{ saves: SimulationSave[] }>(
        `/simulation/saves${qs ? `?${qs}` : ""}`,
      ),
  });
}

export function useCreateSimulationSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api<{ save: SimulationSave }>("/simulation/saves", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulation", "saves"] });
    },
  });
}

export function useUpdateSimulationSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      ...payload
    }: { id: string } & Record<string, unknown>) =>
      api<{ save: SimulationSave }>(`/simulation/saves/${id}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulation", "saves"] });
    },
  });
}

export function useDeleteSimulationSave() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api<{ ok: boolean }>(`/simulation/saves/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["simulation", "saves"] });
    },
  });
}

export function usePartyConfig(
  areaType: string,
  overrides: Record<string, { party_gov: boolean }>,
) {
  const q = new URLSearchParams({
    areaType,
    overrides: JSON.stringify(overrides),
  });
  return useQuery({
    queryKey: queryKeys.simulation.partyConfig(areaType, overrides),
    queryFn: () =>
      api<{ parties: PartyConfigEntry[] }>(`/simulation/party-config?${q}`),
  });
}

export function useSimulationAi() {
  return useMutation({
    mutationFn: (payload: {
      question: string;
      simulationContext?: Record<string, unknown>;
    }) =>
      api<{ success: boolean; reply: string }>("/simulation/ai/analyze", {
        method: "POST",
        body: JSON.stringify(payload),
      }),
  });
}
