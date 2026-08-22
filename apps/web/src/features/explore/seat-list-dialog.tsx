import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  FileSpreadsheet,
  Printer,
  Search,
  X,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ElectoralImage } from "@/features/explore/electoral-image";
import {
  copyRowsToClipboard,
  downloadTextFile,
  filterSeatListRows,
  paginateRows,
  printSeatListTable,
  rowsToCsv,
  seatListExportColumns,
  totalPages,
} from "@/features/explore/lib/seat-list-export";
import type { SeatListRow } from "@/queries/explore";
import { useSeatList } from "@/queries/explore";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";

const PAGE_SIZES = [10, 25, 50, 100, -1] as const;

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

export function SeatListDialog() {
  const open = useExploreWorkspaceStore((s) => s.senaraiOpen);
  const setOpen = useExploreWorkspaceStore((s) => s.setSenaraiOpen);
  const mapLevel = useExploreWorkspaceStore((s) => s.mapLevel);
  const presentation = useExploreWorkspaceStore((s) => s.presentation);
  const filters = useExploreWorkspaceStore((s) => s.filters);
  const setSelectedConstituencyId = useExploreWorkspaceStore(
    (s) => s.setSelectedConstituencyId,
  );
  const setSelectedElectoralType = useExploreWorkspaceStore(
    (s) => s.setSelectedElectoralType,
  );

  const list = useSeatList(open, { level: mapLevel, presentation, filters });
  const title =
    mapLevel === "parliament" ? "Senarai Parlimen" : "Senarai Dun";
  const scopeLabel =
    filters.state && filters.state !== "0"
      ? `[${filters.state.toUpperCase()}]`
      : "[NEGARA]";

  const [search, setSearch] = useState("");
  const [pageSize, setPageSize] = useState<number>(10);
  const [page, setPage] = useState(1);
  const [exportMsg, setExportMsg] = useState("");

  useEffect(() => {
    if (!open) {
      setSearch("");
      setPage(1);
      setPageSize(10);
      setExportMsg("");
    }
  }, [open]);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, list.data?.rows.length]);

  const filteredRows = useMemo(
    () => filterSeatListRows(list.data?.rows ?? [], search),
    [list.data?.rows, search],
  );
  const pages = totalPages(filteredRows.length, pageSize);
  const pageRows = paginateRows(filteredRows, page, pageSize);
  const exportColumns = seatListExportColumns(mapLevel);

  const rangeStart =
    filteredRows.length === 0
      ? 0
      : pageSize < 0
        ? 1
        : (page - 1) * pageSize + 1;
  const rangeEnd =
    pageSize < 0
      ? filteredRows.length
      : Math.min(page * pageSize, filteredRows.length);

  async function handleCopy() {
    await copyRowsToClipboard(filteredRows, exportColumns);
    setExportMsg("Disalin ke papan keratan");
  }

  function handleCsv() {
    const csv = rowsToCsv(filteredRows, exportColumns);
    const slug = mapLevel === "parliament" ? "parlimen" : "dun";
    downloadTextFile(`${slug}-senarai.csv`, csv);
    setExportMsg("CSV dimuat turun");
  }

  function handleExcel() {
    const csv = rowsToCsv(filteredRows, exportColumns);
    const slug = mapLevel === "parliament" ? "parlimen" : "dun";
    downloadTextFile(
      `${slug}-senarai.xls`,
      csv,
      "application/vnd.ms-excel;charset=utf-8;",
    );
    setExportMsg("Excel dimuat turun");
  }

  function handlePrint() {
    printSeatListTable(`${title} ${scopeLabel}`, filteredRows, exportColumns);
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            type="button"
            aria-label="Close"
            className="fixed inset-0 z-50 bg-[var(--color-ink)]/30 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            role="dialog"
            aria-modal
            aria-labelledby="senarai-title"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            className="fixed inset-x-3 top-[4vh] z-50 mx-auto flex max-h-[92vh] w-[min(98vw,1280px)] flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-3">
              <div>
                <h2
                  id="senarai-title"
                  className="text-lg font-semibold text-[var(--color-ink)]"
                >
                  {title} {scopeLabel}
                </h2>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {list.data
                    ? `${filteredRows.length} rekod`
                    : "Memuatkan…"}
                  {presentation === "ops66" ? " · OPS 66" : ""}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setOpen(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                  Copy
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleCsv}>
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                  CSV
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleExcel}>
                  <FileSpreadsheet className="mr-1.5 h-3.5 w-3.5" />
                  Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="mr-1.5 h-3.5 w-3.5" />
                  Print
                </Button>
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-[var(--color-ink-muted)]">
                  Show
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="h-9 rounded-md border border-[var(--color-line)] bg-white px-2 text-sm text-[var(--color-ink)]"
                  >
                    {PAGE_SIZES.map((size) => (
                      <option key={size} value={size}>
                        {size < 0 ? "ALL" : size}
                      </option>
                    ))}
                  </select>
                  entries
                </label>
                <div className="relative min-w-[220px]">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search…"
                    className="h-9 pl-9"
                  />
                </div>
              </div>
            </div>

            {exportMsg && (
              <div className="border-b border-[var(--color-line)] bg-[var(--color-accent)]/5 px-4 py-2 text-xs text-[var(--color-ink-muted)]">
                {exportMsg}
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {list.isLoading && (
                <div className="space-y-2 p-4">
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                  <Skeleton className="h-8" />
                </div>
              )}
              {list.isError && (
                <p className="p-4 text-sm text-[var(--color-danger)]">
                  {(list.error as Error).message}
                </p>
              )}
              {list.data && (
                <table className="w-full min-w-[1100px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 z-10 bg-[#eef2f7] text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
                    <tr>
                      <th className="px-3 py-2 font-semibold">
                        {mapLevel === "parliament" ? "Nama MP" : "Nama ADUN"}
                      </th>
                      <th className="px-3 py-2 font-semibold">Gabungan</th>
                      <th className="px-3 py-2 font-semibold">Parti</th>
                      {mapLevel === "dun" && (
                        <th className="px-3 py-2 font-semibold">Parlimen</th>
                      )}
                      <th className="px-3 py-2 font-semibold">
                        {mapLevel === "parliament" ? "Parlimen" : "Dun"}
                      </th>
                      <th className="px-3 py-2 font-semibold text-right">
                        Jumlah Pengundi
                      </th>
                      <th className="px-3 py-2 font-semibold">Kerajaan</th>
                      <th className="px-3 py-2 font-semibold">Negeri</th>
                      <th className="px-3 py-2 font-semibold">Tahun</th>
                      <th className="px-3 py-2 font-semibold">Kaum</th>
                      <th className="px-3 py-2 font-semibold text-right">
                        Majoriti
                      </th>
                      <th className="px-3 py-2 font-semibold text-right">
                        TOV
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map((row) => (
                      <tr
                        key={row.mapCode}
                        className="cursor-pointer border-t border-[var(--color-line)] hover:bg-[var(--color-accent)]/5"
                        onClick={() => {
                          setSelectedConstituencyId(row.mapCode);
                          setSelectedElectoralType(mapLevel);
                          setOpen(false);
                        }}
                      >
                        <td className="px-3 py-2">
                          <MemberCell row={row} />
                        </td>
                        <td className="px-3 py-2">
                          <LogoLabel
                            src={row.groupLogo}
                            fallback={row.groupLogoFallback}
                            label={row.partyGroup}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <LogoLabel
                            src={row.partyLogo}
                            fallback={row.partyLogoFallback}
                            label={row.party}
                          />
                        </td>
                        {mapLevel === "dun" && (
                          <td className="px-3 py-2">{row.parliamentCode || "—"}</td>
                        )}
                        <td className="px-3 py-2 text-[#1f6fb2]">{row.seatLabel}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(row.voters)}
                        </td>
                        <td className="px-3 py-2">
                          <LogoLabel
                            src={row.governmentLogo}
                            fallback={row.governmentLogoFallback}
                            label={row.government}
                            imgClassName="h-7 max-w-[34px]"
                          />
                        </td>
                        <td className="px-3 py-2">
                          <LogoLabel
                            src={row.stateLogo}
                            fallback={row.stateLogoFallback}
                            label={row.state}
                            imgClassName="h-6 max-w-[34px]"
                          />
                        </td>
                        <td className="px-3 py-2">{row.year || "—"}</td>
                        <td className="px-3 py-2">
                          <EthnicityCell row={row} />
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(row.majority)} ({row.majorityPercent}%)
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {row.turnout}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {!list.isLoading && list.data && pageRows.length === 0 && (
                <p className="p-8 text-center text-sm text-[var(--color-ink-muted)]">
                  Tiada rekod sepadan carian
                </p>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--color-line)] bg-[var(--color-bg)] px-4 py-3 text-sm">
              <div className="text-[var(--color-ink-muted)]">
                Showing {rangeStart} to {rangeEnd} of {filteredRows.length} entries
              </div>
              {pageSize > 0 && pages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage(1)}
                  >
                    <ChevronsLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[72px] text-center tabular-nums">
                    {page} / {pages}
                  </span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= pages}
                    onClick={() => setPage((p) => Math.min(pages, p + 1))}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    disabled={page >= pages}
                    onClick={() => setPage(pages)}
                  >
                    <ChevronsRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function MemberCell({ row }: { row: SeatListRow }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <ElectoralImage
        src={row.memberPhoto}
        fallback={row.memberPhotoFallback}
        alt={row.member}
        className="h-9 w-9 border border-[var(--color-line)] object-cover object-top"
      />
      <span className="font-medium text-[var(--color-ink)]">
        {row.member || "—"}
      </span>
    </div>
  );
}

function LogoLabel({
  src,
  fallback,
  label,
  imgClassName = "h-7 max-w-[40px] border border-[var(--color-line)] p-px",
}: {
  src: string;
  fallback: string;
  label: string;
  imgClassName?: string;
}) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap">
      <ElectoralImage
        src={src}
        fallback={fallback}
        alt={label}
        className={imgClassName}
      />
      <span>{label || "—"}</span>
    </div>
  );
}

function EthnicityCell({ row }: { row: SeatListRow }) {
  if (!row.ethnicityLabel) {
    return <span className="text-[var(--color-ink-muted)]">—</span>;
  }

  return (
    <div className="min-w-[120px]">
      <div className="mb-1 text-xs">
        {row.ethnicityLabel} {row.ethnicityPercent}%
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#e8edf3]">
        <div
          className="h-full rounded-full bg-[#2f9e44]"
          style={{ width: `${Math.min(100, row.ethnicityPercent)}%` }}
        />
      </div>
    </div>
  );
}
