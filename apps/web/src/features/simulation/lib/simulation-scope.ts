import type { MapLevel } from "@/stores/explore-workspace";
import type { SimulationAreaType } from "@/stores/simulation-workspace";
import {
  resolveRingkasanScope,
  scopeAreaLabel,
  type RingkasanScope,
} from "@/features/explore/lib/ringkasan-scope";

export function mapLevelToAreaType(level: MapLevel): SimulationAreaType {
  return level === "dun" ? "dun" : "parlimen";
}

export function areaTypeToMapLevel(areaType: SimulationAreaType): MapLevel {
  return areaType === "dun" ? "dun" : "parliament";
}

export type ResolvedSimulation =
  | {
      view: "individual";
      mapCode: string;
      areaType: SimulationAreaType;
      scopeName: string;
      scopeTitle: string;
    }
  | {
      view: "batch";
      scopeArea: "NEGARA" | "NEGERI";
      scopeName: string;
      areaType: SimulationAreaType;
      scopeTitle: string;
    };

/** generateRingkasan / initSimulationParDun: scope picks batch vs individual; mapLevel picks seat list type. */
export function resolveSimulationFromScope(
  scope: RingkasanScope,
  mapLevel: MapLevel,
): ResolvedSimulation {
  if (scope.area === "PARLIMEN" || scope.area === "DUN") {
    const areaType: SimulationAreaType =
      scope.area === "DUN" ? "dun" : "parlimen";
    return {
      view: "individual",
      mapCode: scope.value,
      areaType,
      scopeName: "",
      scopeTitle: scopeAreaLabel(scope),
    };
  }
  const scopeArea = scope.area as "NEGARA" | "NEGERI";
  return {
    view: "batch",
    scopeArea,
    scopeName: scope.value,
    areaType: mapLevelToAreaType(mapLevel),
    scopeTitle: scopeAreaLabel(scope),
  };
}

export function buildSimulationSearchParams(
  resolved: ResolvedSimulation,
): URLSearchParams {
  const q = new URLSearchParams();
  q.set("level", areaTypeToMapLevel(resolved.areaType));
  if (resolved.view === "individual") {
    q.set("seat", resolved.mapCode);
    if (resolved.scopeName) q.set("state", resolved.scopeName);
  } else if (resolved.scopeName) {
    q.set("state", resolved.scopeName);
  }
  return q;
}

export function simulationHrefFromExplore(opts: {
  mapLevel: MapLevel;
  selectedConstituencyId: string | null;
  selectedElectoralType: MapLevel | null;
  appliedState: string;
}): string {
  const scope = resolveRingkasanScope({
    selectedConstituencyId: opts.selectedConstituencyId,
    selectedElectoralType: opts.selectedElectoralType,
    appliedState: opts.appliedState,
    mapLevel: opts.mapLevel,
  });
  const mapLevel =
    scope.area === "PARLIMEN" || scope.area === "DUN"
      ? areaTypeToMapLevel(
          scope.area === "DUN" ? "dun" : "parlimen",
        )
      : opts.mapLevel;
  const resolved = resolveSimulationFromScope(scope, mapLevel);
  return `/simulation?${buildSimulationSearchParams(resolved).toString()}`;
}

export function resolveSimulationFromUrlAndExplore(opts: {
  urlSeat: string;
  urlState: string;
  urlLevel: string;
  exploreMapLevel: MapLevel;
  selectedConstituencyId: string | null;
  selectedElectoralType: MapLevel | null;
  appliedState: string;
}): { resolved: ResolvedSimulation; mapLevel: MapLevel } {
  const hasUrlScope = Boolean(opts.urlSeat || opts.urlState);

  const scope = hasUrlScope
    ? resolveRingkasanScope({
        selectedConstituencyId: opts.urlSeat || null,
        selectedElectoralType: opts.urlSeat
          ? opts.urlLevel === "dun"
            ? "dun"
            : "parliament"
          : null,
        appliedState: opts.urlState,
        mapLevel: opts.exploreMapLevel,
      })
    : resolveRingkasanScope({
        selectedConstituencyId: opts.selectedConstituencyId,
        selectedElectoralType: opts.selectedElectoralType,
        appliedState: opts.appliedState,
        mapLevel: opts.exploreMapLevel,
      });

  const mapLevel = hasUrlScope
    ? opts.urlLevel === "dun"
      ? "dun"
      : "parliament"
    : scope.area === "PARLIMEN" || scope.area === "DUN"
      ? areaTypeToMapLevel(scope.area === "DUN" ? "dun" : "parlimen")
      : opts.exploreMapLevel;

  return {
    resolved: resolveSimulationFromScope(scope, mapLevel),
    mapLevel,
  };
}
