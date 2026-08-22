import { useState } from "react";
import type { GroupSeat, SeatOverview } from "@/queries/explore";
import type { RingkasanArea } from "./lib/ringkasan-scope";
import {
  contrastText,
  resolveSeatColors,
} from "./lib/seat-chart-colors";

const VIEW_WIDTH = 520;
const VIEW_HEIGHT = 260;
const ROW_COUNT = 8;
const FLAT_GRID_ROW_COUNT = 3;
const DOT_RADIUS = 4.5;

type ViewMode = "coalition" | "party";

function allocateSeatsToRows(total: number, rowCount: number): number[] {
  if (total <= 0) return Array(rowCount).fill(0);

  const weights = Array.from({ length: rowCount }, (_, i) => i + 2);
  const weightSum = weights.reduce((a, b) => a + b, 0);
  const counts = weights.map((w) => Math.floor((total * w) / weightSum));
  let remainder = total - counts.reduce((a, b) => a + b, 0);

  for (let i = rowCount - 1; i >= 0 && remainder > 0; i--) {
    counts[i] += 1;
    remainder -= 1;
  }

  return counts;
}

type PartyRemaining = { color: string; remaining: number };

function initPartyQueue(groups: GroupSeat[]): PartyRemaining[] {
  return [...groups]
    .sort((a, b) => b.seats - a.seats)
    .map((g) => ({ color: g.color, remaining: g.seats }));
}

/**
 * Split one row left → right by remaining share (largest remainder).
 * Preserves exact global seat totals when called row-by-row.
 */
function allocateRowColorsLeftToRight(
  parties: PartyRemaining[],
  rowCapacity: number,
): string[] {
  const totalRemaining = parties.reduce((sum, p) => sum + p.remaining, 0);
  if (rowCapacity <= 0 || totalRemaining <= 0) return [];

  const active = parties.filter((p) => p.remaining > 0);
  const shares = active.map((party) => {
    const exact = (rowCapacity * party.remaining) / totalRemaining;
    const base = Math.floor(exact);
    return { party, base, fraction: exact - base };
  });

  let used = shares.reduce((sum, s) => sum + s.base, 0);
  let slotsLeft = rowCapacity - used;
  shares.sort((a, b) => b.fraction - a.fraction);
  for (let i = 0; i < slotsLeft; i++) {
    shares[i].base += 1;
  }

  const countByParty = new Map<PartyRemaining, number>();
  for (const share of shares) {
    countByParty.set(share.party, share.base);
  }

  const rowColors: string[] = [];
  for (const party of parties) {
    const count = countByParty.get(party) ?? 0;
    for (let i = 0; i < count; i++) {
      rowColors.push(party.color);
    }
    party.remaining -= count;
  }

  return rowColors;
}

/** Row-by-row left → right; each row mirrors nationwide proportional bands. */
function buildRowMajorSeatColors(
  groups: GroupSeat[],
  rowCapacities: number[],
): string[] {
  const total = groups.reduce((sum, g) => sum + g.seats, 0);
  if (total === 0) return [];

  const parties = initPartyQueue(groups);
  const colors: string[] = [];

  for (const rowCapacity of rowCapacities) {
    if (rowCapacity <= 0) continue;
    colors.push(...allocateRowColorsLeftToRight(parties, rowCapacity));
  }

  return colors;
}

