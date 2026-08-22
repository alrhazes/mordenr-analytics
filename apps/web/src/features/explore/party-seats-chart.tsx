import { useState } from "react";
import type { GroupSeat, SeatOverview } from "@/queries/explore";
import {
  contrastText,
  resolveSeatColors,
} from "./lib/seat-chart-colors";

const VIEW_WIDTH = 520;
const VIEW_HEIGHT = 260;
const ROW_COUNT = 8;
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

/** Cumulative left→right share of the semicircle (same on every arc row). */
function buildPartySegments(groups: GroupSeat[], total: number) {
  const sorted = [...groups].sort((a, b) => b.seats - a.seats);
  let cumulative = 0;

  return sorted.map((group) => {
    cumulative += group.seats / total;
    return { end: cumulative, color: group.color };
  });
}

function colorAtFraction(
  t: number,
  segments: Array<{ end: number; color: string }>,
): string {
  for (const segment of segments) {
    if (t <= segment.end) return segment.color;
  }
  return segments[segments.length - 1]?.color || "#94a3b8";
}

/**
 * Each arc row is filled left → right (bottom/back row first) using the same
 * proportional party slices, so blocks align horizontally across rows.
 */
function buildGroupedSemicircleLayout(groups: GroupSeat[]) {
  const total = groups.reduce((sum, g) => sum + g.seats, 0);
  if (total === 0) return [];

  const segments = buildPartySegments(groups, total);

  const cx = VIEW_WIDTH / 2;
  const cy = VIEW_HEIGHT - 18;
  const innerR = 42;
  const outerR = Math.min(VIEW_WIDTH / 2 - DOT_RADIUS - 6, VIEW_HEIGHT - 72);
  const rowStep = (outerR - innerR) / Math.max(ROW_COUNT - 1, 1);
  const rowCounts = allocateSeatsToRows(total, ROW_COUNT);
  const layout: Array<{ x: number; y: number; color: string }> = [];

  // Bottom/back arc first, then each row left → right from angle π (left) to 0 (right).
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
        color: colorAtFraction(t, segments),
      });
    }
  }

  return layout;
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
  const legendGroups = sortGroupsForLegend(groups);

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

        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 96}
          textAnchor="middle"
          fill="var(--color-ink, #0b1f33)"
          style={{ fontSize: 28, fontWeight: 600 }}
        >
          {overview.totalSeats}
        </text>
        <text
          x={VIEW_WIDTH / 2}
          y={VIEW_HEIGHT - 74}
          textAnchor="middle"
          fill="#5a6e82"
          style={{ fontSize: 12 }}
        >
          {overview.majorityRequired} required for majority
        </text>
      </svg>

      <div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-3">
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
    </div>
  );
}

type PartySeatsChartProps = {
  data?: SeatOverview;
  subtitle?: string;
};

export function PartySeatsChart({ data, subtitle }: PartySeatsChartProps) {
  const [mode, setMode] = useState<ViewMode>("coalition");

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

      <Hemicycle overview={data} groups={groups} mode={mode} />
    </>
  );
}
