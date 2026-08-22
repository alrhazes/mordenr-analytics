import { create } from "zustand";

export type MapToolMode = "select" | "pan" | "compare";

type ExploreWorkspaceState = {
  selectedConstituencyId: string | null;
  mapMode: MapToolMode;
  appliedState: string;
  draftStateFilter: string;
  compareIds: string[];
  setSelectedConstituencyId: (id: string | null) => void;
  setMapMode: (mode: MapToolMode) => void;
  setAppliedState: (value: string) => void;
  setDraftStateFilter: (value: string) => void;
  setCompareIds: (ids: string[]) => void;
  toggleCompareId: (id: string) => void;
  clearCompare: () => void;
  applyViewConfig: (config: {
    state?: string;
    selectedConstituencyId?: string | null;
    mapMode?: MapToolMode;
    compareIds?: string[];
  }) => void;
};

export const useExploreWorkspaceStore = create<ExploreWorkspaceState>(
  (set) => ({
    selectedConstituencyId: null,
    mapMode: "select",
    appliedState: "",
    draftStateFilter: "",
    compareIds: [],
    setSelectedConstituencyId: (id) => set({ selectedConstituencyId: id }),
    setMapMode: (mode) => set({ mapMode: mode }),
    setAppliedState: (value) => set({ appliedState: value }),
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
      set({
        appliedState: config.state || "",
        selectedConstituencyId: config.selectedConstituencyId ?? null,
        mapMode: config.mapMode || "select",
        compareIds: (config.compareIds || []).slice(0, 4),
      }),
  }),
);
