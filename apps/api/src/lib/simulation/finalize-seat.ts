import type { GroupingParam, SimulationSeat } from "./types.js";
import { applyBatchSimulationTransfer } from "./apply-transfer.js";
import { applyBatchSimulationGrouping } from "./apply-grouping.js";
import { buildPartyChangeDisplayLabel } from "./party-change.js";
import { batchSimulationHasActiveVotes } from "./compute-votes.js";

export function finalizeBatchSimulationSeat(seat: SimulationSeat): void {
  const groupVotes: Record<string, number> = {};
  const groupMeta: Record<
    string,
    {
      group: string;
      party: string;
      historical_party: string;
      display_party: string;
      has_party_override: boolean;
      group_logo: string;
    }
  > = {};

  for (const p of seat.parties) {
    const group = (p.group ?? "").trim().toUpperCase();
    if (!group) continue;

    groupVotes[group] =
      (groupVotes[group] ?? 0) + Math.trunc(p.sim_vote_won ?? 0);

    if (!groupMeta[group]) {
      const simParty = (p.simulation_party ?? p.party ?? group).trim();
      const histParty = (p.historical_party ?? p.party ?? group).trim();
      let displayParty = (p.display_party ?? "").trim();
      if (!displayParty) {
        displayParty = buildPartyChangeDisplayLabel(
          group,
          simParty,
          histParty,
          simParty.toUpperCase() !== histParty.toUpperCase(),
        );
      }

      groupMeta[group] = {
        group,
        party: simParty,
        historical_party: histParty,
        display_party: displayParty,
        has_party_override: Boolean(p.has_party_override),
        group_logo: (p.group_logo ?? "").trim(),
      };
    }
  }

  const filteredVotes = Object.fromEntries(
    Object.entries(groupVotes).filter(([, v]) =>
      batchSimulationHasActiveVotes(v),
    ),
  );

  const rankedGroups = Object.entries(filteredVotes)
    .sort((a, b) => b[1] - a[1])
    .map(([g]) => g);

  const winnerGroup = rankedGroups[0] ?? null;
  const secondGroup = rankedGroups[1] ?? null;
  let majority = 0;
  if (winnerGroup && secondGroup) {
    majority = filteredVotes[winnerGroup] - filteredVotes[secondGroup];
  }

  seat.parties.sort(
    (a, b) => Math.trunc(b.sim_vote_won ?? 0) - Math.trunc(a.sim_vote_won ?? 0),
  );

  let totalSimVotes = 0;
  let totalRealVotes = 0;
  for (const p of seat.parties) {
    totalRealVotes += Math.trunc(p.vote_won ?? 0);
    totalSimVotes += Math.trunc(p.sim_vote_won ?? 0);
  }

  const electorate = Math.trunc(seat.total_electorate ?? 0);

  seat.simulation = {
    total_votes: totalSimVotes,
    vote_change: totalSimVotes - totalRealVotes,
    tov:
      electorate > 0
        ? Math.round((totalSimVotes / electorate) * 10000) / 100
        : 0,
    menang: {},
    kalah: [],
  };

  if (winnerGroup) {
    const meta = groupMeta[winnerGroup];
    seat.simulation.menang = {
      group: meta.group,
      party: meta.party,
      historical_party: meta.historical_party ?? meta.party,
      display_party: meta.display_party ?? meta.group,
      has_party_override: meta.has_party_override,
      group_logo: meta.group_logo,
      vote_won: filteredVotes[winnerGroup],
      majority,
    };
  }

  for (let i = 1; i < rankedGroups.length; i++) {
    const group = rankedGroups[i];
    const meta = groupMeta[group];
    seat.simulation.kalah.push({
      group: meta.group,
      party: meta.party,
      historical_party: meta.historical_party ?? meta.party,
      display_party: meta.display_party ?? meta.group,
      has_party_override: meta.has_party_override,
      group_logo: meta.group_logo,
      vote_won: filteredVotes[group],
    });
  }
}

export function finalizeBatchSimulationSeatWithParams(
  seat: SimulationSeat,
  transferArr: Parameters<typeof applyBatchSimulationTransfer>[1],
  groupingArr: GroupingParam | null,
): void {
  applyBatchSimulationTransfer(seat, transferArr);
  finalizeBatchSimulationSeat(seat);
  applyBatchSimulationGrouping(seat, groupingArr);
}
