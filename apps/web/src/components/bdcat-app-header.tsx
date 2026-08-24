import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { Command } from "cmdk";
import { MapPin, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NetworkSpeedBadge } from "@/components/network-speed-badge";
import { useMe } from "@/queries/auth";
import {
  formatGlobalSearchCount,
  useGlobalSearchDebounced,
  useGlobalSearchMeta,
  type GlobalSearchSuggestion,
} from "@/queries/global-search";
import { PartyLogoPair } from "@/features/explore/party-logo-pair";
import { VoterPhoto } from "@/features/explore/voter-photo";
import { applyGlobalSearchSelection } from "@/features/explore/lib/global-search-actions";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";

function formatLoginTime(date: Date) {
  return date.toLocaleTimeString("en-MY", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

type Props = {
  sidebarToggle?: React.ReactNode;
};

export function BdcatAppHeader({ sidebarToggle }: Props) {
  const { data: user } = useMe();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <header className="sticky top-0 z-20 flex min-h-14 flex-wrap items-center gap-3 border-b border-[var(--color-line)] bg-[var(--color-surface)]/90 px-4 py-2 backdrop-blur">
      {sidebarToggle}
      <div className="hidden min-w-0 flex-1 text-sm text-[var(--color-ink-muted)] sm:block">
        Login:{" "}
        <span className="text-[var(--color-ink)]">
          {user?.name || "User"}, {formatLoginTime(now)}
        </span>
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-3">
        <NetworkSpeedBadge />
        <EnterpriseGlobalSearch />
      </div>
    </header>
  );
}

function EnterpriseGlobalSearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const meta = useGlobalSearchMeta();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [notice, setNotice] = useState("");
  const search = useGlobalSearchDebounced(q, open);

  const resetAllFilters = useExploreWorkspaceStore((s) => s.resetAllFilters);
  const setMapLevel = useExploreWorkspaceStore((s) => s.setMapLevel);
  const setSearchSelection = useExploreWorkspaceStore((s) => s.setSearchSelection);
  const setSelectedConstituencyId = useExploreWorkspaceStore(
    (s) => s.setSelectedConstituencyId,
  );
  const setSelectedElectoralType = useExploreWorkspaceStore(
    (s) => s.setSelectedElectoralType,
  );

  const totalRecords = meta.data?.totalRecords ?? 21_000_000;
  const placeholder = useMemo(() => {
    const count = formatGlobalSearchCount(totalRecords);
    return `Search (${count})`;
  }, [totalRecords]);

  function pick(item: GlobalSearchSuggestion) {
    const msg = applyGlobalSearchSelection(item, navigate, {
      resetAllFilters,
      setMapLevel,
      setSearchSelection,
      setSelectedConstituencyId,
      setSelectedElectoralType,
    });
    setOpen(false);
    setQ("");
    if (msg) setNotice(msg);
  }

  useEffect(() => {
    if (!notice) return;
    const id = window.setTimeout(() => setNotice(""), 4000);
    return () => window.clearTimeout(id);
  }, [notice]);

  const isSearching =
    q.trim().length > 0 && (search.isDebouncing || search.isFetching);

  return (
    <div className="relative w-full min-w-[220px] sm:w-auto">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--color-ink-muted)]" />
        <Input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
            setNotice("");
          }}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          placeholder={placeholder}
          className="h-9 w-full min-w-[260px] max-w-md border-[var(--color-line)] bg-[var(--color-bg)] pl-9 pr-3 sm:w-[320px]"
        />
      </div>

      {notice && (
        <div className="absolute right-0 top-[calc(100%+4px)] z-50 max-w-md rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] px-3 py-2 text-xs text-[var(--color-ink-muted)] shadow-lg">
          {notice}
        </div>
      )}

      {open && q.trim() && (
        <>
          <button
            type="button"
            aria-label="Close search"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-[min(92vw,440px)] overflow-hidden rounded-lg border border-[var(--color-line)] bg-[var(--color-surface)] shadow-2xl">
            <Command shouldFilter={false} label="Enterprise global search">
              <Command.List className="max-h-80 overflow-auto p-1">
                {isSearching && (
                  <div className="px-3 py-4 text-center text-sm text-[var(--color-ink-muted)]">
                    Mencari…
                  </div>
                )}
                {!isSearching &&
                  (search.data?.suggestions.length ?? 0) === 0 && (
                    <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--color-ink-muted)]">
                      Tiada keputusan
                    </Command.Empty>
                  )}
                {(search.data?.suggestions || []).map((item) => (
                  <GlobalSearchItem
                    key={`${item.type}-${item.id}-${item.value}`}
                    item={item}
                    onSelect={() => pick(item)}
                  />
                ))}
              </Command.List>
            </Command>
            {search.data?.source && location.pathname.startsWith("/explore") && (
              <div className="border-t border-[var(--color-line)] px-3 py-1.5 text-[10px] text-[var(--color-ink-muted)]">
                Source: {search.data.source.replace(/_/g, " ")}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function GlobalSearchItem({
  item,
  onSelect,
}: {
  item: GlobalSearchSuggestion;
  onSelect: () => void;
}) {
  const isSeat = item.type === "par" || item.type === "dun";
  const isVoter = item.type === "voters";
  const hasLogos = isSeat && item.groupLogo && item.partyLogo;
  const hasVoterPhoto = isVoter && Boolean(item.ic || item.photo || item.photoLocal);

  return (
    <Command.Item
      value={`${item.type}-${item.id}-${item.value}`}
      onSelect={onSelect}
      className="flex cursor-pointer items-start gap-2 rounded-md px-2 py-2 text-sm aria-selected:bg-[var(--color-accent-soft)]"
    >
      {hasLogos ? (
        <PartyLogoPair
          groupLogo={item.groupLogo!}
          partyLogo={item.partyLogo!}
          groupLogoFallback={item.groupLogoFallback || "parties/ind.png"}
          partyLogoFallback={item.partyLogoFallback || "parties/ind.png"}
          hidePartyLogo={item.hidePartyLogo}
          groupAlt={item.partyGroup || "Coalition"}
          partyAlt={item.party || "Party"}
          className="mt-0.5"
        />
      ) : hasVoterPhoto ? (
        <VoterPhoto
          ic={item.ic}
          photo={item.photo}
          photoLocal={item.photoLocal}
          photoFallback={item.photoFallback}
          alt={item.value}
          className="mt-0.5 h-8 w-8"
        />
      ) : (
        <SuggestionIcon type={item.type} />
      )}
      <div className="min-w-0 flex-1">
        <div className="font-medium text-[var(--color-ink)]">{item.value}</div>
        <div className="text-xs text-[var(--color-ink-muted)]">
          {isSeat && item.member
            ? `${item.member} · ${item.party || item.partyGroup || item.label}`
            : item.label || item.type.toUpperCase()}
          {item.ic ? ` · ${item.ic}` : ""}
        </div>
      </div>
    </Command.Item>
  );
}

function SuggestionIcon({ type }: { type: string }) {
  const className =
    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-accent)]";

  if (type === "voters") {
    return (
      <span className={className}>
        <User className="h-3 w-3" />
      </span>
    );
  }

  if (type === "map_location" || type === "table_location" || type === "dm") {
    return (
      <span className={className}>
        <MapPin className="h-3 w-3" />
      </span>
    );
  }

  return (
    <span className={className}>
      <Search className="h-3 w-3" />
    </span>
  );
}
