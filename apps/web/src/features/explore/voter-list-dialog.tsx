import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Download,
  FileSpreadsheet,
  Filter,
  Printer,
  Search,
  Share2,
  X,
} from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type {
  DemographyScope,
  DemographyTableRow,
  VoterListArea,
  VoterListQuery,
} from "@/queries/demography";
import { fetchVoterListExport, useVoterList } from "@/queries/demography";
import {
  copyVoterRows,
  downloadVoterCsv,
  downloadVoterExcel,
  printVoterTable,
  slugifyFilename,
} from "./lib/voter-list-export";

const PAGE_SIZES = [10, 25, 50, 100] as const;

const RACE_OPTIONS = [
  { value: "", label: "Semua kaum" },
  { value: "MELAYU", label: "Melayu" },
  { value: "CINA", label: "Cina" },
  { value: "INDIA", label: "India" },
  { value: "BUMIPUTERA SABAH", label: "Bumi Sabah" },
  { value: "BUMIPUTERA SARAWAK", label: "Bumi Sarawak" },
  { value: "LAIN-LAIN", label: "Lain-lain" },
] as const;

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

export function scopeToVoterArea(
  scope: DemographyScope,
): VoterListArea {
  if (scope.area === "NEGERI") {
    return { areaType: "NEGERI", areaName: scope.value };
  }
  if (scope.area === "PARLIMEN") {
    return { areaType: "PARLIMEN", areaCode: scope.value };
  }
  if (scope.area === "DUN") {
    return { areaType: "DUN", areaCode: scope.value };
  }
  if (scope.area === "DM") {
    return { areaType: "DM", areaCode: scope.value };
  }
  return { areaType: "NEGARA" };
}

export function rowToVoterListArea(
  parentScope: DemographyScope,
  row: DemographyTableRow,
  childArea: string,
): VoterListArea {
  if (parentScope.area === "NEGARA") {
    return { areaType: "NEGERI", areaName: row.name };
  }
  if (parentScope.area === "NEGERI") {
    return { areaType: "PARLIMEN", areaCode: row.code };
  }
  if (parentScope.area === "PARLIMEN") {
    return {
      areaType: childArea === "DM" ? "DM" : "DUN",
      areaCode: row.code,
    };
  }
  if (parentScope.area === "DUN") {
    return { areaType: "DM", areaCode: row.code };
  }
  if (parentScope.area === "DM") {
    return { areaType: "LOKALITI", areaCode: row.code };
  }
  return scopeToVoterArea(parentScope);
}

export type VoterListDialogState = {
  area: VoterListArea;
  filterKind?: VoterListQuery["filterKind"];
  filterKey?: string;
  title: string;
};

type VoterListDialogProps = {
  state: VoterListDialogState | null;
  onClose: () => void;
  onSelectVoter: (ic: string) => void;
};

