import { create } from "zustand";
import { scopeAreaLabel } from "@/features/explore/lib/ringkasan-scope";
import type {
  GainLossParam,
  GroupingParam,
  SimulationChart,
  SimulationSeat,
  TransferParam,
} from "@/queries/simulation";

/** Product view: batch = Manual (NEGARA/NEGERI), individual = Auto (single seat). */
export type SimulationView = "batch" | "individual";
export type SimulationAreaType = "parlimen" | "dun";
export type SimulationScopeArea = "NEGARA" | "NEGERI" | "PARLIMEN" | "DUN";

export type SimulationSeatOption = {
  code: string;
  name: string;
  state: string;
  label: string;
  parliamentCode?: string;
};

export type PartyConfigOverride = Record<string, { party_gov: boolean }>;

type SimulationWorkspaceState = {
  view: SimulationView;
  areaType: SimulationAreaType;
  scopeArea: SimulationScopeArea;
  scopeName: string;
  scopeTitle: string;
  /** Single-seat map code for individual (Auto) view */
  mapCode: string;
  availableSeats: SimulationSeatOption[];
  selectedSeatCodes: string[];
  selectionSignature: string;
  lastInitSignature: string;
  gainloss: GainLossParam[];
  transfer: TransferParam[];
  grouping: GroupingParam | null;
  tovPct: number;
  partyConfig: PartyConfigOverride;
  partyTotals: Record<string, number>;
  allParties: string[];
  seats: SimulationSeat[];
  chart: SimulationChart | null;
  summary: { asal: SimulationChart; simulasi: SimulationChart } | null;
  loadedSaveId: string | null;
  loadedSaveName: string;
  aiQuestion: string;
  aiReply: string;
  setView: (view: SimulationView) => void;
  setAreaType: (t: SimulationAreaType) => void;
  setScope: (area: SimulationScopeArea, name: string, title?: string) => void;
  setMapCode: (code: string) => void;
  openBatch: (opts?: {
    areaType?: SimulationAreaType;
    scopeArea?: SimulationScopeArea;
    scopeName?: string;
  }) => void;
  openIndividual: (opts: {
    mapCode: string;
    areaType?: SimulationAreaType;
    scopeName?: string;
  }) => void;
  setAvailableSeats: (seats: SimulationSeatOption[]) => void;
  setSelectedSeatCodes: (codes: string[]) => void;
  markInitSignature: (signature: string) => void;
  setParameters: (p: {
    gainloss?: GainLossParam[];
    transfer?: TransferParam[];
    grouping?: GroupingParam | null;
    tovPct?: number;
  }) => void;
  setPartyConfig: (config: PartyConfigOverride) => void;
  applyResult: (data: {
    seats: SimulationSeat[];
    chart: SimulationChart;
    summary?: { asal: SimulationChart; simulasi: SimulationChart };
    meta?: {
      all_parties?: string[];
      partyTotals?: Record<string, number>;
      scopeTitle?: string;
    };
  }) => void;
  setLoadedSave: (id: string | null, name?: string) => void;
  setAi: (question: string, reply: string) => void;
  resetWorkspace: () => void;
};

const initialState = {
  view: "batch" as SimulationView,
  areaType: "parlimen" as SimulationAreaType,
  scopeArea: "NEGARA" as SimulationScopeArea,
  scopeName: "",
  scopeTitle: "SELURUH MALAYSIA",
  mapCode: "",
  availableSeats: [] as SimulationSeatOption[],
  selectedSeatCodes: [] as string[],
  selectionSignature: "",
  lastInitSignature: "",
  gainloss: [] as GainLossParam[],
  transfer: [] as TransferParam[],
  grouping: null as GroupingParam | null,
  tovPct: 0,
  partyConfig: {} as PartyConfigOverride,
  partyTotals: {} as Record<string, number>,
  allParties: [] as string[],
  seats: [] as SimulationSeat[],
  chart: null as SimulationChart | null,
  summary: null as { asal: SimulationChart; simulasi: SimulationChart } | null,
  loadedSaveId: null as string | null,
  loadedSaveName: "",
  aiQuestion: "",
  aiReply: "",
};

