import type { GainLossParam, GroupingParam, TransferParam } from "@/queries/simulation";
import { electoralAssetUrl } from "@/lib/electoral-assets";

type PartySimRow = {
  group: string;
  party: string;
  vote_won: number;
  sim_vote_won?: number;
  sim_vote_diff?: number;
};

type Props = {
  parties: string[];
  partyTotals: Record<string, number>;
  gainloss: GainLossParam[];
  transfer: TransferParam[];
  grouping: GroupingParam | null;
  groupingOptions: GroupingParam[];
  onGainLossChange: (group: string, pct: number) => void;
  onTransferChange: (from: string, to: string, pct: number) => void;
  onGroupingChange: (grouping: GroupingParam | null) => void;
  /** When set (Auto individual), show SIMULASI UNDI AKHIR / PERUBAHAN columns */
  partyRows?: PartySimRow[];
};

function pctValue(arr: GainLossParam[], group: string) {
  return arr.find((g) => g.group === group)?.pct ?? 0;
}

function transferValue(arr: TransferParam[], from: string, to: string) {
  return arr.find((t) => t.from === from && t.to === to)?.pct ?? 0;
}

function inputClass(value: number) {
  if (value > 0) return "border-emerald-300 bg-emerald-50";
  if (value < 0) return "border-rose-300 bg-rose-50";
  return "border-[var(--color-line)] bg-white";
}

export function SimulationParametersTable({
  parties,
  partyTotals,
  gainloss,
  transfer,
  grouping,
  groupingOptions,
  onGainLossChange,
  onTransferChange,
  onGroupingChange,
  partyRows,
}: Props) {
  const sortedParties = [...parties].sort((a, b) => {
    const ai = parties.indexOf(a);
    const bi = parties.indexOf(b);
    return ai - bi;
  });

  const simByParty = new Map(
    (partyRows ?? []).map((r) => [r.group || r.party, r]),
  );
  const showSimColumns = Boolean(partyRows?.length);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="rounded-md bg-[var(--color-accent)] px-3 py-1.5 text-xs font-bold text-white">
          {grouping?.label || "TIADA GABUNGAN"}
        </div>
        <select
          className="h-9 rounded-md border border-[var(--color-line)] bg-white px-3 text-sm"
          value={grouping ? `${grouping.members.join(",")}` : ""}
          onChange={(e) => {
            const val = e.target.value;
            if (!val) {
              onGroupingChange(null);
              return;
            }
            const found = groupingOptions.find(
              (g) => g.members.join(",") === val,
            );
            onGroupingChange(found ?? null);
          }}
        >
          <option value="">TIADA GABUNGAN</option>
          {groupingOptions.map((g) => (
            <option key={g.label} value={g.members.join(",")}>
              {g.label}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-xl border border-[var(--color-line)] bg-white">
        <table className="min-w-full text-xs">
          <thead>
            <tr className="border-b border-[var(--color-line)] bg-[var(--color-bg)]">
              <th className="px-3 py-2 text-left">PARTI</th>
              <th className="px-3 py-2 text-right">JUMLAH UNDI ASAL</th>
              <th className="px-3 py-2 text-center">GAIN/LOSS %</th>
              {sortedParties.map((p) => (
                <th key={`to-${p}`} className="px-2 py-2 text-center whitespace-nowrap">
                  % {p} →
                </th>
              ))}
              {showSimColumns && (
                <>
                  <th className="px-3 py-2 text-right">SIMULASI UNDI AKHIR</th>
                  <th className="px-3 py-2 text-right">PERUBAHAN</th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {sortedParties.map((party) => (
              <tr key={party} className="border-b border-[var(--color-line)]/60">
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2 font-semibold">
                    <img
                      src={electoralAssetUrl(`parties/${party.toLowerCase()}.png`)}
                      alt=""
                      className="h-7 w-7 rounded border border-[var(--color-line)] bg-white object-contain p-0.5"
                      onError={(e) => {
                        e.currentTarget.src = electoralAssetUrl("parties/ind.png");
                      }}
                    />
                    {party}
                  </div>
                </td>
                <td className="px-3 py-2 text-right font-bold tabular-nums">
                  {new Intl.NumberFormat("en-MY").format(partyTotals[party] ?? 0)}
                </td>
                <td className="px-3 py-2 text-center">
                  <input
                    type="number"
                    min={-100}
                    max={100}
                    className={`w-16 rounded border px-2 py-1 text-center tabular-nums ${inputClass(pctValue(gainloss, party))}`}
                    value={pctValue(gainloss, party)}
                    onChange={(e) =>
                      onGainLossChange(party, Number(e.target.value) || 0)
                    }
                  />
                </td>
                {sortedParties.map((to) => (
                  <td key={`${party}-${to}`} className="px-2 py-2 text-center">
                    <input
                      type="number"
                      min={-100}
                      max={100}
                      disabled={party === to}
                      className={`w-16 rounded border px-2 py-1 text-center tabular-nums disabled:opacity-40 ${inputClass(transferValue(transfer, party, to))}`}
                      value={transferValue(transfer, party, to)}
                      onChange={(e) =>
                        onTransferChange(party, to, Number(e.target.value) || 0)
                      }
                    />
                  </td>
                ))}
                {showSimColumns && (
                  <>
                    <td className="px-3 py-2 text-right font-bold tabular-nums">
                      {new Intl.NumberFormat("en-MY").format(
                        simByParty.get(party)?.sim_vote_won ??
                          partyTotals[party] ??
                          0,
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {(() => {
                        const row = simByParty.get(party);
                        const diff =
                          row?.sim_vote_diff ??
                          (row?.sim_vote_won != null
                            ? row.sim_vote_won - (row.vote_won || 0)
                            : 0);
                        return (
                          <span
                            className={
                              diff > 0
                                ? "text-emerald-700"
                                : diff < 0
                                  ? "text-rose-700"
                                  : ""
                            }
                          >
                            {diff > 0 ? "+" : ""}
                            {new Intl.NumberFormat("en-MY").format(diff)}
                          </span>
                        );
                      })()}
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function buildGroupingOptions(parties: string[]): GroupingParam[] {
  const top = parties.slice(0, 5);
  const options: GroupingParam[] = [];
  for (let i = 0; i < top.length; i++) {
    for (let j = i + 1; j < top.length; j++) {
      const a = top[i];
      const b = top[j];
      options.push({ label: `${a} + ${b}`, members: [a, b] });
    }
  }
  return options;
}
