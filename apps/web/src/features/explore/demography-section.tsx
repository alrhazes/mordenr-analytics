import { useEffect, useMemo, useState } from "react";
import { ChevronRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { electoralAssetUrl } from "@/lib/electoral-assets";
import type { RingkasanScope } from "@/features/explore/lib/ringkasan-scope";
import {
  demographyMatchesScope,
  useDemographySummary,
  useDemographyTable,
  type DemographyScope,
  type DemographySegment,
} from "@/queries/demography";
import { DemographyChartCard } from "./demography-charts";
import { DemographyMajority } from "./demography-majority";
import { DemographyTable, type CellFilter } from "./demography-table";
import {
  VoterListDialog,
  scopeToVoterArea,
  segmentToFilter,
  type VoterListDialogState,
} from "./voter-list-dialog";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

function ringkasanToDemographyScope(scope: RingkasanScope): DemographyScope {
  return { area: scope.area, value: scope.value };
}

function scopesEqual(a: DemographyScope, b: DemographyScope) {
  return (
    a.area === b.area &&
    a.value.toUpperCase() === b.value.toUpperCase()
  );
}

type DemographySectionProps = {
  ringkasanScope: RingkasanScope;
  onOpenVoter: (ic: string) => void;
};

export function DemographySection({
  ringkasanScope,
  onOpenVoter,
}: DemographySectionProps) {
  const syncedScope = useMemo(
    () => ringkasanToDemographyScope(ringkasanScope),
    [ringkasanScope],
  );

  const [drillScope, setDrillScope] = useState<DemographyScope>(syncedScope);
  const [voterDialog, setVoterDialog] = useState<VoterListDialogState | null>(
    null,
  );

  useEffect(() => {
    setDrillScope(syncedScope);
  }, [syncedScope]);

  const summaryQuery = useDemographySummary(drillScope);
  const tableQuery = useDemographyTable(drillScope);

  const summaryMatches = demographyMatchesScope(summaryQuery.data, drillScope);
  const summaryData = summaryMatches ? summaryQuery.data : undefined;
  const tableData =
    tableQuery.data?.parentArea === drillScope.area &&
    (tableQuery.data?.parentValue || "").toUpperCase() ===
      (drillScope.value || "").toUpperCase()
      ? tableQuery.data
      : undefined;

  const pending =
    (summaryQuery.isLoading && !summaryQuery.isPlaceholderData) ||
    (summaryQuery.isFetching && !summaryMatches);

  const breadcrumbs = useMemo(() => {
    const items: Array<{ scope: DemographyScope; label: string }> = [
      { scope: { area: "NEGARA", value: "" }, label: "MALAYSIA" },
    ];

    if (drillScope.area === "NEGERI") {
      items.push({
        scope: { area: "NEGERI", value: drillScope.value },
        label: drillScope.value.toUpperCase(),
      });
    } else if (drillScope.area === "PARLIMEN") {
      const state = summaryData?.parent?.label;
      if (state && summaryData?.parent?.area === "NEGERI") {
        items.push({
          scope: { area: "NEGERI", value: summaryData.parent.value },
          label: state,
        });
      }
      items.push({
        scope: drillScope,
        label: summaryData?.areaLabel ?? drillScope.value.toUpperCase(),
      });
    } else if (drillScope.area === "DUN" || drillScope.area === "DM") {
      if (summaryData?.parent) {
        items.push({
          scope: {
            area: summaryData.parent.area,
            value: summaryData.parent.value,
          },
          label: summaryData.parent.label,
        });
      }
      items.push({
        scope: drillScope,
        label: summaryData?.areaLabel ?? drillScope.value.toUpperCase(),
      });
    }

    return items;
  }, [drillScope, summaryData]);

  function openVotersFromChart(
    chart: "race" | "age" | "gender",
    segment: DemographySegment,
  ) {
    const filter = segmentToFilter(chart, segment.key);
    setVoterDialog({
      area: scopeToVoterArea(drillScope),
      ...filter,
      title: `${summaryData?.areaLabel ?? drillScope.area} · ${segment.label}`,
    });
  }

  function openVotersFromCell(filter: CellFilter) {
    setVoterDialog({
      area: filter.area,
      filterKind: filter.filterKind,
      filterKey: filter.filterKey,
      title: `${summaryData?.areaLabel ?? drillScope.area}${
        filter.label ? ` · ${filter.label}` : ""
      }`,
    });
  }

  function openVotersForScope() {
    setVoterDialog({
      area: scopeToVoterArea(drillScope),
      title:
        summaryData?.areaLabel ??
        (drillScope.area === "NEGARA"
          ? "SELURUH NEGARA"
          : drillScope.value.toUpperCase()),
    });
  }

  const headerIcon = electoralAssetUrl("logo/demography.png");

  return (
    <>
      <section className="rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-sm sm:p-5">
        <div className="border-b border-[var(--color-line)] pb-4">
          <div className="flex flex-wrap items-center gap-3">
            <img
              src={headerIcon}
              alt=""
              className="h-8 w-8 object-contain"
            />
            <div>
              <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--color-ink)] sm:text-2xl">
                Demografi
              </h2>
              {pending && !summaryData ? (
                <Skeleton className="mt-2 h-5 w-48" />
              ) : (
                <p className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
                  {summaryData?.areaLabel ??
                    (drillScope.area === "NEGARA"
                      ? "SELURUH NEGARA"
                      : drillScope.value.toUpperCase())}
                </p>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={openVotersForScope}
            className="mt-3 inline-flex items-center gap-2 rounded-lg bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-ink)] transition-colors hover:bg-[var(--color-accent-soft)]"
          >
            <span className="text-[var(--color-ink-muted)]">
              Jumlah Pengundi Berdaftar
            </span>
            <span className="font-semibold tabular-nums text-[var(--color-accent)]">
              {pending && !summaryData ? (
                "…"
              ) : (
                formatNumber(summaryData?.totalVoters ?? 0)
              )}
            </span>
          </button>
        </div>

        {summaryQuery.error ? (
          <p className="mt-4 rounded-lg border border-[var(--color-danger)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
            Failed to load demography: {(summaryQuery.error as Error).message}
          </p>
        ) : null}

        <div className="mt-5 grid gap-4 lg:grid-cols-3 lg:items-stretch">
          <DemographyChartCard
            title="Kaum"
            segments={summaryData?.segments.race ?? []}
            isLoading={pending}
            onSegmentClick={(segment) => openVotersFromChart("race", segment)}
          />

          <DemographyChartCard
            title="Umur"
            segments={summaryData?.segments.age ?? []}
            isLoading={pending}
            onSegmentClick={(segment) => openVotersFromChart("age", segment)}
          />

          <DemographyChartCard
            title="Jantina"
            segments={summaryData?.segments.gender ?? []}
            isLoading={pending}
            onSegmentClick={(segment) =>
              openVotersFromChart("gender", segment)
            }
          />
        </div>

        <div className="mt-6 border-t border-[var(--color-line)] pt-5">
          <h3 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
            Rumusan Majoriti Kawasan
          </h3>
          <div className="mt-3">
            <DemographyMajority
              total={
                (tableData?.malayMajority ?? 0) +
                (tableData?.nonMalayMajority ?? 0)
              }
              malayMajority={
                tableData?.malayMajority ?? summaryData?.malayMajority ?? 0
              }
              nonMalayMajority={
                tableData?.nonMalayMajority ?? summaryData?.nonMalayMajority ?? 0
              }
            />
          </div>
        </div>

        <div className="mt-6 space-y-3 border-t border-[var(--color-line)] pt-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h3 className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)]">
                {tableData?.tableTitle ?? summaryData?.tableTitle ?? "Senarai Demografi"}
              </h3>
              {tableData ? (
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  Paparan {tableData.childAreaLabel.toLowerCase()} ·{" "}
                  {tableData.rows.length} rekod
                </p>
              ) : null}
            </div>

            <nav
              aria-label="Navigasi demografi"
              className="flex flex-wrap items-center gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-2 py-1.5 text-xs"
            >
              {breadcrumbs.map((item, index) => (
                <span
                  key={`${item.scope.area}-${item.scope.value}`}
                  className="flex items-center gap-1"
                >
                  {index > 0 ? (
                    <ChevronRight className="h-3.5 w-3.5 text-[var(--color-ink-muted)]" />
                  ) : null}
                  {!scopesEqual(item.scope, drillScope) ? (
                    <button
                      type="button"
                      onClick={() => setDrillScope(item.scope)}
                      className="rounded px-1.5 py-0.5 font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-soft)]"
                    >
                      {item.label}
                    </button>
                  ) : (
                    <span className="rounded bg-[var(--color-accent-soft)] px-1.5 py-0.5 font-semibold text-[var(--color-accent)]">
                      {item.label}
                    </span>
                  )}
                </span>
              ))}
            </nav>
          </div>

          <DemographyTable
            data={tableData}
            scope={drillScope}
            isLoading={tableQuery.isLoading && !tableQuery.isPlaceholderData}
            onDrillDown={setDrillScope}
            onOpenVoters={openVotersFromCell}
          />
        </div>
      </section>

      <VoterListDialog
        state={voterDialog}
        onClose={() => setVoterDialog(null)}
        onSelectVoter={(ic) => {
          setVoterDialog(null);
          onOpenVoter(ic);
        }}
      />
    </>
  );
}
