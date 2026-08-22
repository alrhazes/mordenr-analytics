import type { GeoFeatureProperties, MapFilters } from "@/stores/explore-workspace";

/** Port of bdcat map_elec_main.js filter AND predicates. */
export function seatMatchesFilters(
  props: GeoFeatureProperties,
  filters: MapFilters,
): boolean {
  if (filters.state && filters.state !== "0") {
    if (props.state.toUpperCase() !== filters.state.toUpperCase()) {
      return false;
    }
  }

  if (filters.majority.value && filters.majority.value !== "0") {
    const selected = Number(filters.majority.value);
    const pct = Number(props.majorityPercent ?? 0);
    if (pct === 0) return false;
    if (filters.majority.mode === "lebih") {
      if (pct <= selected) return false;
    } else {
      // kurang (default)
      if (pct >= selected) return false;
    }
  }

  if (filters.turnout && filters.turnout !== "0") {
    const selected = Number(filters.turnout);
    const turnout = Number(props.turnout ?? 0);
    if (turnout === 0) return false;
    if (turnout >= selected) return false;
  }

  if (filters.group && filters.group !== "0") {
    if (props.partyGroup !== filters.group) return false;
  }

  if (filters.party && filters.party !== "0") {
    if (props.party !== filters.party) return false;
  }

  if (filters.government && filters.government !== "0") {
    if (props.government !== filters.government) return false;
  }

  return true;
}

export function applyMapFilters<
  T extends { properties: GeoFeatureProperties },
>(features: T[], filters: MapFilters): T[] {
  return features.filter((f) => seatMatchesFilters(f.properties, filters));
}

export function hasActiveMapFilters(filters: MapFilters): boolean {
  return (
    (filters.state !== "" && filters.state !== "0") ||
    (filters.majority.value !== "" && filters.majority.value !== "0") ||
    (filters.turnout !== "" && filters.turnout !== "0") ||
    (filters.group !== "" && filters.group !== "0") ||
    (filters.party !== "" && filters.party !== "0") ||
    (filters.government !== "" && filters.government !== "0")
  );
}

export function buildMajorityOptions(): Array<{
  value: string;
  mode: "kurang" | "lebih";
  label: string;
}> {
  const options: Array<{
    value: string;
    mode: "kurang" | "lebih";
    label: string;
  }> = [];
  for (let j = 1; j <= 100; j++) {
    options.push({
      value: String(j),
      mode: "kurang",
      label: `KURANG DARI ${j}%`,
    });
  }
  for (let j = 1; j <= 100; j++) {
    options.push({
      value: String(j),
      mode: "lebih",
      label: `LEBIH DARI ${j}%`,
    });
  }
  return options;
}

export function buildTurnoutOptions(): Array<{ value: string; label: string }> {
  const options: Array<{ value: string; label: string }> = [];
  for (let j = 1; j <= 100; j++) {
    options.push({ value: String(j), label: `KURANG DARI ${j}%` });
  }
  return options;
}
