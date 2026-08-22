import type { MapLevel } from "@/stores/explore-workspace";

/** Legacy bdcat `get_ringkasan_details` text param. */
export type RingkasanArea = "NEGARA" | "NEGERI" | "PARLIMEN" | "DUN";

export type RingkasanScope = {
  area: RingkasanArea;
  value: string;
};

/** Match bdcat generateRingkasanPrediction priority: seat > state > negara. */
export function resolveRingkasanScope(opts: {
  selectedConstituencyId: string | null;
  selectedElectoralType: MapLevel | null;
  appliedState: string;
}): RingkasanScope {
  if (opts.selectedConstituencyId && opts.selectedElectoralType) {
    return {
      area: opts.selectedElectoralType === "dun" ? "DUN" : "PARLIMEN",
      value: opts.selectedConstituencyId,
    };
  }
  if (opts.appliedState) {
    return { area: "NEGERI", value: opts.appliedState };
  }
  return { area: "NEGARA", value: "" };
}

export function scopeAreaLabel(scope: RingkasanScope): string {
  if (scope.area === "NEGERI") {
    return `SELURUH NEGERI ${scope.value.toUpperCase()}`;
  }
  if (scope.area === "PARLIMEN") {
    return `PARLIMEN ${scope.value.toUpperCase()}`;
  }
  if (scope.area === "DUN") {
    return `DUN ${scope.value.toUpperCase()}`;
  }
  return "SELURUH NEGARA";
}

/** Avoid showing stale keepPreviousData while scope is changing. */
export function summaryMatchesScope(
  data: { area?: string; areaValue?: string | null } | undefined,
  scope: RingkasanScope,
): boolean {
  if (!data?.area) return false;
  return (
    data.area === scope.area &&
    (data.areaValue || "").toUpperCase() === (scope.value || "").toUpperCase()
  );
}