function buildGroupedSemicircleLayout(groups: GroupSeat[]) {
  const total = groups.reduce((sum, g) => sum + g.seats, 0);
  if (total === 0) return [];

  const rowCounts = allocateSeatsToRows(total, ROW_COUNT);
  const rowCapacities: number[] = [];
  for (let row = ROW_COUNT - 1; row >= 0; row--) {
    if (rowCounts[row] > 0) rowCapacities.push(rowCounts[row]);
  }

  const colors = buildRowMajorSeatColors(groups, rowCapacities);

  const cx = VIEW_WIDTH / 2;
  const cy = VIEW_HEIGHT - 18;
  const innerR = 42;
  const outerR = Math.min(VIEW_WIDTH / 2 - DOT_RADIUS - 6, VIEW_HEIGHT - 72);
  const rowStep = (outerR - innerR) / Math.max(ROW_COUNT - 1, 1);
  const layout: Array<{ x: number; y: number; color: string }> = [];

  let colorIdx = 0;
  for (let row = ROW_COUNT - 1; row >= 0; row--) {
    const count = rowCounts[row];
    if (count <= 0) continue;

    const radius = innerR + row * rowStep;
    for (let col = 0; col < count; col++) {
      const t = count === 1 ? 0.5 : col / (count - 1);
      const angle = Math.PI * (1 - t);
      layout.push({
        x: cx + radius * Math.cos(angle),
        y: cy - radius * Math.sin(angle),
        color: colors[colorIdx++] || "#94a3b8",
      });
    }
  }

  return layout;
}

/** State/seat scope: exactly 3 rows, largest group first, left → right. */
function splitSeatsIntoThreeRows(total: number): number[] {
  const counts = [0, 0, 0];
  if (total <= 0) return counts;

  const perRow = Math.ceil(total / FLAT_GRID_ROW_COUNT);
  let left = total;
  for (let i = 0; i < FLAT_GRID_ROW_COUNT && left > 0; i++) {
    counts[i] = Math.min(perRow, left);
    left -= counts[i];
  }
  return counts;
}

/** Each of the 3 rows: largest group on the left, smaller groups on the right. */
function buildFlatThreeRowGrid(groups: GroupSeat[]): string[][] {
  const total = groups.reduce((sum, g) => sum + g.seats, 0);
  const rowSizes = splitSeatsIntoThreeRows(total);
  const parties = initPartyQueue(groups);

  return rowSizes.map((size) =>
    size > 0 ? allocateRowColorsLeftToRight(parties, size) : [],
  );
}

function SeatStats({ overview }: { overview: SeatOverview }) {
  return (
    <div className="mt-1 text-center">
      <div className="text-3xl font-semibold tabular-nums text-[var(--color-ink)]">
        {overview.totalSeats}
      </div>
      <p className="text-xs text-[var(--color-ink-muted)]">
        {overview.majorityRequired} required for majority
      </p>
    </div>
  );
}

function SeatLegend({ groups }: { groups: GroupSeat[] }) {
  const legendGroups = sortGroupsForLegend(groups);

  return (
    <div className="mt-3 flex flex-wrap justify-center gap-x-4 gap-y-3">
      {legendGroups.map((group) => (
        <div
          key={group.group}
          className="flex min-w-[3.5rem] flex-col items-center gap-1"
        >
          <div
            className="flex h-10 min-w-[3rem] items-center justify-center rounded px-2 text-sm font-bold tabular-nums"
            style={{
              backgroundColor: group.color,
              color: contrastText(group.color),
            }}
          >
            {group.seats}
          </div>
          <span className="text-[11px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
            {group.group}
          </span>
        </div>
      ))}
    </div>
  );
}

function FlatSeatGrid({
  overview,
  groups,
  mode,
}: {
  overview: SeatOverview;
  groups: GroupSeat[];
  mode: ViewMode;
}) {
  const rows = buildFlatThreeRowGrid(groups);
  const maxRowLen = Math.max(...rows.map((row) => row.length), 1);
  const rowWidthRem = maxRowLen * 1.375;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div
        className="mx-auto flex flex-col items-center gap-2"
        role="img"
        aria-label={`${overview.totalSeats} seats by ${mode}`}
      >
        {rows.map((row, rowIndex) => (
          <div
            key={rowIndex}
            className="flex justify-start gap-2"
            style={{ width: `${rowWidthRem}rem` }}
          >
            {row.map((color, colIndex) => (
              <span
                key={`${rowIndex}-${colIndex}`}
                className="block h-3.5 w-3.5 shrink-0 rounded-full"
                style={{ backgroundColor: color }}
              />
            ))}
          </div>
        ))}
      </div>

      <SeatStats overview={overview} />
      <SeatLegend groups={groups} />
    </div>
  );
}

