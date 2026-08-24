import type { SimulationAreaType } from "@/stores/simulation-workspace";
import type { SimulationChart, SimulationSeat } from "@/queries/simulation";

function formatNum(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

type Props = {
  areaType: SimulationAreaType;
  seats: SimulationSeat[];
  hasSimulation: boolean;
};

export function SimulationResultsTable({
  areaType,
  seats,
  hasSimulation,
}: Props) {
  const colLabel = areaType === "parlimen" ? "PARLIMEN" : "DUN";

  return (
    <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-white">
      <table className="min-w-full text-xs">
        <thead>
          <tr className="border-b border-[var(--color-line)] bg-[var(--color-bg)]">
            <th className="px-2 py-2 text-left">{colLabel}</th>
            <th className="px-2 py-2 text-left">NEGERI</th>
            <th className="px-2 py-2">TAHUN</th>
            <th className="px-2 py-2">MENANG</th>
            <th className="px-2 py-2">MAJORITI</th>
            <th className="px-2 py-2">TOV</th>
            {hasSimulation && (
              <>
                <th className="bg-rose-900 px-2 py-2 text-white">SIM MENANG</th>
                <th className="bg-rose-900 px-2 py-2 text-white">SIM MAJORITI</th>
                <th className="bg-rose-900 px-2 py-2 text-white">SIM TOV</th>
              </>
            )}
          </tr>
        </thead>
        <tbody>
          {seats.length === 0 && (
            <tr>
              <td
                colSpan={hasSimulation ? 9 : 6}
                className="px-3 py-8 text-center text-[var(--color-ink-muted)]"
              >
                Tiada data simulasi
              </td>
            </tr>
          )}
          {seats.map((seat) => {
            const asalWinner = seat.election_verdict.menang.group ?? "-";
            const simWinner =
              seat.simulation_grouped?.menang?.label ||
              seat.simulation?.menang?.group ||
              "-";
            const swing =
              hasSimulation &&
              asalWinner !== "-" &&
              simWinner !== "-" &&
              asalWinner !== simWinner;

            return (
              <tr
                key={seat.parliament_code}
                className="border-b border-[var(--color-line)]/60"
              >
                <td className="px-2 py-2 font-medium">
                  {swing && (
                    <span className="mr-1 text-rose-500" title="Swing seat">
                      ⚡
                    </span>
                  )}
                  {seat.simulation_source === "individual" && (
                    <span
                      className="mr-1 rounded bg-orange-100 px-1 py-0.5 text-[10px] font-bold text-orange-800"
                      title={seat.individual_sim_name || "Simulasi individu"}
                    >
                      IND
                    </span>
                  )}
                  {seat.parliament_code} {seat.parliament_name}
                </td>
                <td className="px-2 py-2 uppercase">
                  {seat.election_state}
                </td>
                <td className="px-2 py-2 text-center">{seat.election_year}</td>
                <td className="px-2 py-2 text-center font-semibold">
                  {asalWinner}
                </td>
                <td className="px-2 py-2 text-center tabular-nums">
                  {formatNum(seat.election_verdict.menang.majority ?? 0)}
                </td>
                <td className="px-2 py-2 text-center tabular-nums">
                  {seat.tov}%
                </td>
                {hasSimulation && (
                  <>
                    <td className="bg-rose-50 px-2 py-2 text-center font-semibold text-rose-900">
                      {simWinner}
                    </td>
                    <td className="bg-rose-50 px-2 py-2 text-center tabular-nums">
                      {formatNum(
                        seat.simulation_grouped?.menang?.majority ??
                          seat.simulation?.menang?.majority ??
                          0,
                      )}
                    </td>
                    <td className="bg-rose-50 px-2 py-2 text-center tabular-nums">
                      {seat.simulation?.tov ?? 0}%
                    </td>
                  </>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function SimulationSummaryPanel({
  summary,
  seatCount,
}: {
  summary: { asal: SimulationChart; simulasi: SimulationChart } | null;
  seatCount: number;
}) {
  if (!summary) return null;

  return (
    <div className="rounded-xl border border-dotted border-[var(--color-line)] p-4">
      <h4 className="mb-3 text-sm font-semibold">RUMUSAN KEPUTUSAN</h4>
      <p className="mb-4 text-sm font-bold">
        JUMLAH KERUSI DITANDINGI: {seatCount}
      </p>
      <div className="flex flex-wrap gap-6">
        <SummaryTable title="ASAL" chart={summary.asal} />
        <SummaryTable title="SIMULASI" chart={summary.simulasi} sim />
      </div>
    </div>
  );
}

function SummaryTable({
  title,
  chart,
  sim,
}: {
  title: string;
  chart: SimulationChart;
  sim?: boolean;
}) {
  const total = chart.values.reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <div
        className={`mb-2 text-xs font-black ${sim ? "text-orange-600" : ""}`}
      >
        {title}
      </div>
      <table className="text-xs">
        <thead>
          <tr className={sim ? "bg-rose-900 text-white" : "bg-[var(--color-bg)]"}>
            <th className="px-3 py-2 text-left">GABUNGAN</th>
            <th className="px-3 py-2">MENANG</th>
            <th className="px-3 py-2">PERATUS</th>
          </tr>
        </thead>
        <tbody>
          {chart.labels.map((label, i) => (
            <tr key={label} className="border-b border-[var(--color-line)]">
              <td className="px-3 py-2 font-medium">{label}</td>
              <td className="px-3 py-2 text-center tabular-nums">
                {chart.values[i]}
              </td>
              <td className="px-3 py-2 text-center tabular-nums">
                {((chart.values[i] / total) * 100).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
