import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useSeatList } from "@/queries/explore";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";

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
            className="fixed inset-x-4 top-[8vh] z-50 mx-auto flex max-h-[84vh] w-[min(96vw,1100px)] flex-col overflow-hidden rounded-xl border border-[var(--color-line)] bg-white shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-3">
              <div>
                <h2
                  id="senarai-title"
                  className="text-lg font-semibold text-[var(--color-ink)]"
                >
                  {title}
                </h2>
                <p className="text-xs text-[var(--color-ink-muted)]">
                  {list.data
                    ? `${list.data.rows.length} rekod`
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
                <table className="w-full min-w-[900px] border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-[var(--color-bg)] text-[10px] uppercase tracking-wider text-[var(--color-ink-muted)]">
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
                        Pengundi
                      </th>
                      <th className="px-3 py-2 font-semibold">Kerajaan</th>
                      <th className="px-3 py-2 font-semibold">Negeri</th>
                      <th className="px-3 py-2 font-semibold">Tahun</th>
                      <th className="px-3 py-2 font-semibold text-right">
                        Majoriti
                      </th>
                      <th className="px-3 py-2 font-semibold text-right">
                        TOV
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {list.data.rows.map((row) => (
                      <tr
                        key={row.mapCode}
                        className="cursor-pointer border-t border-[var(--color-line)] hover:bg-[var(--color-accent)]/5"
                        onClick={() => {
                          setSelectedConstituencyId(row.mapCode);
                          setSelectedElectoralType(mapLevel);
                          setOpen(false);
                        }}
                      >
                        <td className="px-3 py-2">{row.member || "—"}</td>
                        <td className="px-3 py-2">{row.partyGroup}</td>
                        <td className="px-3 py-2">{row.party}</td>
                        {mapLevel === "dun" && (
                          <td className="px-3 py-2">
                            {row.parliamentCode || "—"}
                          </td>
                        )}
                        <td className="px-3 py-2">{row.seatLabel}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(row.voters)}
                        </td>
                        <td className="px-3 py-2">{row.government}</td>
                        <td className="px-3 py-2">{row.state}</td>
                        <td className="px-3 py-2">{row.year || "—"}</td>
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
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
