import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FlaskConical, X } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { electoralAssetUrl } from "@/lib/electoral-assets";
import { useSeatDetail } from "@/queries/explore";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";
import { simulationHrefFromExplore } from "@/features/simulation/lib/simulation-scope";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

function formatMajority(majority: number, majorityPercent: number) {
  if (majority <= 0) return "NO DATA";
  return `${formatNumber(majority)} (${majorityPercent}%)`;
}

export function ConstituencySheet() {
  const navigate = useNavigate();
  const code = useExploreWorkspaceStore((s) => s.selectedConstituencyId);
  const electoralType = useExploreWorkspaceStore((s) => s.selectedElectoralType);
  const mapLevel = useExploreWorkspaceStore((s) => s.mapLevel);
  const presentation = useExploreWorkspaceStore((s) => s.presentation);
  const filters = useExploreWorkspaceStore((s) => s.filters);
  const setSelected = useExploreWorkspaceStore(
    (s) => s.setSelectedConstituencyId,
  );
  const setSelectedElectoralType = useExploreWorkspaceStore(
    (s) => s.setSelectedElectoralType,
  );
  const type = electoralType || mapLevel;
  const detail = useSeatDetail(code, type, presentation);
  const [backdropReady, setBackdropReady] = useState(false);

  // Avoid the click that opened this sheet from immediately closing it
  // (e.g. seat search result → backdrop receives the same pointer event).
  useEffect(() => {
    if (!code) {
      setBackdropReady(false);
      return;
    }
    setBackdropReady(false);
    const id = window.setTimeout(() => setBackdropReady(true), 50);
    return () => window.clearTimeout(id);
  }, [code]);

  const stateFilter =
    filters.state && filters.state !== "0" ? filters.state.toUpperCase() : "";

  function closeDetail() {
    // Dismiss the side panel only. Seat search (if any) keeps Status /
    // Demografi scoped via searchSelection fallback on the Explore page.
    setSelected(null);
    setSelectedElectoralType(null);
  }

  function openIndividualSimulation() {
    navigate(
      simulationHrefFromExplore({
        mapLevel: type,
        selectedConstituencyId: code,
        selectedElectoralType: type,
        appliedState: stateFilter || detail.data?.state?.toUpperCase() || "",
      }),
    );
  }

  return (
    <AnimatePresence>
      {code && (
        <>
          <motion.button
            type="button"
            aria-label="Close details"
            className="fixed inset-0 z-[1100] bg-[var(--color-ink)]/25 backdrop-blur-[1px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => {
              if (!backdropReady) return;
              closeDetail();
            }}
          />
          <motion.aside
            initial={{ x: 28, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 20, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
            className="fixed bottom-0 right-0 top-0 z-[1200] flex w-full max-w-md flex-col border-l border-[var(--color-line)] bg-white shadow-2xl"
          >
            <div className="flex items-start justify-between gap-3 border-b border-[var(--color-line)] px-5 py-4">
              <div>
                <div className="text-xs font-medium uppercase tracking-[0.16em] text-[var(--color-ink-muted)]">
                  {type === "dun" ? "DUN" : "Parliament"}
                  {presentation === "ops66" ? " · OPS66" : ""}
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
                onClick={closeDetail}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 space-y-5 overflow-auto p-5">
              {detail.isLoading && (
                <div className="space-y-3">
                  <Skeleton className="h-28" />
                  <Skeleton className="h-24" />
                  <Skeleton className="h-24" />
                </div>
              )}

              {detail.data && (
                <>
                  <SeatProfile data={detail.data} />

                  <Button
                    type="button"
                    className="w-full"
                    onClick={openIndividualSimulation}
                  >
                    <FlaskConical className="h-4 w-4" />
                    Simulasi Undian (Auto)
                  </Button>

                  <div className="grid grid-cols-2 gap-3">
                    <Stat label="State" value={detail.data.state} />
                    <Stat label="Turnout" value={`${detail.data.turnout}%`} />
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

function SeatProfile({ data }: { data: NonNullable<ReturnType<typeof useSeatDetail>["data"]> }) {
  const constituencyLine = [
    data.displayCode,
    data.name.toUpperCase(),
    data.displayParty ? `(${data.displayParty})` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4">
      <div className="flex gap-4">
        <MemberPhoto
          primary={data.memberPhoto}
          fallback={data.memberPhotoFallback}
          alt={data.member || data.name}
        />

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-base font-bold uppercase leading-tight text-[var(--color-ink)]">
                {data.member || "—"}
              </div>
              <div className="mt-1 text-sm font-semibold text-[#1f6fb2]">
                {constituencyLine}
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <PartyLogo
                src={data.groupLogo}
                fallback={data.groupLogoFallback}
                alt={data.partyGroup || "Coalition"}
              />
              {!data.hidePartyLogo && (
                <PartyLogo
                  src={data.partyLogo}
                  fallback={data.partyLogoFallback}
                  alt={data.party}
                />
              )}
            </div>
          </div>

          <div className="mt-3 space-y-1 text-sm text-[var(--color-ink)]">
            <div>
              <span className="font-semibold uppercase tracking-wide">
                Majority:
              </span>{" "}
              {formatMajority(data.majority, data.majorityPercent)}
            </div>
            <div>
              <span className="font-semibold uppercase tracking-wide">
                TOV:
              </span>{" "}
              {data.turnout}%
            </div>
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-[var(--color-ink-muted)]">
            <span
              className="h-2.5 w-2.5 rounded-full"
              style={{ background: data.color }}
            />
            <span className="font-semibold text-[var(--color-ink)]">
              {data.party}
            </span>
            {data.partyGroup ? (
              <>
                <span>·</span>
                <span>{data.partyGroup}</span>
              </>
            ) : null}
            {data.parliamentCode ? (
              <>
                <span>·</span>
                <span>Par {data.parliamentCode}</span>
              </>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function MemberPhoto({
  primary,
  fallback,
  alt,
}: {
  primary: string;
  fallback: string;
  alt: string;
}) {
  const url = electoralAssetUrl(primary);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [primary]);

  return (
    <img
      src={useFallback ? electoralAssetUrl(fallback) : url}
      alt={alt}
      className="h-20 w-20 shrink-0 rounded-md border border-[var(--color-line)] bg-white object-cover object-top"
      onError={() => {
        if (!useFallback) setUseFallback(true);
      }}
    />
  );
}

function PartyLogo({
  src,
  fallback,
  alt,
}: {
  src: string;
  fallback: string;
  alt: string;
}) {
  const primary = electoralAssetUrl(src);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [src]);

  return (
    <img
      src={useFallback ? electoralAssetUrl(fallback) : primary}
      alt={alt}
      className="h-8 max-w-[52px] border border-[var(--color-line)] bg-white object-contain p-0.5"
      onError={() => {
        if (!useFallback) setUseFallback(true);
      }}
    />
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
