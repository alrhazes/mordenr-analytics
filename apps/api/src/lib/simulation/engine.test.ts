import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  computeBatchSimVoteFromGainLoss,
  applyBatchSimulationTransfer,
  finalizeBatchSimulationSeatWithParams,
} from "./index.js";
import type { SimulationSeat } from "./types.js";

function fixtureSeat(): SimulationSeat {
  return {
    parliament_code: "P079",
    parliament_name: "LIPIS",
    election_type: "GE",
    election_year: "2022",
    election_state: "PAHANG",
    total_electorate: 50000,
    total_ballots: 40000,
    tov: 80,
    election_verdict: {
      menang: { group: "PN", party: "BERSATU", vote_won: 22000, majority: 4000 },
      kalah: [
        { group: "PH", party: "PKR", vote_won: 18000 },
        { group: "BN", party: "UMNO", vote_won: 12000 },
      ],
    },
    parties: [
      {
        group: "PN",
        party: "BERSATU",
        vote_won: 22000,
        sim_vote_won: 22000,
      },
      {
        group: "PH",
        party: "PKR",
        vote_won: 18000,
        sim_vote_won: 18000,
      },
      {
        group: "BN",
        party: "UMNO",
        vote_won: 12000,
        sim_vote_won: 12000,
      },
    ],
    simulation: {
      total_votes: 0,
      vote_change: 0,
      tov: 0,
      menang: {},
      kalah: [],
    },
  };
}

describe("simulation engine", () => {
  it("computeBatchSimVoteFromGainLoss matches legacy rounding", () => {
    assert.equal(computeBatchSimVoteFromGainLoss(1000, 5), 1050);
    assert.equal(computeBatchSimVoteFromGainLoss(1000, -10), 900);
    assert.equal(computeBatchSimVoteFromGainLoss(0, 50), 0);
    assert.equal(computeBatchSimVoteFromGainLoss(333, 7), 333 + Math.round(333 * 0.07));
  });

  it("transfer shifts votes between groups", () => {
    const seat = fixtureSeat();
    seat.parties.forEach((p) => {
      p.sim_vote_won = p.vote_won;
    });

    applyBatchSimulationTransfer(seat, [
      { from: "PH", to: "PN", pct: 10 },
    ]);

    const pn = seat.parties.find((p) => p.group === "PN")!;
    const ph = seat.parties.find((p) => p.group === "PH")!;
    assert.equal(pn.sim_vote_won, 22000 + 1800);
    assert.equal(ph.sim_vote_won, 18000 - 1800);
  });

  it("finalize picks winner by simulated votes", () => {
    const seat = fixtureSeat();
    seat.parties.forEach((p) => {
      p.sim_vote_won = p.vote_won;
    });
    seat.parties.find((p) => p.group === "PH")!.sim_vote_won = 25000;

    finalizeBatchSimulationSeatWithParams(seat, [], null);

    assert.equal(seat.simulation?.menang.group, "PH");
    assert.equal(seat.simulation?.menang.majority, 3000);
  });
});
