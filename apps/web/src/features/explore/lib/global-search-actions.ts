import type { NavigateFunction } from "react-router-dom";
import type { GlobalSearchSuggestion } from "@/queries/global-search";
import type { SeatSearchHit } from "@/stores/explore-workspace";

type WorkspaceActions = {
  resetAllFilters: () => void;
  setMapLevel: (level: "parliament" | "dun") => void;
  setSearchSelection: (hit: SeatSearchHit | null) => void;
  setSelectedConstituencyId: (id: string | null) => void;
  setSelectedElectoralType: (t: "parliament" | "dun" | null) => void;
};

export function suggestionToSeatHit(
  item: GlobalSearchSuggestion,
): SeatSearchHit | null {
  if (item.type !== "par" && item.type !== "dun") return null;
  if (!item.mapCode && !item.id) return null;

  const electoralType = item.electoralType || (item.type === "dun" ? "dun" : "parliament");
  const code = item.mapCode || item.id;

  return {
    code,
    mapCode: code,
    name: item.value.replace(/^[^:]+:\s*/, "").replace(/\s*\([^)]+\)$/, ""),
    electoralType,
    state: item.state || item.label || "",
    member: item.member || "",
    party: item.party || "",
    partyGroup: item.partyGroup || "",
    color: "#999999",
    display: item.value,
    partyLogo: item.partyLogo || "parties/ind.png",
    groupLogo: item.groupLogo || "parties/ind.png",
    partyLogoFallback: item.partyLogoFallback || "parties/ind.png",
    groupLogoFallback: item.groupLogoFallback || "parties/ind.png",
    hidePartyLogo: item.hidePartyLogo ?? false,
  };
}

export function applyGlobalSearchSelection(
  item: GlobalSearchSuggestion,
  navigate: NavigateFunction,
  actions: WorkspaceActions,
): string | null {
  if (item.type === "denied") {
    return "You are not authorized to use global search.";
  }

  if (item.type === "par" || item.type === "dun") {
    const hit = suggestionToSeatHit(item);
    if (!hit) return "Could not open this seat.";

    actions.resetAllFilters();
    actions.setMapLevel(hit.electoralType);
    actions.setSearchSelection(hit);
    actions.setSelectedConstituencyId(hit.code);
    actions.setSelectedElectoralType(hit.electoralType);
    navigate("/explore");
    return null;
  }

  if (item.type === "voters") {
    const ic = item.ic || item.id;
    navigate(`/explore?voter=${encodeURIComponent(ic)}`);
    return `Voter IC ${ic} — full voter profile coming soon.`;
  }

  if (item.type === "dm") {
    const mapCode = String(item.extras?.map_code || item.extras?.mapCode || "");
    if (mapCode) {
      navigate(`/explore?seat=${encodeURIComponent(mapCode)}`);
      return null;
    }
    return "DM detail is not available for this result.";
  }

  if (item.type === "map_location" || item.type === "table_location") {
    return "Map location results are not supported in Analytics yet.";
  }

  return null;
}
