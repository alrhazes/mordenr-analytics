import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Brain,
  List,
  Monitor,
  RefreshCw,
  Save,
  Shuffle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  buildSelectionSignature,
  useSimulationWorkspaceStore,
} from "@/stores/simulation-workspace";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";
import {
  buildSimulationSearchParams,
  mapLevelToAreaType,
  resolveSimulationFromUrlAndExplore,
  type ResolvedSimulation,
} from "@/features/simulation/lib/simulation-scope";
import {
  useBatchInit,
  useBatchRun,
  useCreateSimulationSave,
  useDeleteSimulationSave,
  useIndividualFromBatch,
  useIndividualInit,
  useIndividualMatches,
  useIndividualRun,
  usePartyConfig,
  useSimulationSeats,
  useSimulationSaves,
  useUpdateSimulationSave,
  type GainLossParam,
  type SimulationSave,
} from "@/queries/simulation";
import { SeatDualList } from "./seat-dual-list";
import { SimulationChartPanel } from "./simulation-chart";
import {
  buildGroupingOptions,
  SimulationParametersTable,
} from "./simulation-parameters-table";
import {
  SimulationResultsTable,
  SimulationSummaryPanel,
} from "./simulation-results-table";
import { PartyConfigDialog } from "./party-config-dialog";
import { SimulationAiPanel } from "./simulation-ai-panel";
import { IndividualSimulationPanel } from "./individual-simulation-panel";
import { BatchIndividualOverridePrompt } from "./batch-individual-override-prompt";

function syncGainloss(
  current: GainLossParam[],
  parties: string[],
): GainLossParam[] {
  const map = new Map(current.map((g) => [g.group, g.pct]));
  return parties.map((group) => ({ group, pct: map.get(group) ?? 0 }));
}

