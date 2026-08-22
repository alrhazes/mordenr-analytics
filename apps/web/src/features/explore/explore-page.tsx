import { useEffect, useMemo, useRef, startTransition } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useExploreGeo,
  useExploreSummary,
} from "@/queries/explore";
import { useSavedView } from "@/queries/library";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { ExploreMap } from "./explore-map";
import { PartySeatsChart } from "./party-seats-chart";
import { ConstituencySheet } from "./constituency-sheet";
import { MapControlBar } from "./map-control-bar";
import { SeatListDialog } from "./seat-list-dialog";
import { DataInventoryDialog } from "./data-inventory-dialog";
import { Ops66PasswordDialog } from "./ops66-password-dialog";
import { applyMapFilters } from "./lib/map-filters";

function formatNumber(n: number | string) {
  if (typeof n === "string") return n;
  return new Intl.NumberFormat("en-MY").format(n);
}

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const urlState = params.get("state") || "";
  const urlLevel = params.get("level") || "";
  const urlColor = params.get("color") || "";
  const viewId = params.get("view");
  const seatParam = params.get("seat");
  const seatTypeParam = params.get("seatType");
  const appliedViewRef = useRef<string | null>(null);

  const filters = useExploreWorkspaceStore((s) => s.filters);
  const mapLevel = useExploreWorkspaceStore((s) => s.mapLevel);
  const presentation = useExploreWorkspaceStore((s) => s.presentation);
  const colorMode = useExploreWorkspaceStore((s) => s.colorMode);
  const applyViewConfig = useExploreWorkspaceStore((s) => s.applyViewConfig);
  const setFilterField = useExploreWorkspaceStore((s) => s.setFilterField);
  const setMapLevel = useExploreWorkspaceStore((s) => s.setMapLevel);
  const setColorMode = useExploreWorkspaceStore((s) => s.setColorMode);
  const setSelectedConstituencyId = useExploreWorkspaceStore(
    (s) => s.setSelectedConstituencyId,
  );
  const setSelectedElectoralType = useExploreWorkspaceStore(
    (s) => s.setSelectedElectoralType,
  );
  const searchSelection = useExploreWorkspaceStore((s) => s.searchSelection);

  const savedView = useSavedView(viewId);

  const appliedState =
    filters.state && filters.state !== "0" ? filters.state : "";

  // Apply saved view once
  useEffect(() => {
    if (!viewId || !savedView.data) return;
    if (appliedViewRef.current === savedView.data.id) return;
    appliedViewRef.current = savedView.data.id;

    const cfg = savedView.data.config;
    startTransition(() => {
      applyViewConfig({
        state: cfg.state,
        selectedConstituencyId:
          cfg.selectedConstituencyId || seatParam || null,
        selectedElectoralType: cfg.selectedElectoralType || null,
        mapMode: cfg.mapMode,
        mapLevel: cfg.mapLevel,
        presentation: cfg.presentation,
        colorMode: cfg.colorMode,
        filters: cfg.filters,
        compareIds: cfg.compareIds,
      });
      const next = new URLSearchParams();
      if (cfg.state) next.set("state", cfg.state);
      if (cfg.mapLevel) next.set("level", cfg.mapLevel);
      if (cfg.presentation && cfg.presentation !== "normal") {
        next.set("presentation", cfg.presentation);
      }
      if (cfg.colorMode && cfg.colorMode !== "party") {
        next.set("color", cfg.colorMode);
      }
      next.set("view", savedView.data.id);
      const seat = cfg.selectedConstituencyId || seatParam;
      if (seat) next.set("seat", seat);
      if (cfg.selectedElectoralType) {
        next.set("seatType", cfg.selectedElectoralType);
      }
      setParams(next, { replace: true });
    });
  }, [viewId, savedView.data, seatParam, applyViewConfig, setParams]);

  // Hydrate store from URL once (avoid fighting user-driven filter changes)
  const urlHydratedRef = useRef(false);
  useEffect(() => {
    if (viewId) return;
    appliedViewRef.current = null;
    if (urlHydratedRef.current) return;
    urlHydratedRef.current = true;

    if (urlState) setFilterField("state", urlState);
    if (urlLevel === "dun" || urlLevel === "parliament") {
      setMapLevel(urlLevel);
    }
    if (urlColor === "group" || urlColor === "party") {
      setColorMode(urlColor);
    }
    if (seatParam) {
      setSelectedConstituencyId(seatParam);
      if (seatTypeParam === "dun" || seatTypeParam === "parliament") {
        setSelectedElectoralType(seatTypeParam);
      }
    }
    // Mount-only hydrate — store is source of truth after this
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewId]);

  // Sync workspace → URL (functional update so we don't re-read stale params)
  useEffect(() => {
    if (viewId) return;
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (appliedState) next.set("state", appliedState);
        else next.delete("state");
        if (mapLevel !== "parliament") next.set("level", mapLevel);
        else next.delete("level");
        if (presentation === "ops66") next.set("presentation", "ops66");
        else next.delete("presentation");
        if (colorMode === "group") next.set("color", "group");
        else next.delete("color");
        next.delete("view");
        if (next.toString() === prev.toString()) return prev;
        return next;
      },
      { replace: true },
    );
  }, [
    appliedState,
    mapLevel,
    presentation,
    colorMode,
    viewId,
    setParams,
  ]);

  // Match bdcat: always load seat polygons (national + filtered), not center points
  const summary = useExploreSummary({
    state: appliedState,
    level: mapLevel,
    presentation,
  });
  const geo = useExploreGeo({
    state: appliedState,
    level: mapLevel,
    presentation,
    polygons: true,
  });

  const filteredGeo = useMemo(() => {
    if (!geo.data) return undefined;

    const payloadState = (geo.data.state || "").toUpperCase();
    const wanted = (appliedState || "").toUpperCase();
    // While refetching a new state, keepPreviousData still holds the old
    // payload — don't client-filter it to empty against the new state.
    const stateMismatch = Boolean(wanted) && payloadState !== wanted;

    const clientFilters =
      stateMismatch || (geo.data.state != null && geo.data.state !== "")
        ? { ...filters, state: "0" }
        : filters;

    const features = applyMapFilters(geo.data.features, clientFilters);
    const focused = searchSelection
      ? features.filter((f) => f.properties.code === searchSelection.code)
      : features;
    return {
      ...geo.data,
      features: searchSelection && focused.length ? focused : features,
    };
  }, [geo.data, filters, searchSelection, appliedState]);

  return (
    <div className="space-y-4">
      <MapControlBar />

      <ExploreMap
        data={filteredGeo}
        isLoading={geo.isLoading && !geo.isPlaceholderData}
        appliedState={appliedState}
      />

      <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {summary.isLoading &&
            !summary.isPlaceholderData &&
            Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          {summary.data?.kpis.map((kpi) => (
            <div
              key={kpi.id}
              className="rounded-xl border border-[var(--color-line)] bg-white px-4 py-3"
            >
              <div className="text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                {kpi.label}
              </div>
              <div className="mt-1 text-2xl font-semibold tabular-nums text-[var(--color-ink)]">
                {kpi.id === "turnout"
                  ? `${kpi.value}%`
                  : formatNumber(kpi.value)}
              </div>
              <div className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
                {kpi.hint}
              </div>
            </div>
          ))}
        </div>

        <div className="rounded-xl border border-[var(--color-line)] bg-white p-4">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
            Seats by party
          </h3>
          <p className="mt-0.5 text-xs text-[var(--color-ink-muted)]">
            {summary.data?.election || "GE15"}
            {presentation === "ops66" ? " · OPS66" : ""}
            {appliedState ? ` · ${appliedState}` : " · National"}
            {mapLevel === "dun" ? " · DUN" : " · Parlimen"}
          </p>
          {summary.isLoading && !summary.isPlaceholderData ? (
            <Skeleton className="mt-3 h-40" />
          ) : (
            <div className="mt-1">
              <PartySeatsChart data={summary.data?.partySeats || []} />
            </div>
          )}
        </div>
      </div>

      {geo.isError && (
        <p className="text-sm text-[var(--color-danger)]">
          Map error: {(geo.error as Error).message}
        </p>
      )}

      <ConstituencySheet />
      <SeatListDialog />
      <DataInventoryDialog />
      <Ops66PasswordDialog />
    </div>
  );
}
