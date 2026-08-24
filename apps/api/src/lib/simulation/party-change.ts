import type { PartyChangeByGroup, PartyChangeRow, PartyRow } from "./types.js";

export function buildPartyChangeDisplayLabel(
  group: string,
  simulationParty: string,
  historicalParty: string,
  hasOverride?: boolean,
): string {
  const g = group.trim();
  const sim = simulationParty.trim();
  const hist = historicalParty.trim();
  const override =
    hasOverride ??
    (hist !== "" && sim !== "" && sim.toUpperCase() !== hist.toUpperCase());

  if (!override) return g;
  if (g !== "" && g.toUpperCase() !== sim.toUpperCase()) {
    return `${g}-${sim} (${hist})`;
  }
  return sim;
}

export function partyChangesToByGroup(
  rows: PartyChangeRow[],
): PartyChangeByGroup {
  const byGroup: PartyChangeByGroup = {};

  for (const row of rows) {
    const group = row.candidate_group.trim().toUpperCase();
    if (!group) continue;

    const historical = row.historical_party.trim();
    const simulation = row.simulation_party.trim();
    const hasOverride =
      simulation !== "" &&
      historical !== "" &&
      simulation.toUpperCase() !== historical.toUpperCase();

    byGroup[group] = {
      historical_party: historical,
      simulation_party: simulation || historical,
      display_party: buildPartyChangeDisplayLabel(
        group,
        simulation || historical,
        historical,
        hasOverride,
      ),
      has_party_override: hasOverride,
    };
  }

  return byGroup;
}

export function enrichPartyRowWithChanges(
  partyRow: PartyRow,
  changesByGroup: PartyChangeByGroup,
): void {
  const group = partyRow.group.trim().toUpperCase();
  const change = changesByGroup[group];
  if (!change) return;

  const historical = partyRow.party.trim();
  partyRow.historical_party = historical;
  partyRow.simulation_party = change.simulation_party;
  partyRow.has_party_override = change.has_party_override;
  partyRow.display_party = change.display_party;
}