export function SimulationPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const urlState = params.get("state") || "";
  const urlLevel = params.get("level") || "parliament";
  const urlSeat = params.get("seat") || "";

  const view = useSimulationWorkspaceStore((s) => s.view);
  const areaType = useSimulationWorkspaceStore((s) => s.areaType);
  const scopeArea = useSimulationWorkspaceStore((s) => s.scopeArea);
  const scopeName = useSimulationWorkspaceStore((s) => s.scopeName);
  const scopeTitle = useSimulationWorkspaceStore((s) => s.scopeTitle);
  const mapCode = useSimulationWorkspaceStore((s) => s.mapCode);
  const availableSeats = useSimulationWorkspaceStore((s) => s.availableSeats);
  const selectedSeatCodes = useSimulationWorkspaceStore(
    (s) => s.selectedSeatCodes,
  );
  const selectionSignature = useSimulationWorkspaceStore(
    (s) => s.selectionSignature,
  );
  const lastInitSignature = useSimulationWorkspaceStore(
    (s) => s.lastInitSignature,
  );
  const gainloss = useSimulationWorkspaceStore((s) => s.gainloss);
  const transfer = useSimulationWorkspaceStore((s) => s.transfer);
  const grouping = useSimulationWorkspaceStore((s) => s.grouping);
  const tovPct = useSimulationWorkspaceStore((s) => s.tovPct);
  const partyConfig = useSimulationWorkspaceStore((s) => s.partyConfig);
  const partyTotals = useSimulationWorkspaceStore((s) => s.partyTotals);
  const allParties = useSimulationWorkspaceStore((s) => s.allParties);
  const seats = useSimulationWorkspaceStore((s) => s.seats);
  const chart = useSimulationWorkspaceStore((s) => s.chart);
  const summary = useSimulationWorkspaceStore((s) => s.summary);
  const loadedSaveId = useSimulationWorkspaceStore((s) => s.loadedSaveId);
  const loadedSaveName = useSimulationWorkspaceStore((s) => s.loadedSaveName);
  const aiQuestion = useSimulationWorkspaceStore((s) => s.aiQuestion);
  const aiReply = useSimulationWorkspaceStore((s) => s.aiReply);

  const openBatch = useSimulationWorkspaceStore((s) => s.openBatch);
  const openIndividual = useSimulationWorkspaceStore((s) => s.openIndividual);
  const setAreaType = useSimulationWorkspaceStore((s) => s.setAreaType);
  const setScope = useSimulationWorkspaceStore((s) => s.setScope);
  const setAvailableSeats = useSimulationWorkspaceStore(
    (s) => s.setAvailableSeats,
  );
  const setSelectedSeatCodes = useSimulationWorkspaceStore(
    (s) => s.setSelectedSeatCodes,
  );
  const markInitSignature = useSimulationWorkspaceStore(
    (s) => s.markInitSignature,
  );
  const setParameters = useSimulationWorkspaceStore((s) => s.setParameters);
  const setPartyConfig = useSimulationWorkspaceStore((s) => s.setPartyConfig);
  const applyResult = useSimulationWorkspaceStore((s) => s.applyResult);
  const setLoadedSave = useSimulationWorkspaceStore((s) => s.setLoadedSave);
  const setAi = useSimulationWorkspaceStore((s) => s.setAi);
  const resetWorkspace = useSimulationWorkspaceStore((s) => s.resetWorkspace);

  const exploreMapLevel = useExploreWorkspaceStore((s) => s.mapLevel);
  const selectedConstituencyId = useExploreWorkspaceStore(
    (s) => s.selectedConstituencyId,
  );
  const selectedElectoralType = useExploreWorkspaceStore(
    (s) => s.selectedElectoralType,
  );
  const exploreFilters = useExploreWorkspaceStore((s) => s.filters);
  const setMapLevel = useExploreWorkspaceStore((s) => s.setMapLevel);

  const appliedState =
    exploreFilters.state && exploreFilters.state !== "0"
      ? exploreFilters.state.toUpperCase()
      : "";

  const prevMapLevelRef = useRef(exploreMapLevel);
  /** Auto-select-all only on first load of a seat list; do not refill after RESET SENARAI. */
  const seatListInitKeyRef = useRef("");

  const [chartType, setChartType] = useState<"pie" | "bar">("pie");
  const [partyDialogOpen, setPartyDialogOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const [overridePromptOpen, setOverridePromptOpen] = useState(false);
  const [overrideMatches, setOverrideMatches] = useState<SimulationSave[]>([]);
  const [urlHydrated, setUrlHydrated] = useState(false);

  const batchSeatListScope =
    scopeArea === "NEGERI" && scopeName ? "NEGERI" : "NEGARA";
  const seatList = useSimulationSeats(
    areaType,
    batchSeatListScope,
    scopeName,
    view === "batch",
  );
  const batchInit = useBatchInit();
  const batchRun = useBatchRun();
  const individualInit = useIndividualInit();
  const individualRun = useIndividualRun();
  const individualMatches = useIndividualMatches();
  const individualFromBatch = useIndividualFromBatch();
  const saves = useSimulationSaves(
    view === "individual" ? "INDIVIDUAL" : "BATCH",
    view === "individual" ? mapCode || undefined : undefined,
  );
  const createSave = useCreateSimulationSave();
  const updateSave = useUpdateSimulationSave();
  const deleteSave = useDeleteSimulationSave();
  const partyConfigQuery = usePartyConfig(areaType, partyConfig);

  // Scope-driven hydration (BDCAT generateRingkasan / initSimulationParDun)
  useEffect(() => {
    if (urlHydrated) return;
    const { resolved, mapLevel } = resolveSimulationFromUrlAndExplore({
      urlSeat,
      urlState: urlState.toUpperCase(),
      urlLevel,
      exploreMapLevel,
      selectedConstituencyId,
      selectedElectoralType,
      appliedState,
    });

    setMapLevel(mapLevel);

    if (resolved.view === "individual") {
      openIndividual({
        mapCode: resolved.mapCode,
        areaType: resolved.areaType,
        scopeName: urlState.toUpperCase() || appliedState || undefined,
      });
      setScope(
        resolved.areaType === "dun" ? "DUN" : "PARLIMEN",
        "",
        resolved.scopeTitle,
      );
    } else {
      openBatch({
        areaType: resolved.areaType,
        scopeArea: resolved.scopeArea,
        scopeName: resolved.scopeName || undefined,
      });
    }

    navigate(
      `/simulation?${buildSimulationSearchParams(resolved).toString()}`,
      { replace: true },
    );
    prevMapLevelRef.current = mapLevel;
    setUrlHydrated(true);
  }, [
    urlSeat,
    urlState,
    urlLevel,
    exploreMapLevel,
    selectedConstituencyId,
    selectedElectoralType,
    appliedState,
    openBatch,
    openIndividual,
    setScope,
    setMapLevel,
    navigate,
    urlHydrated,
  ]);

  // Batch: react to Explore mapLevel changes (BDCAT sim_type reset logic)
  useEffect(() => {
    if (!urlHydrated || view !== "batch") {
      prevMapLevelRef.current = exploreMapLevel;
      return;
    }
    if (prevMapLevelRef.current === exploreMapLevel) return;

    const prevLevel = prevMapLevelRef.current;
    const newAreaType = mapLevelToAreaType(exploreMapLevel);
    if (newAreaType === areaType) {
      prevMapLevelRef.current = exploreMapLevel;
      return;
    }

    const label = exploreMapLevel === "dun" ? "DUN" : "PARLIMEN";
    const ok = window.confirm(
      `Tukar ke ${label}? Senarai simulasi akan diganti.`,
    );
    if (ok) {
      seatListInitKeyRef.current = "";
      setAreaType(newAreaType);
      setSelectedSeatCodes([]);
      markInitSignature("");
      const resolved: ResolvedSimulation = {
        view: "batch",
        scopeArea: batchSeatListScope as "NEGARA" | "NEGERI",
        scopeName,
        areaType: newAreaType,
        scopeTitle,
      };
      navigate(
        `/simulation?${buildSimulationSearchParams(resolved).toString()}`,
        { replace: true },
      );
    } else {
      setMapLevel(prevLevel);
    }
    prevMapLevelRef.current = exploreMapLevel;
  }, [
    exploreMapLevel,
    urlHydrated,
    view,
    areaType,
    batchSeatListScope,
    scopeName,
    scopeTitle,
    setAreaType,
    setSelectedSeatCodes,
    markInitSignature,
    setMapLevel,
    navigate,
  ]);

  useEffect(() => {
    if (!seatList.data) return;
    setAvailableSeats(seatList.data.seats);
    if (view !== "batch") return;

    const listKey = `${areaType}|${batchSeatListScope}|${scopeName}|${seatList.data.seats.length}`;
    if (seatListInitKeyRef.current === listKey) return;

    seatListInitKeyRef.current = listKey;
    // First load of this list: select all (BDCAT default). RESET SENARAI clears without re-filling.
    setSelectedSeatCodes(seatList.data.seats.map((s) => s.code));
  }, [
    seatList.data,
    view,
    areaType,
    batchSeatListScope,
    scopeName,
    setAvailableSeats,
    setSelectedSeatCodes,
  ]);

  // Individual: load seat when mapCode set
  useEffect(() => {
    if (view !== "individual" || !mapCode || !urlHydrated) return;
    let cancelled = false;
    individualInit
      .mutateAsync({ areaType, mapCode })
      .then((data) => {
        if (cancelled) return;
        applyResult({
          seats: data.parliament,
          chart: data.chart,
          summary: data.summary,
          meta: data.meta,
        });
        setParameters({
          gainloss: syncGainloss([], data.meta.all_parties ?? []),
          transfer: [],
          grouping: null,
          tovPct: 0,
        });
        if (data.meta.scopeTitle) {
          setScope(
            areaType === "dun" ? "DUN" : "PARLIMEN",
            "",
            data.meta.scopeTitle,
          );
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, mapCode, areaType, urlHydrated]);

  const payloadBase = useMemo(
    () => ({
      areaType,
      scopeArea: batchSeatListScope as "NEGARA" | "NEGERI",
      scopeName: scopeName || undefined,
      seatCodes: selectedSeatCodes,
    }),
    [areaType, batchSeatListScope, scopeName, selectedSeatCodes],
  );

  const groupingOptions = useMemo(
    () => buildGroupingOptions(allParties),
    [allParties],
  );

  const selectionDirty = selectionSignature !== lastInitSignature;
  const hasSimulation = Boolean(seats[0]?.simulation?.menang?.group);

  const showNotice = useCallback((msg: string) => {
    setNotice(msg);
    window.setTimeout(() => setNotice(""), 3500);
  }, []);

  function syncUrl(resolved: ResolvedSimulation) {
    navigate(
      `/simulation?${buildSimulationSearchParams(resolved).toString()}`,
      { replace: true },
    );
  }

  async function handleGenerateList() {
    if (!selectedSeatCodes.length) {
      showNotice("Sila pilih minimum 1 kawasan");
      return;
    }
    const data = await batchInit.mutateAsync({
      ...payloadBase,
      seatCodes: selectedSeatCodes,
    });
    applyResult({
      seats: data.parliament,
      chart: data.chart,
      summary: data.summary,
      meta: data.meta,
    });
    setParameters({
      gainloss: syncGainloss(gainloss, data.meta.all_parties ?? []),
      transfer: [],
      grouping: null,
    });
    markInitSignature(selectionSignature);
    showNotice("Senarai simulasi berjaya dijana");
  }

  async function executeBatchRun(
    overrides: NonNullable<
      Parameters<typeof batchRun.mutateAsync>[0]["individualOverrides"]
    > = [],
  ) {
    const data = await batchRun.mutateAsync({
      ...payloadBase,
      gainloss,
      transfer,
      grouping,
      individualOverrides: overrides,
    });
    applyResult({
      seats: data.parliament,
      chart: data.chart,
      summary: data.summary,
      meta: data.meta,
    });
    showNotice("Simulasi berjaya dijana");
  }

  async function handleRunSimulation() {
    if (selectionDirty) {
      showNotice("Jana senarai baru dahulu sebelum simulasi");
      return;
    }
    if (!selectedSeatCodes.length) {
      showNotice("Sila pilih minimum 1 kawasan");
      return;
    }

    try {
      const { matches } = await individualMatches.mutateAsync({
        areaType,
        seatCodes: selectedSeatCodes,
      });
      if (matches.length > 0) {
        setOverrideMatches(matches);
        setOverridePromptOpen(true);
        return;
      }
    } catch {
      /* proceed without overrides */
    }

    await executeBatchRun([]);
  }

  function overridesFromMatches(ids: string[]) {
    return overrideMatches
      .filter((m) => ids.includes(m.id))
      .map((m) => ({
        mapCode: m.mapCode!,
        gainloss: m.gainloss,
        transfer: m.transfer,
        grouping: m.grouping,
        simName: m.name,
      }));
  }

  async function handleResetSimulation() {
    seatListInitKeyRef.current = "";
    resetWorkspace();
    setUrlHydrated(false);
  }

  function handleGainLossChange(group: string, pct: number) {
    const next = syncGainloss(gainloss, allParties).map((g) =>
      g.group === group ? { ...g, pct } : g,
    );
    setParameters({ gainloss: next });
  }

  function handleTransferChange(from: string, to: string, pct: number) {
    const rest = transfer.filter((t) => !(t.from === from && t.to === to));
    setParameters({ transfer: [...rest, { from, to, pct }] });
  }

  async function handleIndividualLiveRun() {
    if (!mapCode) return;
    const data = await individualRun.mutateAsync({
      areaType,
      mapCode,
      tovPct,
      gainloss,
      transfer,
      grouping,
    });
    applyResult({
      seats: data.parliament,
      chart: data.chart,
      summary: data.summary,
      meta: data.meta,
    });
  }

  async function handleSaveSimulation() {
    const name =
      saveName.trim() ||
      (view === "individual"
        ? `Individu ${mapCode}`
        : `Simulasi ${scopeTitle}`);

    if (view === "individual") {
      if (!mapCode) {
        showNotice("Pilih kawasan dahulu");
        return;
      }
      const body = {
        name,
        mode: "INDIVIDUAL" as const,
        area: areaType === "dun" ? "DUN" : "PARLIMEN",
        areaName: scopeName || null,
        areaType,
        mapCode,
        selectedCodes: [mapCode],
        gainloss,
        transfer,
        grouping,
        partyConfig,
        resultMeta: { ai_question: aiQuestion, ai_response: aiReply },
        chart: chart ?? undefined,
      };
      if (loadedSaveId) {
        await updateSave.mutateAsync({ id: loadedSaveId, ...body });
        setLoadedSave(loadedSaveId, name);
        showNotice("Simulasi individu dikemaskini");
      } else {
        const res = await createSave.mutateAsync(body);
        setLoadedSave(res.save.id, res.save.name);
        showNotice("Simulasi individu disimpan");
      }
    } else {
      const body = {
        name,
        mode: "BATCH" as const,
        area: batchSeatListScope,
        areaName: scopeName || null,
        areaType,
        mapCode: null,
        selectedCodes: selectedSeatCodes,
        gainloss,
        transfer,
        grouping,
        partyConfig,
        resultMeta: { ai_question: aiQuestion, ai_response: aiReply },
        chart: chart ?? undefined,
      };
      if (loadedSaveId) {
        await updateSave.mutateAsync({ id: loadedSaveId, ...body });
        setLoadedSave(loadedSaveId, name);
        showNotice("Simulasi batch dikemaskini");
      } else {
        const res = await createSave.mutateAsync(body);
        setLoadedSave(res.save.id, res.save.name);
        showNotice("Simulasi batch disimpan");
      }
    }
    setSaveDialogOpen(false);
  }

  async function loadSave(id: string) {
    const save = saves.data?.saves.find((s) => s.id === id);
    if (!save) return;
    setLoadedSave(save.id, save.name);
    setSaveName(save.name);
    setParameters({
      gainloss: save.gainloss,
      transfer: save.transfer,
      grouping: save.grouping,
    });
    setPartyConfig(save.partyConfig || {});
    setAi(
      String(save.resultMeta?.ai_question || ""),
      String(save.resultMeta?.ai_response || ""),
    );

    if (save.mode === "INDIVIDUAL" && save.mapCode) {
      openIndividual({
        mapCode: save.mapCode,
        areaType: save.areaType as "parlimen" | "dun",
      });
      setUrlHydrated(true);
      syncUrl({
        view: "individual",
        mapCode: save.mapCode,
        areaType: save.areaType as "parlimen" | "dun",
        scopeName: save.areaName || "",
        scopeTitle: save.mapCode,
      });
      const data = await individualInit.mutateAsync({
        areaType: save.areaType as "parlimen" | "dun",
        mapCode: save.mapCode,
      });
      applyResult({
        seats: data.parliament,
        chart: save.chart || data.chart,
        summary: data.summary,
        meta: data.meta,
      });
      setParameters({
        gainloss: save.gainloss,
        transfer: save.transfer,
        grouping: save.grouping,
      });
      await individualRun.mutateAsync({
        areaType: save.areaType as "parlimen" | "dun",
        mapCode: save.mapCode,
        gainloss: save.gainloss,
        transfer: save.transfer,
        grouping: save.grouping,
      }).then((run) => {
        applyResult({
          seats: run.parliament,
          chart: run.chart,
          summary: run.summary,
          meta: run.meta,
        });
      });
    } else {
      openBatch({
        areaType: save.areaType as "parlimen" | "dun",
        scopeArea: (save.area as "NEGARA" | "NEGERI") || "NEGARA",
        scopeName: save.areaName || undefined,
      });
      setUrlHydrated(true);
      setSelectedSeatCodes(save.selectedCodes);
      markInitSignature(buildSelectionSignature(save.selectedCodes));
      syncUrl({
        view: "batch",
        scopeArea: (save.area as "NEGARA" | "NEGERI") || "NEGARA",
        scopeName: save.areaName || "",
        areaType: save.areaType as "parlimen" | "dun",
        scopeTitle: save.areaName
          ? `SELURUH NEGERI ${save.areaName.toUpperCase()}`
          : "SELURUH NEGARA",
      });
      if (save.selectedCodes.length) {
        const data = await batchInit.mutateAsync({
          areaType: save.areaType as "parlimen" | "dun",
          scopeArea: (save.area as "NEGARA" | "NEGERI") || "NEGARA",
          scopeName: save.areaName || undefined,
          seatCodes: save.selectedCodes,
        });
        applyResult({
          seats: data.parliament,
          chart: save.chart || data.chart,
          summary: data.summary,
          meta: data.meta,
        });
      }
    }
    showNotice(`Simulasi "${save.name}" dimuatkan`);
  }

  const mapLabel = useMemo(() => {
    if (view === "individual") return scopeTitle || mapCode;
    const seat = availableSeats.find((s) => s.code === mapCode);
    return seat?.label || scopeTitle || mapCode;
  }, [view, availableSeats, mapCode, scopeTitle]);

  const pageTitle =
    view === "individual"
      ? "Simulasi Undian Parlimen & Dun (Auto)"
      : "Simulasi Undian Parlimen & Dun (Manual)";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">
            {pageTitle}
          </h1>
          <p className="mt-1 text-sm font-semibold uppercase tracking-wide text-[var(--color-accent)]">
            {scopeTitle}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setPartyDialogOpen(true)}
          >
            <Shuffle className="h-3.5 w-3.5" />
            TUKAR PARTI
          </Button>
        </div>
      </div>

      {notice && (
        <div className="rounded-md border border-[var(--color-line)] bg-[var(--color-accent-soft)] px-3 py-2 text-sm">
          {notice}
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 rounded-xl border border-[var(--color-line)] bg-white p-3">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              setSaveName(
                loadedSaveName ||
                  (view === "individual"
                    ? `Individu ${mapCode}`
                    : `Simulasi ${scopeTitle}`),
              );
              setSaveDialogOpen(true);
            }}
          >
            <Save className="h-3.5 w-3.5" />
            SIMPAN
          </Button>
          {loadedSaveId && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                deleteSave.mutate(loadedSaveId, {
                  onSuccess: () => {
                    setLoadedSave(null);
                    showNotice("Simulasi dipadam");
                  },
                })
              }
            >
              PADAM
            </Button>
          )}
          <select
            className="h-8 rounded-md border border-[var(--color-line)] bg-white px-2 text-xs"
            value={loadedSaveId || ""}
            onChange={(e) => {
              if (e.target.value) void loadSave(e.target.value);
            }}
          >
            <option value="">
              {view === "individual"
                ? "PILIH SIMULASI INDIVIDU…"
                : "PILIH SIMULASI BATCH…"}
            </option>
            {(saves.data?.saves || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={handleResetSimulation}
          >
            <RefreshCw className="h-3.5 w-3.5" />
            RESET SIMULASI
          </Button>
      </div>

      {saveDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-xl border border-[var(--color-line)] bg-white p-5 shadow-xl">
            <h3 className="text-lg font-semibold">Simpan simulasi</h3>
            <Input
              className="mt-3"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Nama simulasi"
            />
            <div className="mt-4 flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setSaveDialogOpen(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                onClick={handleSaveSimulation}
                disabled={createSave.isPending || updateSave.isPending}
              >
                {loadedSaveId ? "Kemaskini" : "Simpan"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {view === "batch" ? (
        <>
          <div className="grid gap-4 xl:grid-cols-[1.2fr_1fr]">
            <div className="space-y-3 rounded-xl border border-[var(--color-line)] bg-white p-4">
              <h3 className="text-sm font-semibold text-[var(--color-ink-muted)]">
                Pilihan Kawasan
              </h3>
              {seatList.isLoading ? (
                <Skeleton className="h-72 w-full" />
              ) : (
                <SeatDualList
                  available={availableSeats}
                  selected={selectedSeatCodes}
                  onChange={setSelectedSeatCodes}
                />
              )}
            </div>
            <SimulationChartPanel
              chart={chart}
              chartType={chartType}
              onChartTypeChange={setChartType}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 border-t border-[var(--color-line)] pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleGenerateList}
              disabled={batchInit.isPending}
            >
              <List className="h-4 w-4" />
              1 - JANA KAWASAN BARU
            </Button>
            <Button
              type="button"
              onClick={handleRunSimulation}
              disabled={batchRun.isPending || selectionDirty}
            >
              <Monitor className="h-4 w-4" />
              2 - PARAMETERS & JANA SIMULASI
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={() => setAiOpen(true)}
              aria-label="Analisis AI"
            >
              <Brain className="h-5 w-5" />
            </Button>
            {hasSimulation && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={individualFromBatch.isPending}
                onClick={() => {
                  void individualFromBatch.mutateAsync(
                    {
                      areaType,
                      seats: selectedSeatCodes.map((code) => ({
                        mapCode: code,
                        simName: `Individu ${code}`,
                      })),
                      gainloss,
                      transfer,
                      grouping,
                    },
                    {
                      onSuccess: () =>
                        showNotice("Parameter batch disimpan ke individu"),
                    },
                  );
                }}
              >
                Simpan ke simulasi individu
              </Button>
            )}
            {selectionDirty && (
              <span className="text-xs text-amber-700">
                Senarai pilihan berubah — jana kawasan baru dahulu
              </span>
            )}
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Parameters
            </h3>
            <SimulationParametersTable
              parties={allParties}
              partyTotals={partyTotals}
              gainloss={gainloss}
              transfer={transfer}
              grouping={grouping}
              groupingOptions={groupingOptions}
              onGainLossChange={handleGainLossChange}
              onTransferChange={handleTransferChange}
              onGroupingChange={(g) => setParameters({ grouping: g })}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setParameters({
                  gainloss: syncGainloss([], allParties),
                  transfer: [],
                  grouping: null,
                });
                void handleRunSimulation();
              }}
            >
              RESET PARAMETERS
            </Button>
          </div>

          <div className="space-y-3">
            <h3 className="text-sm font-bold uppercase tracking-wide text-[var(--color-ink-muted)]">
              Keputusan Simulasi
            </h3>
            <SimulationResultsTable
              areaType={areaType}
              seats={seats}
              hasSimulation={hasSimulation}
            />
            <SimulationSummaryPanel
              summary={summary}
              seatCount={seats.length}
            />
          </div>
        </>
      ) : (
        <IndividualSimulationPanel
          areaType={areaType}
          mapCode={mapCode}
          mapLabel={mapLabel}
          tovPct={tovPct}
          onTovChange={(v) => setParameters({ tovPct: v })}
          parties={allParties}
          partyTotals={partyTotals}
          gainloss={gainloss}
          transfer={transfer}
          grouping={grouping}
          onGainLossChange={handleGainLossChange}
          onTransferChange={handleTransferChange}
          onGroupingChange={(g) => setParameters({ grouping: g })}
          onLiveRun={() => void handleIndividualLiveRun()}
          running={individualRun.isPending}
          seats={seats}
          chart={chart}
        />
      )}

      <BatchIndividualOverridePrompt
        open={overridePromptOpen}
        matches={overrideMatches}
        onCancel={() => setOverridePromptOpen(false)}
        onSkip={() => {
          setOverridePromptOpen(false);
          void executeBatchRun([]);
        }}
        onConfirm={(ids) => {
          setOverridePromptOpen(false);
          void executeBatchRun(overridesFromMatches(ids));
        }}
      />

      <PartyConfigDialog
        open={partyDialogOpen}
        onClose={() => setPartyDialogOpen(false)}
        parties={partyConfigQuery.data?.parties ?? []}
        overrides={partyConfig}
        onSave={setPartyConfig}
      />

      <SimulationAiPanel
        open={aiOpen}
        onClose={() => setAiOpen(false)}
        question={aiQuestion}
        reply={aiReply}
        onQuestionChange={(q) => setAi(q, aiReply)}
        onReplyChange={(r) => setAi(aiQuestion, r)}
        context={{
          view,
          scopeTitle,
          areaType,
          mapCode,
          seats,
          chart,
          summary,
          gainloss,
          transfer,
          grouping,
        }}
      />
    </div>
  );
}
