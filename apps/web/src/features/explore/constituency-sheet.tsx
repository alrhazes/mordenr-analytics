import { X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useParliamentDetail } from "@/queries/explore";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

export function ConstituencySheet() {
  const code = useExploreWorkspaceStore((s) => s.selectedConstituencyId);
  const setSelected = useExploreWorkspaceStore(
    (s) => s.setSelectedConstituencyId,
  );
  const detail = useParliamentDetail(code);

  return (
    <AnimatePresence>
      {code && (
        <>
          <motion.button
            type="button"
            aria-label="Close details"
            className="fixed inset-0 z-40 bg-[var(--color-ink)]/25 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelected(null)}
          />
          <motion.aside
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-0 right-0 top-0 z-50 flex w-full max-w-md flex-col border-l border-[var(--color-line)] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                  Parliament
                </div>
                {detail.isLoading ? (
                  <Skeleton className="mt-2 h-7 w-48" />
                ) : (
                  <h2 className="mt-1 font-[family-name:var(--font-display)] text-2xl text-[var(--color-ink)]">
                    {detail.data?.name || code}
                  </h2>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setSelected(null)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-auto p-5">
              {detail.isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-16" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              )}

              {detail.data && (
                <>
                  <div className="flex items-center gap-3">
                    <span
                      className="h-3 w-3 rounded-full"
                      style={{ background: detail.data.color }}
                    />
                    <div>
                      <div className="text-sm font-semibold">
                        {detail.data.party}
                      </div>
                      <div className="text-xs text-[var(--color-ink-muted)]">
                        {detail.data.partyGroup || "—"} · {detail.data.code}
                      </div>
                    </div>
                  </div>

                  <div>
                    <div className="text-xs uppercase tracking-[0.14em] text-[var(--color-ink-muted)]">
                      Member
                    </div>
                    <p className="mt-1 text-sm leading-relaxed">
                      {detail.data.member || "—"}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <Stat
                      label="State"
                      value={detail.data.state}
                    />
                    <Stat
                      label="Turnout"
                      value={`${detail.data.turnout}%`}
                    />
                    <Stat
                      label="Electorate"
                      value={formatNumber(detail.data.electorate)}
                    />
                    <Stat
                      label="Majority"
                      value={formatNumber(detail.data.majority)}
                    />
                    <Stat
                      label="Valid votes"
                      value={formatNumber(detail.data.validVotes)}
                    />
                    <Stat
                      label="Majority %"
                      value={`${detail.data.majorityPercent}%`}
                    />
                  </div>
                </>
              )}

              {detail.isError && (
                <p className="text-sm text-[var(--color-danger)]">
                  {(detail.error as Error).message}
                </p>
              )}
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-bg)] px-3 py-2.5">
      <div className="text-[11px] uppercase tracking-[0.12em] text-[var(--color-ink-muted)]">
        {label}
      </div>
      <div className="mt-1 text-sm font-semibold tabular-nums text-[var(--color-ink)]">
        {value}
      </div>
    </div>
  );
}