export function VoterListDialog({
  state,
  onClose,
  onSelectVoter,
}: VoterListDialogProps) {
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(25);
  const [page, setPage] = useState(1);
  const [jantina, setJantina] = useState("");
  const [bangsa, setBangsa] = useState("");
  const [negeri, setNegeri] = useState("");
  const [exportMsg, setExportMsg] = useState("");
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!state) {
      setSearchInput("");
      setDebouncedSearch("");
      setPage(1);
      setPageSize(25);
      setJantina("");
      setBangsa("");
      setNegeri("");
      setExportMsg("");
      return;
    }
    setPage(1);
    setJantina("");
    setBangsa("");
    setNegeri("");
    setExportMsg("");
  }, [state]);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const sliceLocked = Boolean(state?.filterKind && state?.filterKey);

  const query = useMemo<VoterListQuery | null>(() => {
    if (!state) return null;
    return {
      ...state.area,
      filterKind: state.filterKind,
      filterKey: state.filterKey,
      q: debouncedSearch || undefined,
      jantina: jantina || undefined,
      bangsa: bangsa || undefined,
      negeri: negeri.trim() || undefined,
      limit: pageSize,
      offset: (page - 1) * pageSize,
    };
  }, [
    state,
    debouncedSearch,
    page,
    pageSize,
    jantina,
    bangsa,
    negeri,
  ]);

  const list = useVoterList(query);
  const rows = list.data?.rows ?? [];
  const total = list.data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  const rangeStart = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const rangeEnd = Math.min(page * pageSize, total);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, pageSize, jantina, bangsa, negeri]);

  const exportBase = useMemo(() => {
    if (!query) return null;
    const { limit: _l, offset: _o, ...rest } = query;
    return rest;
  }, [query]);

  const exportSlug = slugifyFilename(state?.title ?? "senarai-pengundi");

  async function handleExportAll() {
    if (!exportBase) return;
    setExporting(true);
    setExportMsg("");
    try {
      const result = await fetchVoterListExport(exportBase);
      downloadVoterCsv(
        `senarai-pengundi-${exportSlug}${result.truncated ? "-10k" : ""}.csv`,
        result.rows,
      );
      setExportMsg(
        result.truncated
          ? `Dimuat turun ${formatNumber(result.rows.length)} rekod (max 10,000)`
          : `Dimuat turun ${formatNumber(result.rows.length)} rekod`,
      );
    } catch (err) {
      setExportMsg(err instanceof Error ? err.message : "Muat turun gagal");
    } finally {
      setExporting(false);
    }
  }

  function handleExportPageCsv() {
    downloadVoterCsv(`senarai-pengundi-${exportSlug}-halaman.csv`, rows);
    setExportMsg(`CSV halaman (${rows.length} rekod) dimuat turun`);
  }

  function handleExportPageExcel() {
    downloadVoterExcel(`senarai-pengundi-${exportSlug}-halaman.xls`, rows);
    setExportMsg(`Excel halaman (${rows.length} rekod) dimuat turun`);
  }

  async function handleCopyPage() {
    await copyVoterRows(rows);
    setExportMsg("Disalin ke papan keratan");
  }

  function handlePrintPage() {
    printVoterTable(state?.title ?? "Senarai Pengundi", rows);
    setExportMsg("Dialog cetak dibuka");
  }

  return (
    <AnimatePresence>
      {state ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
          <motion.button
            type="button"
            aria-label="Tutup"
            className="absolute inset-0 bg-black/45"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="voter-list-title"
            className="relative flex max-h-[min(90vh,920px)] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-[var(--color-line)] bg-white shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-4 py-3 sm:px-5">
              <div>
                <h2
                  id="voter-list-title"
                  className="font-[family-name:var(--font-display)] text-lg text-[var(--color-ink)] sm:text-xl"
                >
                  Senarai Pengundi
                </h2>
                <p className="mt-1 text-sm text-[var(--color-ink-muted)]">
                  {state.title}
                </p>
                {sliceLocked ? (
                  <p className="mt-2 inline-flex rounded-full bg-[var(--color-accent-soft)] px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-accent)]">
                    Tapisan demografi aktif
                  </p>
                ) : null}
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-3 border-b border-[var(--color-line)] px-4 py-3 sm:px-5">
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
                  <Input
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    placeholder="Cari nama atau IC…"
                    className="pl-9"
                  />
                </div>
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  Papar
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
                  <Filter className="h-3.5 w-3.5" />
                  Tapisan
                </div>
                <select
                  value={jantina}
                  onChange={(e) => setJantina(e.target.value)}
                  disabled={state.filterKind === "gender"}
                  className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  <option value="">Semua jantina</option>
                  <option value="LELAKI">Lelaki</option>
                  <option value="PEREMPUAN">Perempuan</option>
                </select>
                <select
                  value={bangsa}
                  onChange={(e) => setBangsa(e.target.value)}
                  disabled={state.filterKind === "race"}
                  className="rounded-md border border-[var(--color-line)] bg-white px-2 py-1.5 text-sm disabled:opacity-50"
                >
                  {RACE_OPTIONS.map((opt) => (
                    <option key={opt.value || "all"} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <Input
                  value={negeri}
                  onChange={(e) => setNegeri(e.target.value)}
                  placeholder="Negeri…"
                  className="w-[160px]"
                />
                {(jantina || bangsa || negeri) && !sliceLocked ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setJantina("");
                      setBangsa("");
                      setNegeri("");
                    }}
                  >
                    Reset
                  </Button>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rows.length === 0}
                  onClick={handleExportPageCsv}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  CSV halaman
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rows.length === 0}
                  onClick={handleExportPageExcel}
                >
                  <FileSpreadsheet className="mr-1.5 h-4 w-4" />
                  Excel halaman
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={exporting || total === 0}
                  onClick={handleExportAll}
                >
                  <Download className="mr-1.5 h-4 w-4" />
                  {exporting ? "Memuat turun…" : "CSV (max 10k)"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rows.length === 0}
                  onClick={handleCopyPage}
                >
                  <Copy className="mr-1.5 h-4 w-4" />
                  Salin
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={rows.length === 0}
                  onClick={handlePrintPage}
                >
                  <Printer className="mr-1.5 h-4 w-4" />
                  Cetak
                </Button>
                {exportMsg ? (
                  <span className="text-xs text-[var(--color-ink-muted)]">
                    {exportMsg}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-auto px-4 py-3 sm:px-5">
              {list.isLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 rounded-lg" />
                  ))}
                </div>
              ) : list.isError ? (
                <p className="text-sm text-[var(--color-danger)]">
                  {(list.error as Error).message}
                </p>
              ) : rows.length === 0 ? (
                <p className="py-8 text-center text-sm text-[var(--color-ink-muted)]">
                  Tiada rekod dijumpai
                </p>
              ) : (
                <table className="w-full min-w-[860px] border-collapse text-sm">
                  <thead className="sticky top-0 z-[1] bg-white">
                    <tr className="border-b border-[var(--color-line)] text-left text-xs uppercase tracking-wide text-[var(--color-ink-muted)]">
                      <th className="px-2 py-2">Nama</th>
                      <th className="px-2 py-2">IC</th>
                      <th className="px-2 py-2">Media</th>
                      <th className="px-2 py-2">Jantina</th>
                      <th className="px-2 py-2">Kaum</th>
                      <th className="px-2 py-2">Umur</th>
                      <th className="px-2 py-2">Negeri</th>
                      <th className="hidden px-2 py-2 lg:table-cell">Parlimen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row.ic}
                        className="border-b border-[var(--color-line)] hover:bg-[var(--color-bg)]"
                      >
                        <td className="px-2 py-2">
                          <button
                            type="button"
                            onClick={() => onSelectVoter(row.ic)}
                            className="text-left font-medium text-[var(--color-accent)] underline-offset-2 hover:underline"
                          >
                            {row.nama}
                          </button>
                        </td>
                        <td className="px-2 py-2 tabular-nums">{row.ic}</td>
                        <td className="px-2 py-2">
                          {row.hasSocial ? (
                            <span
                              title="Ada media sosial"
                              className="inline-flex items-center gap-1 rounded bg-[var(--color-accent)]/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-[var(--color-accent)]"
                            >
                              <Share2 className="h-3 w-3" />
                              Ada
                            </span>
                          ) : (
                            <span className="text-[var(--color-ink-muted)]">—</span>
                          )}
                        </td>
                        <td className="px-2 py-2">{row.jantina}</td>
                        <td className="px-2 py-2">{row.bangsa}</td>
                        <td className="px-2 py-2 tabular-nums">{row.age}</td>
                        <td className="px-2 py-2">{row.negeri}</td>
                        <td className="hidden px-2 py-2 lg:table-cell">
                          {row.parlimen}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] bg-[var(--color-bg)]/40 px-4 py-3 sm:px-5">
              <p className="text-xs text-[var(--color-ink-muted)]">
                {total === 0
                  ? "Tiada rekod"
                  : `Paparan ${rangeStart}-${rangeEnd} daripada ${formatNumber(total)}`}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2 text-xs tabular-nums text-[var(--color-ink-muted)]">
                  {page} / {formatNumber(pages)}
                </span>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage((p) => Math.min(pages, p + 1))}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={page >= pages}
                  onClick={() => setPage(pages)}
                >
                  <ChevronsRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      ) : null}
    </AnimatePresence>
  );
}

export function segmentToFilter(
  chart: "race" | "age" | "gender",
  segmentKey: string,
): Pick<VoterListQuery, "filterKind" | "filterKey"> {
  return { filterKind: chart, filterKey: segmentKey };
}
