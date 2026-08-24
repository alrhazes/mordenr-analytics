export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  health: ["health"] as const,
  explore: {
    summary: ["explore", "summary"] as const,
    summaryKey: (opts: {
      state: string;
      area: string;
      value: string;
      level: string;
      presentation: string;
    }) =>
      [
        "explore",
        "summary",
        opts.level,
        opts.presentation,
        opts.area,
        opts.value || opts.state || "all",
      ] as const,
    states: ["explore", "states"] as const,
    statesKey: (level: string, presentation: string) =>
      ["explore", "states", level, presentation] as const,
    geo: (state: string) => ["explore", "geo", state || "all"] as const,
    geoKey: (opts: {
      state: string;
      level: string;
      presentation: string;
      polygons: boolean;
    }) =>
      [
        "explore",
        "geo",
        opts.level,
        opts.presentation,
        opts.state || "all",
        opts.polygons ? "poly" : "pts",
      ] as const,
    filterOptions: (level: string, presentation: string) =>
      ["explore", "filter-options", level, presentation] as const,
    search: (q: string, presentation: string) =>
      ["explore", "search", presentation, q] as const,
    seats: (opts: Record<string, string>) =>
      ["explore", "seats", opts] as const,
    parliament: (code: string) => ["explore", "parliament", code] as const,
    parliamentKey: (code: string, presentation: string) =>
      ["explore", "parliament", presentation, code] as const,
    dun: (code: string, presentation: string) =>
      ["explore", "dun", presentation, code] as const,
    voter: (ic: string) => ["explore", "voter", ic] as const,
    demographySummary: (opts: { area: string; value: string }) =>
      ["explore", "demography", "summary", opts.area, opts.value || "all"] as const,
    demographyTable: (opts: { parent: string; view: string }) =>
      ["explore", "demography", "table", opts.parent, opts.view || "all"] as const,
    voterList: (opts: Record<string, string | number | undefined>) =>
      ["explore", "voters", opts] as const,
    kpis: (filters: Record<string, string>) =>
      ["explore", "kpis", filters] as const,
  },
  library: {
    views: ["library", "views"] as const,
    view: (id: string) => ["library", "view", id] as const,
  },
  admin: {
    users: ["admin", "users"] as const,
  },
  profile: {
    me: ["profile", "me"] as const,
  },
  globalSearch: {
    meta: ["global-search", "meta"] as const,
    search: (q: string) => ["global-search", q] as const,
  },
  simulation: {
    seats: (areaType: string, scopeArea: string, scopeName: string) =>
      ["simulation", "seats", areaType, scopeArea, scopeName || "all"] as const,
    saves: (mode?: string, mapCode?: string) =>
      ["simulation", "saves", mode || "all", mapCode || ""] as const,
    partyConfig: (
      areaType: string,
      overrides: Record<string, { party_gov: boolean }>,
    ) => ["simulation", "party-config", areaType, overrides] as const,
  },
};
