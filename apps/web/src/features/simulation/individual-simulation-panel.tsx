import { useEffect, useMemo, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { SimulationChartPanel } from "./simulation-chart";
import {
  buildGroupingOptions,
  SimulationParametersTable,
} from "./simulation-parameters-table";
import type { SimulationAreaType } from "@/stores/simulation-workspace";
import type {
  GainLossParam,
  GroupingParam,
  SimulationChart,
  SimulationSeat,
  TransferParam,
} from "@/queries/simulation";
import { useSeatDetail } from "@/queries/explore";
import { areaTypeToMapLevel } from "@/features/simulation/lib/simulation-scope";

function formatNum(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

type Props = {
  areaType: SimulationAreaType;
  mapCode: string;
  mapLabel: string;
  tovPct: number;
  onTovChange: (v: number) => void;
  parties: string[];
  partyTotals: Record<string, number>;
  gainloss: GainLossParam[];
  transfer: TransferParam[];
  grouping: GroupingParam | null;
  onGainLossChange: (group: string, pct: number) => void;
  onTransferChange: (from: string, to: string, pct: number) => void;
  onGroupingChange: (grouping: GroupingParam | null) => void;
  /** Debounced live re-run when params change */
  onLiveRun: () => void;
  running: boolean;
  seats: SimulationSeat[];
  chart: SimulationChart | null;
};

export function IndividualSimulationPanel({
  areaType,
  mapCode,
  mapLabel,
  tovPct,
  onTovChange,
  parties,
  partyTotals,
  gainloss,
  transfer,
  grouping,
  onGainLossChange,
  onTransferChange,
  onGroupingChange,
  onLiveRun,
  running,
  seats,
  chart,
}: Props) {
  const groupingOptions = buildGroupingOptions(parties);
  const seat = seats[0];
  const debounceRef = useRef<number | null>(null);
  const skipFirst = useRef(true);
  const seatDetail = useSeatDetail(
    mapCode || null,
    areaTypeToMapLevel(areaType),
    "normal",
  );

  useEffect(() => {
    if (!mapCode) return;
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    if (debounceRef.current) window.clearTimeout(debounceRef.current);
    debounceRef.current = window.setTimeout(() => {
      onLiveRun();
    }, 220);
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gainloss, transfer, grouping, tovPct, mapCode]);

  const majority = useMemo(() => {
    if (!seat?.simulation?.menang) return null;
    return seat.simulation.menang;
  }, [seat]);

  const detail = seatDetail.data;
  const headerTitle =
    detail
      ? `${areaType === "dun" ? "DUN" : "PARLIMEN"} ${detail.name.toUpperCase()} (${detail.displayCode || mapCode}), ${detail.state}`
      : mapLabel || mapCode;

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
        <div className="space-y-3">
          <div>
            <div className="text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
              Kawasan ({areaType === "parlimen" ? "Parlimen" : "DUN"})
            </div>
            <div className="mt-1 text-base font-semibold text-[var(--color-ink)]">
              {headerTitle}
            </div>
          </div>

          {detail && (
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <span className="text-xs uppercase text-[var(--color-ink-muted)]">
                  {areaType === "dun" ? "ADUN" : "Ahli Parlimen"}
                </span>
                <div className="font-semibold">{detail.member || "—"}</div>
              </div>
              <div>
                <span className="text-xs uppercase text-[var(--color-ink-muted)]">
                  Jumlah pengundi
                </span>
                <div className="font-semibold tabular-nums">
                  {formatNum(detail.electorate)}
                </div>
              </div>
              <div>
                <span className="text-xs uppercase text-[var(--color-ink-muted)]">
                  Majoriti
                </span>
                <div className="font-semibold tabular-nums">
                  {formatNum(detail.majority)} ({detail.majorityPercent}%)
                </div>
              </div>
              <div>
                <span className="text-xs uppercase text-[var(--color-ink-muted)]">
                  ToV asal
                </span>
                <div className="font-semibold tabular-nums">
                  {detail.turnout}%
                </div>
              </div>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-4 border-t border-[var(--color-line)] pt-3">
            <label className="flex items-center gap-2 text-sm">
              <span>TOV:</span>
              <Input
                type="number"
                className="h-8 w-16"
                value={tovPct}
                onChange={(e) => onTovChange(Number(e.target.value) || 0)}
              />
              <span>%</span>
            </label>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={!mapCode || running}
              onClick={onLiveRun}
            >
              {running ? "Mengira…" : "Kira Semula"}
            </Button>
          </div>
        </div>
      </div>

      {!mapCode ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          Buka satu kawasan Parlimen/DUN dari Explore untuk simulasi individu
          (Auto).
        </p>
      ) : (
        <>
          <SimulationParametersTable
            parties={parties}
            partyTotals={partyTotals}
            gainloss={gainloss}
            transfer={transfer}
            grouping={grouping}
            groupingOptions={groupingOptions}
            onGainLossChange={onGainLossChange}
            onTransferChange={onTransferChange}
            onGroupingChange={onGroupingChange}
            partyRows={seat?.parties}
          />

          <div className="grid gap-4 xl:grid-cols-2">
            <SimulationChartPanel chart={chart} title="Carta Simulasi" />
            <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
              <h3 className="mb-3 text-sm font-semibold text-[var(--color-ink-muted)]">
                Keputusan
              </h3>
              {majority?.group ? (
                <div className="space-y-3">
                  <div>
                    <div className="text-xs uppercase text-[var(--color-ink-muted)]">
                      Menang
                    </div>
                    <div className="text-2xl font-bold text-[var(--color-accent)]">
                      {majority.group}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-[var(--color-ink-muted)]">
                        Majoriti
                      </div>
                      <div className="font-semibold tabular-nums">
                        {formatNum(majority.majority ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-ink-muted)]">
                        TOV sim
                      </div>
                      <div className="font-semibold tabular-nums">
                        {seat?.simulation?.tov ?? 0}%
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-ink-muted)]">
                        Undi sim
                      </div>
                      <div className="font-semibold tabular-nums">
                        {formatNum(seat?.simulation?.total_votes ?? 0)}
                      </div>
                    </div>
                    <div>
                      <div className="text-xs text-[var(--color-ink-muted)]">
                        Perubahan undi
                      </div>
                      <div className="font-semibold tabular-nums">
                        {formatNum(seat?.simulation?.vote_change ?? 0)}
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-[var(--color-ink-muted)]">
                      Asal
                    </div>
                    <div className="text-sm">
                      {seat?.election_verdict.menang.group ?? "—"} · majoriti{" "}
                      {formatNum(seat?.election_verdict.menang.majority ?? 0)}
                    </div>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-ink-muted)]">
                  Laraskan parameter untuk melihat keputusan.
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