function sortGroupsForLegend(groups: GroupSeat[]): GroupSeat[] {
  return [...groups].sort((a, b) => b.seats - a.seats);
}

function consolidateGroups(groups: GroupSeat[], maxGroups: number): GroupSeat[] {
  if (groups.length <= maxGroups) return groups;

  const sorted = [...groups].sort((a, b) => b.seats - a.seats);
  const top = sorted.slice(0, maxGroups - 1);
  const restSeats = sorted
    .slice(maxGroups - 1)
    .reduce((sum, g) => sum + g.seats, 0);

  top.push({
    group: "OTH",
    color: "#94a3b8",
    seats: restSeats,
  });

  return top;
}

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  const base =
    "rounded-md px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition-colors";
  const active = "bg-[var(--color-accent)] text-white";
  const inactive =
    "text-[var(--color-ink-muted)] hover:text-[var(--color-ink)]";

  return (
    <div
      className="inline-flex rounded-lg border border-[var(--color-line)] bg-white p-0.5"
      role="tablist"
      aria-label="Seat chart view"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "coalition"}
        className={`${base} ${mode === "coalition" ? active : inactive}`}
        onClick={() => onChange("coalition")}
      >
        Coalition
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "party"}
        className={`${base} ${mode === "party" ? active : inactive}`}
        onClick={() => onChange("party")}
      >
        Party
      </button>
    </div>
  );
}

function Hemicycle({
  overview,
  groups,
  mode,
}: {
  overview: SeatOverview;
  groups: GroupSeat[];
  mode: ViewMode;
}) {
  const dots = buildGroupedSemicircleLayout(groups);

  return (
    <div className="mx-auto w-full max-w-2xl">
      <svg
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        className="h-auto w-full"
        role="img"
        aria-label={`${overview.totalSeats} seats by ${mode}`}
      >
        {dots.map((dot, index) => (
          <circle
            key={index}
            cx={dot.x}
            cy={dot.y}
            r={DOT_RADIUS}
            fill={dot.color}
          />
        ))}
      </svg>

      <SeatStats overview={overview} />
      <SeatLegend groups={groups} />
    </div>
  );
}

type PartySeatsChartProps = {
  data?: SeatOverview;
  scopeArea?: RingkasanArea | string;
  subtitle?: string;
};

export function PartySeatsChart({
  data,
  scopeArea = "NEGARA",
  subtitle,
}: PartySeatsChartProps) {
  const [mode, setMode] = useState<ViewMode>("coalition");
  const useHemicycle = scopeArea === "NEGARA";

  if (!data || data.totalSeats === 0) {
    return (
      <div className="grid h-64 place-items-center text-sm text-[var(--color-ink-muted)]">
        No seat data
      </div>
    );
  }

  const rawGroups =
    mode === "coalition" ? data.byCoalition : data.byParty;
  const maxGroups = mode === "party" ? 10 : 7;
  const groups = resolveSeatColors(
    consolidateGroups(rawGroups, maxGroups),
  );

  if (groups.length === 0) {
    return (
      <div className="grid h-64 place-items-center text-sm text-[var(--color-ink-muted)]">
        No seat data
      </div>
    );
  }

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
            Seats by {mode === "coalition" ? "coalition" : "party"}
          </h3>
          <ViewToggle mode={mode} onChange={setMode} />
        </div>
        {subtitle ? (
          <p className="text-xs text-[var(--color-ink-muted)]">{subtitle}</p>
        ) : null}
      </div>

      {useHemicycle ? (
        <Hemicycle overview={data} groups={groups} mode={mode} />
      ) : (
        <FlatSeatGrid overview={data} groups={groups} mode={mode} />
      )}
    </>
  );
}
