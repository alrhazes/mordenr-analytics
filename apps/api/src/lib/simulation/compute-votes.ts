/** Match legacy `computeBatchSimVoteFromGainLoss`: base + round(base * pct / 100). */
export function computeBatchSimVoteFromGainLoss(
  realVote: number,
  gainPct: number,
): number {
  const vote = Math.trunc(realVote);
  const pct = Number(gainPct);

  if (vote === 0 || pct === 0) return vote;
  return vote + Math.round(vote * (pct / 100));
}

export function batchSimulationHasActiveVotes(votes: number): boolean {
  return Math.trunc(votes) !== 0;
}
