import { useEffect, useMemo, useRef, startTransition } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useExploreGeo,
  useExploreSummary,
} from "@/queries/explore";
import { useSavedView } from "@/queries/library";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";
import { ExploreMap } from "./explore-map";
import { ElectionStatusSummary } from "./election-status-summary";
import { DemographySection } from "./demography-section";
import { ConstituencySheet } from "./constituency-sheet";
import { VoterSheet } from "./voter-sheet";
import { MapControlBar } from "./map-control-bar";
import { SeatListDialog } from "./seat-list-dialog";
import { DataInventoryDialog } from "./data-inventory-dialog";
import { Ops66PasswordDialog } from "./ops66-password-dialog";
import { applyMapFilters } from "./lib/map-filters";
import {
  resolveRingkasanScope,
  scopeAreaLabel,
  summaryMatchesScope,
} from "./lib/ringkasan-scope";

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const urlState = params.get("state") || "";
  const urlLevel = params.get("level") || "";
  const urlColor = params.get("color") || "";
  const viewId = params.get("view");
  const seatParam = params.get("seat");
  const seatTypeParam = params.get("seatType");
  const voterParam = params.get("voter");
  const appliedViewRef = useRef<string | null>(null);

  const filters = useExploreWorkspaceStore((s) => s.filters);
  const mapLevel = useExploreWorkspaceStore((s) => s.mapLevel);
  const presentation = useExploreWorkspaceStore((s) => s.presentation);
  const colorMode = useExploreWorkspaceStore((s) => s.colorMode);
  const applyViewConfig = useExploreWorkspaceStore((s) => s.applyViewConfig);
  const setFilterField = useExploreWorkspaceStore((s) => s.setFilterField);
  const setMapLevel = useExploreWorkspaceStore((s) => s.setMapLevel);
  const setColorMode = useExploreWorkspaceStore((s) => s.setColorMode);
  const selectedConstituencyId = useExploreWorkspaceStore(
    (s) => s.selectedConstituencyId,
  );
  const selectedElectoralType = useExploreWorkspaceStore(
    (s) => s.selectedElectoralType,
  );
  const setSelectedConstituencyId = useExploreWorkspaceStore(
    (s) => s.setSelectedConstituencyId,
  );
  const setSelectedElectoralType = useExploreWorkspaceStore(
    (s) => s.setSelectedElectoralType,
  );
  const searchSelection = useExploreWorkspaceStore((s) => s.searchSelection);

  const savedView = useSavedView(viewId);

  // Only use URL state before one-time hydrate; after that filters.state wins (incl. reset).
  const allowUrlStateFallbackRef = useRef(Boolean(urlState));

  const appliedState = useMemo(() => {
    const fromFilter =
      filters.state && filters.state !== "0" ? filters.state : "";
    if (fromFilter) return fromFilter.toUpperCase();
    if (allowUrlStateFallbackRef.current && urlState) {
      return urlState.toUpperCase();
    }
    return "";
  }, [filters.state, urlState]);

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
    allowUrlStateFallbackRef.current = false;
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

  function closeVoterProfile() {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("voter");
        return next;
      },
      { replace: true },
    );
  }

  function openVoterProfile(ic: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set("voter", ic);
        return next;
      },
      { replace: true },
    );
  }

  // Match bdcat generateRingkasanPrediction: seat > state filter > negara
  const ringkasanScope = useMemo(
    () =>
      resolveRingkasanScope({
        selectedConstituencyId,
        selectedElectoralType,
        appliedState,
      }),
    [selectedConstituencyId, selectedElectoralType, appliedState],
  );

  const summary = useExploreSummary({
    state: appliedState,
    area: ringkasanScope.area,
    value: ringkasanScope.value,
    level: mapLevel,
    presentation,
  });
  const geo = useExploreGeo({
    state: appliedState,
    level: mapLevel,
    presentation,
    polygons: true,
  });

  const summaryMatches = summaryMatchesScope(summary.data, ringkasanScope);
  const summaryData = summaryMatches ? summary.data : undefined;
  const summaryPending =
    (summary.isLoading && !summary.isPlaceholderData) ||
    (summary.isFetching && !summaryMatches);
  const summaryAreaLabel = summaryData?.areaLabel ?? scopeAreaLabel(ringkasanScope);

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

      <ElectionStatusSummary
        data={summaryData}
        areaLabel={summaryAreaLabel}
        isLoading={summaryPending}
        isFetching={summary.isFetching && !summary.isLoading}
        error={summary.error as Error | null}
        mapLevel={mapLevel}
        presentation={presentation}
      />

      <DemographySection
        ringkasanScope={ringkasanScope}
        onOpenVoter={openVoterProfile}
      />

      {geo.isError && (
        <p className="text-sm text-[var(--color-danger)]">
          Map error: {(geo.error as Error).message}
        </p>
      )}

      <ConstituencySheet />
      <VoterSheet ic={voterParam} onClose={closeVoterProfile} />
      <SeatListDialog />
      <DataInventoryDialog />
      <Ops66PasswordDialog />
    </div>
  );
}
