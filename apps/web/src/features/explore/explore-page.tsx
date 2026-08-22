import { useEffect, useMemo, useRef, startTransition } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useExploreGeo,
  useExploreStates,
  useExploreSummary,
} from "@/queries/explore";
import { useSavedView } from "@/queries/library";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ExploreMap } from "./explore-map";
import { PartySeatsChart } from "./party-seats-chart";
import { ConstituencySheet } from "./constituency-sheet";
import { SaveViewDialog } from "./save-view-dialog";

function formatNumber(n: number | string) {
  if (typeof n === "string") return n;
  return new Intl.NumberFormat("en-MY").format(n);
}

export function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const urlState = params.get("state") || "";
  const viewId = params.get("view");
  const seatParam = params.get("seat");
  const appliedViewRef = useRef<string | null>(null);

  const appliedState = useExploreWorkspaceStore((s) => s.appliedState);
  const setAppliedState = useExploreWorkspaceStore((s) => s.setAppliedState);
  const mapMode = useExploreWorkspaceStore((s) => s.mapMode);
  const setMapMode = useExploreWorkspaceStore((s) => s.setMapMode);
  const compareIds = useExploreWorkspaceStore((s) => s.compareIds);
  const clearCompare = useExploreWorkspaceStore((s) => s.clearCompare);
  const setSelectedConstituencyId = useExploreWorkspaceStore(
    (s) => s.setSelectedConstituencyId,
  );
  const applyViewConfig = useExploreWorkspaceStore((s) => s.applyViewConfig);

  const savedView = useSavedView(viewId);

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
        mapMode: cfg.mapMode,
        compareIds: cfg.compareIds,
      });
      const next = new URLSearchParams();
      if (cfg.state) next.set("state", cfg.state);
      next.set("view", savedView.data.id);
      const seat = cfg.selectedConstituencyId || seatParam;
      if (seat) next.set("seat", seat);
      setParams(next, { replace: true });
    });
  }, [viewId, savedView.data, seatParam, applyViewConfig, setParams]);

  useEffect(() => {
    if (viewId) return;
    appliedViewRef.current = null;
    if (urlState !== appliedState) {
      setAppliedState(urlState);
    }
  }, [urlState, appliedState, setAppliedState, viewId]);

  useEffect(() => {
    if (viewId) return;
    if (seatParam) setSelectedConstituencyId(seatParam);
  }, [seatParam, setSelectedConstituencyId, viewId]);

  const states = useExploreStates();
  const summary = useExploreSummary(appliedState);
  const geo = useExploreGeo(appliedState);
  const stateOptions = useMemo(() => states.data || [], [states.data]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-3xl text-[var(--color-ink)]">
            Explore
          </h1>
          <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
            GE15 parliament map — filter a state for polygon detail, click a
            seat to drill in.
            {savedView.data ? (
              <>
                {" "}
                · Opened view <strong>{savedView.data.name}</strong>
              </>
            ) : null}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <SaveViewDialog />
          {(["select", "pan", "compare"] as const).map((mode) => (
            <Button
              key={mode}
              size="sm"
              variant={mapMode === mode ? "default" : "outline"}
              onClick={() => setMapMode(mode)}
            >
              {mode}
            </Button>
          ))}
        </div>
      </div>

      <div className="sticky top-16 z-10 flex flex-wrap items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]/95 p-3 backdrop-blur">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-[var(--color-ink-muted)]">State</span>
          <select
            className="h-9 rounded-md border border-[var(--color-line)] bg-white px-3 text-sm outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
            value={appliedState}
            onChange={(e) => {
              const value = e.target.value;
              startTransition(() => {
                setAppliedState(value);
                appliedViewRef.current = null;
                const next = new URLSearchParams(params);
                if (value) next.set("state", value);
                else next.delete("state");
                next.delete("view");
                setParams(next, { replace: true });
              });
            }}
          >
            <option value="">All Malaysia (points)</option>
            {stateOptions.map((s) => (
              <option key={s.name} value={s.name}>
                {s.name} ({s.seats})
              </option>
            ))}
          </select>
        </label>
        {appliedState && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setAppliedState("");
              appliedViewRef.current = null;
              const next = new URLSearchParams(params);
              next.delete("state");
              next.delete("view");
              setParams(next, { replace: true });
            }}
          >
            Clear
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          {compareIds.length > 0 && (
            <div className="flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
              Comparing {compareIds.join(", ")}
              <Button size="sm" variant="outline" onClick={clearCompare}>
                Clear compare
              </Button>
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {summary.isLoading &&
          Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        {summary.data?.kpis.map((kpi) => (
          <div
            key={kpi.id}
            className="rounded-xl border border-[var(--color-line)] bg-white p-5"
          >
            <div className="text-xs font-medium uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
              {kpi.label}
            </div>
            <div className="mt-2 text-3xl font-semibold tabular-nums text-[var(--color-ink)]">
              {kpi.id === "turnout"
                ? `${kpi.value}%`
                : formatNumber(kpi.value)}
            </div>
            <div className="mt-1 text-xs text-[var(--color-ink-muted)]">
              {kpi.hint}
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.45fr_1fr]">
        <ExploreMap data={geo.data} isLoading={geo.isLoading} />

        <div className="rounded-xl border border-[var(--color-line)] bg-white p-5">
          <h3 className="text-sm font-semibold text-[var(--color-ink)]">
            Seats by party
          </h3>
          <p className="mt-1 text-xs text-[var(--color-ink-muted)]">
            {summary.data?.election || "GE15"}
            {appliedState ? ` · ${appliedState}` : " · National"}
          </p>
          {summary.isLoading ? (
            <Skeleton className="mt-4 h-64" />
          ) : (
            <div className="mt-2">
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
    </div>
  );
}
