import type { GroupingParam, SimulationSeat } from "./types.js";
import { batchSimulationHasActiveVotes } from "./compute-votes.js";

export function applyBatchSimulationGrouping(
  seat: SimulationSeat,
  groupingArr: GroupingParam | GroupingParam[] | null,
): void {
  seat.simulation_grouped = {
    groups: [],
    menang: {},
    kalah: [],
  };

  const groups = normalizeGrouping(groupingArr);
  if (!groups.length || !seat.parties?.length) return;

  const partyVotes: Record<string, number> = {};
  for (const p of seat.parties) {
    const group = (p.group ?? "").trim().toUpperCase();
    const vote = Math.trunc(p.sim_vote_won ?? 0);
    if (group) {
      partyVotes[group] = (partyVotes[group] ?? 0) + vote;
    }
  }

  const groupResults: Array<{
    label: string;
    members: string[];
    votes: number;
  }> = [];

  for (const g of groups) {
    const label = (g.label ?? "").trim();
    const members = g.members ?? [];
    let total = 0;
    const validMembers: string[] = [];

    for (const m of members) {
      const key = m.trim().toUpperCase();
      if (partyVotes[key] !== undefined) {
        total += partyVotes[key];
        validMembers.push(key);
      }
    }

    if (!validMembers.length || !batchSimulationHasActiveVotes(total)) continue;

    groupResults.push({ label, members: validMembers, votes: total });
  }

  const groupedMembersFlat = new Set<string>();
  for (const gr of groupResults) {
    for (const m of gr.members) groupedMembersFlat.add(m);
  }

  for (const [party, vote] of Object.entries(partyVotes)) {
    if (!groupedMembersFlat.has(party) && batchSimulationHasActiveVotes(vote)) {
      groupResults.push({
        label: party,
        members: [party],
        votes: vote,
      });
    }
  }

  groupResults.sort((a, b) => b.votes - a.votes);
  const filtered = groupResults.filter((gr) =>
    batchSimulationHasActiveVotes(gr.votes),
  );

  seat.simulation_grouped.groups = filtered;

  const winner = filtered[0] ?? null;
  const second = filtered[1] ?? null;
  let majority = 0;
  if (winner && second) majority = winner.votes - second.votes;

  if (winner) {
    seat.simulation_grouped.menang = {
      label: winner.label,
      votes: winner.votes,
      members: winner.members,
      majority,
    };
  }

  seat.simulation_grouped.kalah = [];
  for (let i = 1; i < filtered.length; i++) {
    seat.simulation_grouped.kalah.push({
      label: filtered[i].label,
      votes: filtered[i].votes,
      members: filtered[i].members,
    });
  }
}

function normalizeGrouping(
  groupingArr: GroupingParam | GroupingParam[] | null,
): GroupingParam[] {
  if (!groupingArr) return [];
  if (Array.isArray(groupingArr)) return groupingArr.filter((g) => g?.label);
  if (groupingArr.label) return [groupingArr];
  return [];
}
