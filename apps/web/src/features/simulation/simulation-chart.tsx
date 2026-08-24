import { useMemo } from "react";
import ReactECharts from "echarts-for-react";
import { BarChart3, Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SimulationChart } from "@/queries/simulation";

type Props = {
  title?: string;
  chart: SimulationChart | null;
  chartType?: "pie" | "bar";
  onChartTypeChange?: (type: "pie" | "bar") => void;
};

export function SimulationChartPanel({
  title = "Carta Simulasi",
  chart,
  chartType = "pie",
  onChartTypeChange,
}: Props) {
  const option = useMemo(() => {
    if (!chart || chart.labels.length === 0) return null;

    const data = chart.labels.map((name, i) => ({
      name,
      value: chart.values[i] ?? 0,
      itemStyle: { color: chart.colors[i] ?? "#94a3b8" },
    }));

    if (chartType === "bar") {
      return {
        tooltip: { trigger: "axis" },
        grid: { left: 40, right: 16, top: 24, bottom: 40 },
        xAxis: {
          type: "category",
          data: chart.labels,
          axisLabel: { rotate: 30, fontSize: 10 },
        },
        yAxis: { type: "value", minInterval: 1 },
        series: [
          {
            type: "bar",
            data: data.map((d) => ({ value: d.value, itemStyle: d.itemStyle })),
            label: { show: true, position: "top", fontSize: 11 },
          },
        ],
      };
    }

    return {
      tooltip: {
        trigger: "item",
        formatter: "{b}: {c} ({d}%)",
      },
      legend: {
        orient: "horizontal",
        bottom: 0,
        textStyle: { fontSize: 11 },
      },
      series: [
        {
          type: "pie",
          radius: ["42%", "72%"],
          center: ["50%", "46%"],
          label: {
            show: true,
            formatter: "{b}\n{c} ({d}%)",
            fontSize: 11,
          },
          data,
        },
      ],
    };
  }, [chart, chartType]);

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-[var(--color-ink-muted)]">
          {title}
        </h3>
        {onChartTypeChange && (
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant={chartType === "pie" ? "default" : "ghost"}
              onClick={() => onChartTypeChange("pie")}
              aria-label="Carta pai"
            >
              <Camera className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant={chartType === "bar" ? "default" : "ghost"}
              onClick={() => onChartTypeChange("bar")}
              aria-label="Carta bar"
            >
              <BarChart3 className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>
      {!option ? (
        <div className="grid h-[360px] place-items-center text-sm text-[var(--color-ink-muted)]">
          Jana simulasi untuk melihat carta
        </div>
      ) : (
        <ReactECharts
          option={option}
          style={{ height: 360, width: "100%" }}
          notMerge
          lazyUpdate
        />
      )}
    </div>
  );
}