export function buildSelectionSignature(codes: string[]): string {
  return [...codes].sort().join("|");
}

export const useSimulationWorkspaceStore = create<SimulationWorkspaceState>(
  (set, get) => ({
    ...initialState,
    setView: (view) => set({ view }),
    setAreaType: (t) =>
      set({
        areaType: t,
        selectedSeatCodes: [],
        selectionSignature: "",
        lastInitSignature: "",
        seats: [],
        chart: null,
        summary: null,
      }),
    setScope: (area, name, title) =>
      set({
        scopeArea: area,
        scopeName: name,
        scopeTitle:
          title ||
          (name ? `SELURUH NEGERI ${name.toUpperCase()}` : "SELURUH MALAYSIA"),
      }),
    setMapCode: (code) => set({ mapCode: code }),
    openBatch: (opts) => {
      const scopeArea =
        opts?.scopeArea ?? (opts?.scopeName ? "NEGERI" : "NEGARA");
      const scopeName = opts?.scopeName ?? "";
      return set({
        view: "batch",
        mapCode: "",
        areaType: opts?.areaType ?? get().areaType,
        scopeArea,
        scopeName,
        scopeTitle: scopeAreaLabel({ area: scopeArea, value: scopeName }),
        selectedSeatCodes: [],
        selectionSignature: "",
        lastInitSignature: "",
        gainloss: [],
        transfer: [],
        grouping: null,
        seats: [],
        chart: null,
        summary: null,
        loadedSaveId: null,
        loadedSaveName: "",
      });
    },
    openIndividual: (opts) => {
      const areaType = opts.areaType ?? get().areaType;
      const scopeArea = areaType === "dun" ? "DUN" : "PARLIMEN";
      return set({
        view: "individual",
        mapCode: opts.mapCode,
        areaType,
        scopeArea,
        scopeName: opts.scopeName ?? "",
        scopeTitle: scopeAreaLabel({ area: scopeArea, value: opts.mapCode }),
        selectedSeatCodes: [opts.mapCode],
        selectionSignature: buildSelectionSignature([opts.mapCode]),
        lastInitSignature: "",
        gainloss: [],
        transfer: [],
        grouping: null,
        tovPct: 0,
        seats: [],
        chart: null,
        summary: null,
        loadedSaveId: null,
        loadedSaveName: "",
      });
    },
    setAvailableSeats: (seats) => set({ availableSeats: seats }),
    setSelectedSeatCodes: (codes) =>
      set({
        selectedSeatCodes: codes,
        selectionSignature: buildSelectionSignature(codes),
      }),
    markInitSignature: (signature) => set({ lastInitSignature: signature }),
    setParameters: (p) =>
      set((s) => ({
        gainloss: p.gainloss ?? s.gainloss,
        transfer: p.transfer ?? s.transfer,
        grouping: p.grouping !== undefined ? p.grouping : s.grouping,
        tovPct: p.tovPct !== undefined ? p.tovPct : s.tovPct,
      })),
    setPartyConfig: (config) => set({ partyConfig: config }),
    applyResult: (data) =>
      set({
        seats: data.seats,
        chart: data.chart,
        summary: data.summary ?? null,
        allParties: data.meta?.all_parties ?? get().allParties,
        partyTotals: data.meta?.partyTotals ?? get().partyTotals,
        scopeTitle: data.meta?.scopeTitle ?? get().scopeTitle,
      }),
    setLoadedSave: (id, name) =>
      set({ loadedSaveId: id, loadedSaveName: name ?? "" }),
    setAi: (question, reply) => set({ aiQuestion: question, aiReply: reply }),
    resetWorkspace: () => set({ ...initialState }),
  }),
);
