import type {
  BatchSimulationResult,
  GainLossParam,
  GroupingParam,
  SimulationAreaType,
  SimulationSeat,
  TransferParam,
} from "./types.js";
import type { CandidateRow } from "./types.js";
import { buildSeatsFromCandidates, buildBaselineWinnerChart } from "./build-baseline.js";
import { computeBatchSimVoteFromGainLoss } from "./compute-votes.js";
import { enrichPartyRowWithChanges, partyChangesToByGroup } from "./party-change.js";
import { finalizeBatchSimulationSeatWithParams } from "./finalize-seat.js";
import { buildBatchWinnerSummary, buildSimulationWinnerChart } from "./summary.js";

export type IndividualOverride = {
  mapCode: string;
  gainloss: GainLossParam[];
  transfer: TransferParam[];
  grouping: GroupingParam | null;
  simName?: string;
};

export type RunBatchOptions = {
  areaType: SimulationAreaType;
  rows: CandidateRow[];
  seatCodes: string[];
  gainloss: GainLossParam[];
  transfer: TransferParam[];
  grouping: GroupingParam | null;
  individualOverrides?: IndividualOverride[];
  partyChangesByMap?: Record<
    string,
    ReturnType<typeof partyChangesToByGroup>
  >;
  colorLookup: Map<string, string>;
};

function gainlossToMap(arr: GainLossParam[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const g of arr) {
    const group = (g.group ?? "").trim().toUpperCase();
    if (group) map[group] = Number(g.pct ?? 0);
  }
  return map;
}

function resolveSeatParams(
  seatCode: string,
  overrideMap: Map<string, IndividualOverride>,
  batchGainloss: Record<string, number>,
  batchTransfer: TransferParam[],
  batchGrouping: GroupingParam | null,
): {
  gainlossMap: Record<string, number>;
  transfer: TransferParam[];
  grouping: GroupingParam | null;
  fromIndividual: boolean;
  simName: string;
} {
  const override = overrideMap.get(seatCode);
  if (override) {
    return {
      gainlossMap: gainlossToMap(override.gainloss),
      transfer: override.transfer,
      grouping: override.grouping,
      fromIndividual: true,
      simName: override.simName ?? "",
    };
  }
  return {
    gainlossMap: batchGainloss,
    transfer: batchTransfer,
    grouping: batchGrouping,
    fromIndividual: false,
    simName: "",
  };
}

export function runBatchSimulation(options: RunBatchOptions): BatchSimulationResult {
  const {
    areaType,
    rows,
    seatCodes,
    gainloss,
    transfer,
    grouping,
    individualOverrides = [],
    partyChangesByMap = {},
    colorLookup,
  } = options;

  const gainlossMap = gainlossToMap(gainloss);
  const overrideMap = new Map(
    individualOverrides.map((o) => [o.mapCode, o]),
  );

  const { seats: baselineSeats } = buildSeatsFromCandidates(rows, areaType);
  const resultSeats: SimulationSeat[] = [];

  let seat: SimulationSeat | null = null;
  let currentKey = "";
  let activeParams = resolveSeatParams("", overrideMap, gainlossMap, transfer, grouping);
  let seatPartyChanges: ReturnType<typeof partyChangesToByGroup> = {};

  for (const row of rows) {
    const candidateGroup = row.candidate_group.trim().toUpperCase();
    const candidateParty = row.candidate_party.trim();
    const candidateVerdict = row.candidate_verdict.trim().toLowerCase();
    const seatKey = areaType === "parlimen" ? row.parliament_code : row.map_code;
    const lookupMapCode = row.map_code.trim() || seatKey;
    const totalBallots =
      row.total_ballots - row.total_unreturned - row.total_rejected;
    const tov =
      row.total_electorate > 0
        ? Math.round((totalBallots / row.total_electorate) * 10000) / 100
        : 0;

    if (currentKey !== seatKey) {
      if (seat) {
        finalizeBatchSimulationSeatWithParams(
          seat,
          activeParams.transfer,
          activeParams.grouping,
        );
        if (activeParams.fromIndividual) {
          seat.simulation_source = "individual";
          seat.individual_sim_name = activeParams.simName;
        }
        resultSeats.push(seat);
      }

      currentKey = seatKey;
      seatPartyChanges = partyChangesByMap[lookupMapCode] ?? {};
      activeParams = resolveSeatParams(
        seatKey,
        overrideMap,
        gainlossMap,
        transfer,
        grouping,
      );

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
        simulation: {
          total_votes: 0,
          vote_change: 0,
          tov: 0,
          menang: {},
          kalah: [],
        },
        parties: [],
      };

      if (activeParams.fromIndividual) {
        seat.individual_sim_name = activeParams.simName;
      }
    }

    if (!seat) continue;

    const realVote = row.candidate_vote_won;
    const gainPct = activeParams.gainlossMap[candidateGroup] ?? 0;
    const simVote = computeBatchSimVoteFromGainLoss(realVote, gainPct);

    const partyRow = {
      group: candidateGroup,
      party: candidateParty,
      vote_won: realVote,
      majority: row.candidate_majority_won,
      verdict: candidateVerdict,
      gainloss_pct: gainPct,
      sim_vote_won: simVote,
      sim_vote_diff: simVote - realVote,
    };

    enrichPartyRowWithChanges(partyRow, seatPartyChanges);
    seat.parties.push(partyRow);

    if (candidateVerdict === "menang") {
      seat.election_verdict.menang = {
        group: candidateGroup,
        party: candidateParty,
        vote_won: realVote,
        majority: row.candidate_majority_won,
      };
    } else {
      seat.election_verdict.kalah.push({
        group: candidateGroup,
        party: candidateParty,
        vote_won: realVote,
      });
    }
  }

  if (seat) {
    finalizeBatchSimulationSeatWithParams(
      seat,
      activeParams.transfer,
      activeParams.grouping,
    );
    if (activeParams.fromIndividual) {
      seat.simulation_source = "individual";
      seat.individual_sim_name = activeParams.simName;
    }
    resultSeats.push(seat);
  }

  const asal = buildBatchWinnerSummary(resultSeats, "asal", colorLookup);
  const simulasi = buildBatchWinnerSummary(resultSeats, "simulasi", colorLookup);

  return {
    meta: {
      simulation_mode: "gainloss_only",
      total_selected_parliament: resultSeats.length,
      gainloss: gainlossMap,
      transfer,
      individual_overrides_applied: individualOverrides.map((o) => o.mapCode),
    },
    parliament: resultSeats,
    chart: simulasi,
    summary: { asal, simulasi },
  };
}

export function buildBatchInitResult(
  areaType: SimulationAreaType,
  rows: CandidateRow[],
  colorLookup: Map<string, string>,
): BatchSimulationResult {
  const { seats, allParties } = buildSeatsFromCandidates(rows, areaType);
  const chart = buildBaselineWinnerChart(seats, colorLookup);

  return {
    meta: {
      all_parties: allParties,
      transfer_parties: allParties,
      total_selected_parliament: seats.length,
    },
    parliament: seats,
    chart,
    summary: {
      asal: chart,
      simulasi: { labels: [], values: [], colors: [] },
    },
  };
}

export { buildSimulationWinnerChart };
