import type {
  CandidateRow,
  SimulationAreaType,
  SimulationChart,
  SimulationSeat,
} from "./types.js";

export function buildSeatsFromCandidates(
  rows: CandidateRow[],
  areaType: SimulationAreaType,
): { seats: SimulationSeat[]; allParties: string[] } {
  const seats: SimulationSeat[] = [];
  const allParties: string[] = [];
  let seat: SimulationSeat | null = null;
  let currentKey = "";

  for (const row of rows) {
    const candidateGroup = row.candidate_group.trim().toUpperCase();
    const candidateParty = row.candidate_party.trim();
    const candidateVerdict = row.candidate_verdict.trim().toLowerCase();
    const totalBallots =
      row.total_ballots - row.total_unreturned - row.total_rejected;
    const tov =
      row.total_electorate > 0
        ? Math.round((totalBallots / row.total_electorate) * 10000) / 100
        : 0;

    if (candidateGroup && !allParties.includes(candidateGroup)) {
      allParties.push(candidateGroup);
    }

    const seatKey =
      areaType === "parlimen" ? row.parliament_code : row.map_code;

    if (currentKey !== seatKey) {
      if (seat) seats.push(seat);
      currentKey = seatKey;

      seat = {
        parliament_code: seatKey,
        parliament_name:
          areaType === "parlimen" ? row.parliament_name : (row.dun_name ?? ""),
        election_type: row.candidate_election,
        election_year: String(row.candidate_year),
        election_state: row.candidate_state,
        total_electorate: row.total_electorate,
        total_ballots: totalBallots,
        tov,
        election_verdict: { menang: {}, kalah: [] },
        parties: [],
      };
    }

    if (!seat) continue;

    const partyRow = {
      group: candidateGroup,
      party: candidateParty,
      vote_won: row.candidate_vote_won,
      majority: row.candidate_majority_won,
      verdict: candidateVerdict,
    };

    seat.parties.push(partyRow);

    if (candidateVerdict === "menang") {
      seat.election_verdict.menang = {
        group: candidateGroup,
        party: candidateParty,
        vote_won: row.candidate_vote_won,
        majority: row.candidate_majority_won,
      };
    } else {
      seat.election_verdict.kalah.push({
        group: candidateGroup,
        party: candidateParty,
        vote_won: row.candidate_vote_won,
      });
    }
  }

  if (seat) seats.push(seat);

  allParties.sort();
  return { seats, allParties };
}

export function buildBaselineWinnerChart(
  seats: SimulationSeat[],
  colorLookup: Map<string, string>,
): SimulationChart {
  const winnerCount: Record<string, number> = {};
  const winnerColorParty: Record<string, string> = {};

  for (const s of seats) {
    const menang = s.election_verdict.menang;
    const winner = (menang.group ?? "").trim().toUpperCase();
    if (!winner) continue;

    winnerCount[winner] = (winnerCount[winner] ?? 0) + 1;
    if (!winnerColorParty[winner]) {
      winnerColorParty[winner] = winner;
    }
  }

  const sorted = Object.entries(winnerCount).sort((a, b) => b[1] - a[1]);

  return {
    labels: sorted.map(([g]) => g),
    values: sorted.map(([, c]) => c),
    colors: sorted.map(
      ([g]) => colorLookup.get(winnerColorParty[g]?.toUpperCase() ?? g) ?? "#999999",
    ),
  };
}

export function computePartyTotals(
  seats: SimulationSeat[],
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const seat of seats) {
    for (const p of seat.parties) {
      const group = (p.group ?? "").trim().toUpperCase();
      if (!group) continue;
      totals[group] = (totals[group] ?? 0) + Math.trunc(p.vote_won ?? 0);
    }
  }
  return totals;
}
