import type { ExploreRingkasanStat, ExploreSummary } from "@/queries/explore";
import { Skeleton } from "@/components/ui/skeleton";
import { PartySeatsChart } from "./party-seats-chart";
import { CoalitionBreakdown } from "./coalition-breakdown";
import { PartyMembershipSection } from "./party-membership-section";
import type { MapLevel, Presentation } from "@/stores/explore-workspace";

function formatStatValue(id: string, value: string | number) {
  if (typeof value === "string") return value;
  if (id === "turnout") return `${value}%`;
  if (id === "majority") {
    return new Intl.NumberFormat("en-MY").format(value);
  }
  if (id === "spoilt") return String(value);
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 10_000) {
    return new Intl.NumberFormat("en-MY").format(value);
  }
  return new Intl.NumberFormat("en-MY").format(value);
}

function StatCard({ stat }: { stat: ExploreRingkasanStat }) {
  return (
    <div
      className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5 shadow-sm"
      role="listitem"
    >
      <div className="text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
        {stat.label}
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <div className="text-2xl font-semibold tabular-nums leading-none text-[var(--color-ink)]">
          {formatStatValue(stat.id, stat.value)}
        </div>
        {stat.subValue ? (
          <div className="text-sm font-medium tabular-nums text-[var(--color-ink-muted)]">
            {stat.subValue}
          </div>
        ) : null}
      </div>
    </div>
  );
}

type ElectionStatusSummaryProps = {
  data?: ExploreSummary;
  areaLabel: string;
  isLoading: boolean;
  isFetching?: boolean;
  error?: Error | null;
  mapLevel: MapLevel;
  presentation: Presentation;
};

export function ElectionStatusSummary({
  data,
  areaLabel,
  isLoading,
  isFetching = false,
  error = null,
  mapLevel,
  presentation,
}: ElectionStatusSummaryProps) {
  const stats = data?.stats || [];
  const chartSubtitle = [
    data?.election || "GE15",
    presentation === "ops66" ? "OPS66" : null,
    areaLabel,
    mapLevel === "dun" ? "DUN" : "Parlimen",
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <section
      className={`rounded-2xl border border-[var(--color-line)] bg-white p-4 shadow-sm transition-opacity sm:p-5 ${isFetching ? "opacity-70" : ""}`}
    >
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[var(--color-line)] pb-4">
        <div>
          <h2 className="font-[family-name:var(--font-display)] text-xl text-[var(--color-ink)] sm:text-2xl">
            Status Pilihanraya Terkini
          </h2>
          <p className="mt-1 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-accent)]">
            {areaLabel}
          </p>
        </div>
        <p className="text-xs text-[var(--color-ink-muted)]">
          Ringkasan keputusan · {chartSubtitle}
        </p>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-[var(--color-danger)]/30 bg-red-50 px-3 py-2 text-sm text-[var(--color-danger)]">
          Failed to load summary: {error.message}
        </p>
      ) : null}

      <div
        className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
        role="list"
      >
        {isLoading && stats.length === 0
          ? Array.from({ length: 9 }).map((_, i) => (
              <Skeleton key={i} className="h-[88px] rounded-xl" />
            ))
          : stats.map((stat) => <StatCard key={stat.id} stat={stat} />)}
      </div>

      <div className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
            Seats by party
          </h3>
          <p className="text-xs text-[var(--color-ink-muted)]">{chartSubtitle}</p>
        </div>
        {isLoading && !data?.partySeats?.length ? (
          <Skeleton className="mt-3 h-64 rounded-lg" />
        ) : (
          <div className="mt-2">
            <PartySeatsChart data={data?.partySeats || []} />
          </div>
        )}
      </div>

      <CoalitionBreakdown
        breakdown={data?.breakdown}
        isLoading={isLoading}
      />

      <PartyMembershipSection
        chips={data?.votersParty}
        isLoading={isLoading}
      />
    </section>
  );
}
