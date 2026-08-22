import ReactECharts from "echarts-for-react";
import type { PartySeat } from "@/queries/explore";

export function PartySeatsChart({ data }: { data: PartySeat[] }) {
  const option = {
    grid: { left: 8, right: 12, top: 8, bottom: 28, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
    xAxis: {
      type: "value",
      axisLabel: { color: "#5a6e82" },
      splitLine: { lineStyle: { color: "#e6edf4" } },
    },
    yAxis: {
      type: "category",
      data: data.map((d) => d.party).reverse(),
      axisLabel: { color: "#0b1f33", fontSize: 11 },
      axisTick: { show: false },
      axisLine: { show: false },
    },
    series: [
      {
        type: "bar",
        data: data
          .map((d) => ({
            value: d.seats,
            itemStyle: { color: d.color, borderRadius: [0, 4, 4, 0] },
          }))
          .reverse(),
        barWidth: 14,
      },
    ],
  };

  if (data.length === 0) {
    return (
      <div className="grid h-64 place-items-center text-sm text-[var(--color-ink-muted)]">
        No party seat data
      </div>
    );
  }

  return (
    <ReactECharts
      option={option}
      style={{ height: 280, width: "100%" }}
      opts={{ renderer: "canvas" }}
      notMerge
    />
  );
}
