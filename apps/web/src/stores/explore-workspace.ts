import { create } from "zustand";

export type MapToolMode = "select" | "pan" | "compare";
export type MapLevel = "parliament" | "dun";
export type Presentation = "normal" | "ops66";
export type ColorMode = "party" | "group";
export type MajorityMode = "kurang" | "lebih" | null;

export type MapFilters = {
  state: string;
  majority: { value: string; mode: MajorityMode };
  turnout: string;
  group: string;
  party: string;
  government: string;
};

export type SeatSearchHit = {
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
  partyLogo: string;
  groupLogo: string;
  partyLogoFallback: string;
  groupLogoFallback: string;
  hidePartyLogo: boolean;
};

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

export const emptyFilters = (): MapFilters => ({
  state: "",
  majority: { value: "0", mode: null },
  turnout: "0",
  group: "0",
  party: "0",
  government: "0",
});

type ExploreWorkspaceState = {
  selectedConstituencyId: string | null;
  selectedElectoralType: "parliament" | "dun" | null;
  mapMode: MapToolMode;
  mapLevel: MapLevel;
  presentation: Presentation;
  colorMode: ColorMode;
  filters: MapFilters;
  searchSelection: SeatSearchHit | null;
  senaraiOpen: boolean;
  inventoryOpen: boolean;
  ops66DialogOpen: boolean;
  compareIds: string[];
  /** @deprecated use filters.state — kept for URL/saved-view compat */
  appliedState: string;
  draftStateFilter: string;
  setSelectedConstituencyId: (id: string | null) => void;
  setSelectedElectoralType: (t: "parliament" | "dun" | null) => void;
  setMapMode: (mode: MapToolMode) => void;
  setMapLevel: (level: MapLevel) => void;
  setPresentation: (p: Presentation) => void;
  setColorMode: (mode: ColorMode) => void;
  setFilters: (filters: Partial<MapFilters>) => void;
  setFilterField: <K extends keyof MapFilters>(
    key: K,
    value: MapFilters[K],
  ) => void;
  resetNonStateFilters: () => void;
  resetAllFilters: () => void;
  setSearchSelection: (hit: SeatSearchHit | null) => void;
  clearSearch: () => void;
  setSenaraiOpen: (open: boolean) => void;
  setInventoryOpen: (open: boolean) => void;
  setOps66DialogOpen: (open: boolean) => void;
  setAppliedState: (value: string) => void;
  setDraftStateFilter: (value: string) => void;
  setCompareIds: (ids: string[]) => void;
  toggleCompareId: (id: string) => void;
  clearCompare: () => void;
  applyViewConfig: (config: {
    state?: string;
    selectedConstituencyId?: string | null;
    selectedElectoralType?: "parliament" | "dun" | null;
    mapMode?: MapToolMode;
    mapLevel?: MapLevel;
    presentation?: Presentation;
    colorMode?: ColorMode;
    filters?: Partial<MapFilters>;
    compareIds?: string[];
  }) => void;
};

export const useExploreWorkspaceStore = create<ExploreWorkspaceState>(
  (set) => ({
    selectedConstituencyId: null,
    selectedElectoralType: null,
    mapMode: "select",
    mapLevel: "parliament",
    presentation: "normal",
    colorMode: "party",
    filters: emptyFilters(),
    searchSelection: null,
    senaraiOpen: false,
    inventoryOpen: false,
    ops66DialogOpen: false,
    compareIds: [],
    appliedState: "",
    draftStateFilter: "",
    setSelectedConstituencyId: (id) => set({ selectedConstituencyId: id }),
    setSelectedElectoralType: (t) => set({ selectedElectoralType: t }),
    setMapMode: (mode) => set({ mapMode: mode }),
    setMapLevel: (level) =>
      set((s) => ({
        mapLevel: level,
        filters: {
          ...emptyFilters(),
          state: s.filters.state,
        },
        appliedState:
          !s.filters.state || s.filters.state === "0" ? "" : s.filters.state,
      })),
    setPresentation: (p) =>
      set((s) => ({
        presentation: p,
        filters: emptyFilters(),
        appliedState: "",
        searchSelection: null,
        mapLevel: p === "ops66" ? "parliament" : s.mapLevel,
      })),
    setColorMode: (mode) => set({ colorMode: mode }),
    setFilters: (partial) =>
      set((s) => {
        const filters = { ...s.filters, ...partial };
        return {
          filters,
          appliedState:
            !filters.state || filters.state === "0" ? "" : filters.state,
        };
      }),
    setFilterField: (key, value) =>
      set((s) => {
        const filters = { ...s.filters, [key]: value };
        return {
          filters,
          appliedState:
            !filters.state || filters.state === "0" ? "" : filters.state,
        };
      }),
    resetNonStateFilters: () =>
      set((s) => ({
        filters: {
          ...emptyFilters(),
          state: s.filters.state,
        },
      })),
    resetAllFilters: () =>
      set({
        filters: emptyFilters(),
        appliedState: "",
        searchSelection: null,
      }),
    setSearchSelection: (hit) =>
      set({
        searchSelection: hit,
        selectedConstituencyId: hit?.code ?? null,
        selectedElectoralType: hit?.electoralType ?? null,
      }),
    clearSearch: () =>
      set({
        searchSelection: null,
      }),
    setSenaraiOpen: (open) => set({ senaraiOpen: open }),
    setInventoryOpen: (open) => set({ inventoryOpen: open }),
    setOps66DialogOpen: (open) => set({ ops66DialogOpen: open }),
    setAppliedState: (value) =>
      set((s) => ({
        appliedState: value,
        filters: {
          ...s.filters,
          state: value || "0",
        },
      })),
    setDraftStateFilter: (value) => set({ draftStateFilter: value }),
    setCompareIds: (ids) => set({ compareIds: ids.slice(0, 4) }),
    toggleCompareId: (id) =>
      set((s) => ({
        compareIds: s.compareIds.includes(id)
          ? s.compareIds.filter((x) => x !== id)
          : [...s.compareIds, id].slice(0, 4),
      })),
    clearCompare: () => set({ compareIds: [] }),
    applyViewConfig: (config) =>
      set((s) => {
        const filters = {
          ...emptyFilters(),
          ...(config.filters || {}),
          state: config.state || config.filters?.state || "",
        };
        return {
          appliedState: config.state || "",
          selectedConstituencyId: config.selectedConstituencyId ?? null,
          selectedElectoralType: config.selectedElectoralType ?? null,
          mapMode: config.mapMode || "select",
          mapLevel: config.mapLevel || s.mapLevel,
          presentation: config.presentation || s.presentation,
          colorMode: config.colorMode || s.colorMode,
          filters,
          compareIds: (config.compareIds || []).slice(0, 4),
          searchSelection: null,
        };
      }),
  }),
);
