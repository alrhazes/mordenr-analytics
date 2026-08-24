import type { SimulationChart, SimulationSeat } from "./types.js";

export function buildBatchWinnerSummary(
  seats: SimulationSeat[],
  mode: "asal" | "simulasi",
  colorLookup: Map<string, string>,
): SimulationChart {
  const winnerCount: Record<string, number> = {};
  const winnerColorParty: Record<string, string> = {};

  for (const seat of seats) {
    let winner = "";
    let colorParty = "";

    if (mode === "asal") {
      winner = (seat.election_verdict.menang.group ?? "").trim().toUpperCase();
      colorParty = winner;
    } else {
      const grouped = seat.simulation_grouped?.menang;
      if (grouped && "label" in grouped && grouped.label) {
        winner = grouped.label.trim().toUpperCase();
        const members = grouped.members ?? [];
        colorParty = members.length
          ? members[0].trim().toUpperCase()
          : winner;
      } else {
        winner = (seat.simulation?.menang?.group ?? "").trim().toUpperCase();
        colorParty = winner;
      }
    }

    if (!winner) continue;

    winnerCount[winner] = (winnerCount[winner] ?? 0) + 1;
    if (!winnerColorParty[winner]) {
      winnerColorParty[winner] = colorParty;
    }
  }

  const sorted = Object.entries(winnerCount).sort((a, b) => b[1] - a[1]);

  return {
    labels: sorted.map(([g]) => g),
    values: sorted.map(([, c]) => c),
    colors: sorted.map(
      ([g]) =>
        colorLookup.get((winnerColorParty[g] ?? g).toUpperCase()) ?? "#999999",
    ),
  };
}

export function buildSimulationWinnerChart(
  seats: SimulationSeat[],
  colorLookup: Map<string, string>,
): SimulationChart {
  return buildBatchWinnerSummary(seats, "simulasi", colorLookup);
}
