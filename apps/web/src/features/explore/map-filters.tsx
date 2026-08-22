import { useMemo } from "react";
import { MapPin, RotateCcw } from "lucide-react";
import { useFilterOptions } from "@/queries/explore";
import {
  useExploreWorkspaceStore,
  type MapLevel,
} from "@/stores/explore-workspace";
import {
  buildMajorityOptions,
  buildTurnoutOptions,
} from "./lib/map-filters";

const selectClass =
  "h-9 w-full rounded-md border border-[var(--color-line)] bg-white px-2 text-xs outline-none focus:ring-2 focus:ring-[var(--color-accent)]";

function FilterField({
  label,
  value,
  onChange,
  onReset,
  children,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onReset: () => void;
  children: React.ReactNode;
}) {
  const active = value !== "" && value !== "0";
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between gap-1">
        <span className="truncate text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
          {label}
        </span>
        <button
          type="button"
          title="Reset"
          className={`rounded p-0.5 ${active ? "text-[var(--color-accent)]" : "text-[var(--color-ink-muted)]/50"}`}
          onClick={onReset}
        >
          <RotateCcw className="h-3 w-3" />
        </button>
      </div>
      <select
        className={selectClass}
        value={value === "" ? "0" : value}
        onChange={(e) => onChange(e.target.value)}
      >
        {children}
      </select>
    </div>
  );
}

export function MapFiltersPanel() {
  const mapLevel = useExploreWorkspaceStore((s) => s.mapLevel);
  const presentation = useExploreWorkspaceStore((s) => s.presentation);
  const filters = useExploreWorkspaceStore((s) => s.filters);
  const setFilterField = useExploreWorkspaceStore((s) => s.setFilterField);
  const options = useFilterOptions(mapLevel, presentation);

  const prefix = mapLevel === "parliament" ? "PARLIMEN" : "DUN";
  const majorityOpts = useMemo(() => buildMajorityOptions(), []);
  const turnoutOpts = useMemo(() => buildTurnoutOptions(), []);

  const majoritySelectValue =
    filters.majority.value === "0" || !filters.majority.mode
      ? "0"
      : `${filters.majority.mode}:${filters.majority.value}`;

  return (
    <div className="rounded-lg border border-dashed border-[var(--color-line)] bg-[var(--color-bg)]/60 p-3">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
        <MapPin className="h-4 w-4 text-[var(--color-accent)]" />
        {mapLevel === "parliament" ? "Parlimen Map Filters" : "Dun Map Filters"}
      </h4>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <FilterField
          label={`${prefix}-NEGERI`}
          value={filters.state || "0"}
          onChange={(v) =>
            setFilterField("state", v === "0" ? "" : v.toUpperCase())
          }
          onReset={() => setFilterField("state", "")}
        >
          <option value="0">{prefix}-NEGERI</option>
          {(options.data?.states || []).map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </FilterField>

        <FilterField
          label={`${prefix}-MAJORITI`}
          value={majoritySelectValue}
          onChange={(v) => {
            if (v === "0") {
              setFilterField("majority", { value: "0", mode: null });
              return;
            }
            const [mode, value] = v.split(":");
            setFilterField("majority", {
              value,
              mode: mode as "kurang" | "lebih",
            });
          }}
          onReset={() =>
            setFilterField("majority", { value: "0", mode: null })
          }
        >
          <option value="0">{prefix}-MAJORITI</option>
          {majorityOpts.map((o) => (
            <option key={`${o.mode}:${o.value}`} value={`${o.mode}:${o.value}`}>
              {o.label}
            </option>
          ))}
        </FilterField>

        <FilterField
          label={`${prefix}-TURNOUT`}
          value={filters.turnout || "0"}
          onChange={(v) => setFilterField("turnout", v)}
          onReset={() => setFilterField("turnout", "0")}
        >
          <option value="0">{prefix}-TURNOUT</option>
          {turnoutOpts.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </FilterField>

        <FilterField
          label={`${prefix}-GABUNGAN`}
          value={filters.group || "0"}
          onChange={(v) => setFilterField("group", v)}
          onReset={() => setFilterField("group", "0")}
        >
          <option value="0">{prefix}-GABUNGAN</option>
          {(options.data?.groups || []).map((g) => (
            <option key={g} value={g}>
              {g}
            </option>
          ))}
        </FilterField>

        <FilterField
          label={`${prefix}-PARTI`}
          value={filters.party || "0"}
          onChange={(v) => setFilterField("party", v)}
          onReset={() => setFilterField("party", "0")}
        >
          <option value="0">{prefix}-PARTI</option>
          {(options.data?.parties || []).map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </FilterField>

        <FilterField
          label={`${prefix}-KERAJAAN`}
          value={filters.government || "0"}
          onChange={(v) => setFilterField("government", v)}
          onReset={() => setFilterField("government", "0")}
        >
          <option value="0">{prefix}-KERAJAAN</option>
          <option value="ya">KERAJAAN</option>
          <option value="tidak">BUKAN KERAJAAN</option>
        </FilterField>
      </div>
    </div>
  );
}

export function levelLabel(level: MapLevel) {
  return level === "parliament" ? "Parlimen" : "Dun";
}
