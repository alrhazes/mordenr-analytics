import { List, Database, RotateCcw, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";
import { hasActiveMapFilters } from "./lib/map-filters";
import { SeatSearch } from "./seat-search";
import { MapFiltersPanel } from "./map-filters";

function PillGroup({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="inline-flex flex-wrap gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] p-1">
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wide transition ${
        active
          ? "bg-[var(--color-accent)] text-white shadow-sm"
          : "bg-transparent text-[var(--color-ink-muted)] hover:bg-white"
      }`}
    >
      {active && <Check className="h-3 w-3" />}
      {children}
    </button>
  );
}

export function MapControlBar() {
  const mapLevel = useExploreWorkspaceStore((s) => s.mapLevel);
  const presentation = useExploreWorkspaceStore((s) => s.presentation);
  const colorMode = useExploreWorkspaceStore((s) => s.colorMode);
  const filters = useExploreWorkspaceStore((s) => s.filters);
  const setMapLevel = useExploreWorkspaceStore((s) => s.setMapLevel);
  const setPresentation = useExploreWorkspaceStore((s) => s.setPresentation);
  const setColorMode = useExploreWorkspaceStore((s) => s.setColorMode);
  const resetAllFilters = useExploreWorkspaceStore((s) => s.resetAllFilters);
  const clearSearch = useExploreWorkspaceStore((s) => s.clearSearch);
  const setSenaraiOpen = useExploreWorkspaceStore((s) => s.setSenaraiOpen);
  const setInventoryOpen = useExploreWorkspaceStore((s) => s.setInventoryOpen);
  const setOps66DialogOpen = useExploreWorkspaceStore(
    (s) => s.setOps66DialogOpen,
  );

  const filtersActive = hasActiveMapFilters(filters);

  const selectLevel = (next: "parliament" | "dun" | "ops66") => {
    if (next === "ops66") {
      if (presentation === "ops66") return;
      setOps66DialogOpen(true);
      return;
    }
    if (presentation === "ops66") {
      setPresentation("normal");
    }
    clearSearch();
    setMapLevel(next);
  };

  return (
    <div className="space-y-4 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <SeatSearch />
        <div className="flex flex-wrap items-center gap-3 pt-6">
          <PillGroup>
            <Pill
              active={presentation === "normal" && mapLevel === "parliament"}
              onClick={() => selectLevel("parliament")}
            >
              Parlimen
            </Pill>
            <Pill
              active={presentation === "normal" && mapLevel === "dun"}
              onClick={() => selectLevel("dun")}
            >
              Dun
            </Pill>
            <Pill
              active={presentation === "ops66"}
              onClick={() => selectLevel("ops66")}
            >
              Ops 66
            </Pill>
          </PillGroup>
          <PillGroup>
            <Pill
              active={colorMode === "party"}
              onClick={() => setColorMode("party")}
            >
              Parti
            </Pill>
            <Pill
              active={colorMode === "group"}
              onClick={() => setColorMode("group")}
            >
              Gabungan
            </Pill>
          </PillGroup>
        </div>
      </div>

      <MapFiltersPanel />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setSenaraiOpen(true)}
          >
            <List className="h-3.5 w-3.5" />
            {mapLevel === "parliament" ? "Senarai Parlimen" : "Senarai Dun"}
          </Button>
          {filtersActive && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                resetAllFilters();
                clearSearch();
              }}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Semua
            </Button>
          )}
        </div>
        <button
          type="button"
          onClick={() => setInventoryOpen(true)}
          className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[var(--color-ink)]"
        >
          <span className="text-[var(--color-ink-muted)]">[</span>
          <Database className="h-5 w-5 text-[var(--color-accent)]" />
          Data Inventory
          <span className="text-[var(--color-ink-muted)]">]</span>
        </button>
      </div>
    </div>
  );
}
