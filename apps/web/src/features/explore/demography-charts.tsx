import { useCallback, useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import type { DemographySegment } from "@/queries/demography";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

function formatCompact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1_000)}K`;
  return formatNumber(n);
}

type DemographyChartCardProps = {
  title: string;
  segments: DemographySegment[];
  isLoading?: boolean;
  onSegmentClick?: (segment: DemographySegment) => void;
};

function buildPieOption(
  segments: DemographySegment[],
  total: number,
  highlightedIndex: number | null,
) {
  return {
    animationDuration: 400,
    tooltip: {
      trigger: "item",
      backgroundColor: "#0b1f33",
      borderWidth: 0,
      padding: [10, 14],
      textStyle: { color: "#fff", fontSize: 12 },
      formatter: (params: {
        name: string;
        value: number;
        percent: number;
        dataIndex: number;
      }) => {
        const segment = segments[params.dataIndex];
        return [
          `<strong>${params.name}</strong>`,
          `${formatNumber(params.value)} pengundi`,
          `${segment?.percent ?? params.percent.toFixed(1)}%`,
          `<span style="opacity:0.75;font-size:11px">Klik untuk senarai</span>`,
        ].join("<br/>");
      },
    },
    series: [
      {
        type: "pie",
        radius: ["52%", "78%"],
        center: ["50%", "50%"],
        minAngle: 4,
        padAngle: 1.5,
        avoidLabelOverlap: true,
        label: { show: false },
        labelLine: { show: false },
        emphasis: {
          scale: true,
          scaleSize: 8,
          itemStyle: {
            shadowBlur: 14,
            shadowColor: "rgba(11, 31, 51, 0.18)",
          },
        },
        itemStyle: {
          borderColor: "#fff",
          borderWidth: 2,
          opacity: highlightedIndex === null ? 1 : 0.35,
        },
        data: segments.map((segment, index) => ({
          name: segment.label,
          value: segment.count,
          itemStyle: {
            color: segment.color,
            opacity:
              highlightedIndex === null || highlightedIndex === index
                ? 1
                : 0.28,
          },
        })),
      },
    ],
    graphic:
      total > 0
        ? [
            {
              type: "text",
              left: "center",
              top: "42%",
              style: {
                text: formatCompact(total),
                fill: "#0b1f33",
                fontSize: 20,
                fontWeight: 700,
                fontFamily: "DM Sans, sans-serif",
                textAlign: "center" as const,
              },
            },
            {
              type: "text",
              left: "center",
              top: "54%",
              style: {
                text: "pengundi",
                fill: "#5a6e82",
                fontSize: 11,
                fontWeight: 500,
                fontFamily: "DM Sans, sans-serif",
                textAlign: "center" as const,
              },
            },
          ]
        : [],
  };
}

export function DemographyChartCard({
  title,
  segments,
  isLoading = false,
  onSegmentClick,
}: DemographyChartCardProps) {
  const [highlightedIndex, setHighlightedIndex] = useState<number | null>(null);

  const total = useMemo(
    () => segments.reduce((sum, segment) => sum + segment.count, 0),
    [segments],
  );

  const option = useMemo(
    () => buildPieOption(segments, total, highlightedIndex),
    [segments, total, highlightedIndex],
  );

  const highlightSegment = useCallback((index: number | null) => {
    setHighlightedIndex(index);
  }, []);

  const handleChartClick = useCallback(
    (index: number) => {
      const segment = segments[index];
      if (segment && segment.count > 0) {
        onSegmentClick?.(segment);
      }
    },
    [onSegmentClick, segments],
  );

  const hasData = segments.some((segment) => segment.count > 0);

  return (
    <div className="flex h-full min-w-0 flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-sm">
      <div className="border-b border-[var(--color-line)] px-4 py-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--color-ink)]">
              {title}
            </h4>
            <p className="mt-0.5 text-[11px] text-[var(--color-ink-muted)]">
              Klik carta atau baris → senarai pengundi
            </p>
          </div>
          {!isLoading && hasData ? (
            <span className="shrink-0 rounded-full bg-[var(--color-accent-soft)] px-2 py-0.5 text-[10px] font-medium text-[var(--color-accent)]">
              {segments.length} kategori
            </span>
          ) : null}
        </div>
      </div>

      <div className="relative h-[168px] shrink-0 sm:h-[180px]">
        {isLoading ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-muted)]">
            Memuatkan…
          </div>
        ) : !hasData ? (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-ink-muted)]">
            Tiada data
          </div>
        ) : (
          <ReactECharts
            option={option}
            style={{ height: "100%", width: "100%" }}
            opts={{ renderer: "canvas" }}
            className="cursor-pointer"
            onEvents={{
              click: (params: { dataIndex?: number }) => {
                const index = params.dataIndex ?? -1;
                if (index >= 0) handleChartClick(index);
              },
              mouseover: (params: { dataIndex?: number }) => {
                const index = params.dataIndex ?? -1;
                if (index >= 0) highlightSegment(index);
              },
              mouseout: () => highlightSegment(null),
            }}
          />
        )}
      </div>

      {!isLoading && hasData ? (
        <ul className="flex flex-1 flex-col gap-1 border-t border-[var(--color-line)] bg-[var(--color-bg)]/50 p-2.5">
          {segments.map((segment, index) => {
            const isActive = highlightedIndex === index;
            const barWidth =
              total > 0 ? Math.max(4, (segment.count / total) * 100) : 0;

            return (
              <li key={segment.key}>
                <button
                  type="button"
                  disabled={segment.count <= 0}
                  onMouseEnter={() => highlightSegment(index)}
                  onMouseLeave={() => highlightSegment(null)}
                  onFocus={() => highlightSegment(index)}
                  onBlur={() => highlightSegment(null)}
                  onClick={() => handleChartClick(index)}
                  className={`group w-full rounded-lg px-2.5 py-2 text-left transition-colors ${
                    segment.count > 0
                      ? "cursor-pointer hover:bg-[var(--color-accent-soft)] focus-visible:bg-[var(--color-accent-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]/40"
                      : "cursor-default opacity-50"
                  } ${isActive ? "bg-[var(--color-accent-soft)]" : ""}`}
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-white"
                      style={{ backgroundColor: segment.color }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[var(--color-ink)]">
                      {segment.label}
                    </span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-[var(--color-accent)]">
                      {segment.roundedPercent}%
                    </span>
                    <span className="hidden shrink-0 text-[13px] tabular-nums font-semibold text-[var(--color-ink)] sm:inline">
                      {formatNumber(segment.count)}
                    </span>
                  </div>

                  <div className="mt-1.5 flex items-center gap-2 pl-4">
                    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--color-line)]">
                      <div
                        className="h-full rounded-full transition-[width]"
                        style={{
                          width: `${barWidth}%`,
                          backgroundColor: segment.color,
                        }}
                      />
                    </div>
                    <span className="shrink-0 text-[11px] tabular-nums text-[var(--color-ink-muted)] sm:hidden">
                      {formatCompact(segment.count)}
                    </span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

/** @deprecated Use DemographyChartCard */
export const DemographyChart = DemographyChartCard;
