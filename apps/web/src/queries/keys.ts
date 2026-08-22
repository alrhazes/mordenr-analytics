export const queryKeys = {
  auth: {
    me: ["auth", "me"] as const,
  },
  health: ["health"] as const,
  explore: {
    summary: ["explore", "summary"] as const,
    summaryByState: (state: string) =>
      ["explore", "summary", state || "all"] as const,
    states: ["explore", "states"] as const,
    geo: (state: string) => ["explore", "geo", state || "all"] as const,
    parliament: (code: string) => ["explore", "parliament", code] as const,
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
};
