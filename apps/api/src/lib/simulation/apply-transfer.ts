import type { SimulationSeat, TransferParam } from "./types.js";
import { batchSimulationHasActiveVotes } from "./compute-votes.js";

export function applyBatchSimulationTransfer(
  seat: SimulationSeat,
  transferArr: TransferParam[],
): void {
  if (!seat.parties?.length || !transferArr?.length) return;

  const adjustedBaseByGroup: Record<string, number> = {};
  const partyIndicesByGroup: Record<string, number[]> = {};

  for (let i = 0; i < seat.parties.length; i++) {
    const group = (seat.parties[i].group ?? "").trim().toUpperCase();
    if (!group) continue;

    const simVote = Math.trunc(seat.parties[i].sim_vote_won ?? 0);

    if (!adjustedBaseByGroup[group]) {
      adjustedBaseByGroup[group] = 0;
      partyIndicesByGroup[group] = [];
    }

    adjustedBaseByGroup[group] += simVote;
    partyIndicesByGroup[group].push(i);
    seat.parties[i].sim_transfer_in = 0;
    seat.parties[i].sim_transfer_out = 0;
  }

  const groupKeys = Object.keys(adjustedBaseByGroup);
  const outgoingByGroup: Record<string, number> = Object.fromEntries(
    groupKeys.map((k) => [k, 0]),
  );
  const incomingByGroup: Record<string, number> = Object.fromEntries(
    groupKeys.map((k) => [k, 0]),
  );

  for (const tr of transferArr) {
    const from = (tr.from ?? "").trim().toUpperCase();
    const to = (tr.to ?? "").trim().toUpperCase();
    const pct = Number(tr.pct ?? 0);

    if (!from || !to || pct === 0 || from === to) continue;
    if (
      adjustedBaseByGroup[from] === undefined ||
      adjustedBaseByGroup[to] === undefined
    ) {
      continue;
    }

    const amount = Math.round(adjustedBaseByGroup[from] * (pct / 100));
    if (amount === 0) continue;

    outgoingByGroup[from] += amount;
    incomingByGroup[to] += amount;
  }

  for (const group of groupKeys) {
    const adjustedBase = adjustedBaseByGroup[group];
    let finalGroupVotes =
      adjustedBase + incomingByGroup[group] - outgoingByGroup[group];
    if (finalGroupVotes < 0) finalGroupVotes = 0;

    const indices = partyIndicesByGroup[group];
    const outgoing = outgoingByGroup[group];
    const incoming = incomingByGroup[group];
    let assigned = 0;
    const lastIdx = indices[indices.length - 1];
    const indexCount = indices.length;

    for (const idx of indices) {
      let share: number;
      if (adjustedBase > 0) {
        const rowAdjusted = Math.trunc(seat.parties[idx].sim_vote_won ?? 0);
        share = rowAdjusted / adjustedBase;
      } else {
        share = indexCount > 0 ? 1 / indexCount : 0;
      }

      let rowFinal: number;
      if (idx === lastIdx) {
        rowFinal = finalGroupVotes - assigned;
      } else {
        rowFinal = Math.round(finalGroupVotes * share);
        assigned += rowFinal;
      }

      if (rowFinal < 0) rowFinal = 0;

      seat.parties[idx].sim_vote_won = rowFinal;
      seat.parties[idx].sim_transfer_in = Math.round(incoming * share);
      seat.parties[idx].sim_transfer_out = Math.round(outgoing * share);
    }
  }

  for (const p of seat.parties) {
    const realVote = Math.trunc(p.vote_won ?? 0);
    let simVote = Math.trunc(p.sim_vote_won ?? 0);
    if (simVote < 0) {
      simVote = 0;
      p.sim_vote_won = 0;
    }
    p.sim_vote_diff = simVote - realVote;
  }
}

export { batchSimulationHasActiveVotes };
