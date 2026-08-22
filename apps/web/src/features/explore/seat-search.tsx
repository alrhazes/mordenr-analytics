import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { Search, Undo2 } from "lucide-react";
import { useSeatSearch } from "@/queries/explore";
import { useExploreWorkspaceStore } from "@/stores/explore-workspace";

export function SeatSearch() {
  const presentation = useExploreWorkspaceStore((s) => s.presentation);
  const searchSelection = useExploreWorkspaceStore((s) => s.searchSelection);
  const setSearchSelection = useExploreWorkspaceStore((s) => s.setSearchSelection);
  const clearSearch = useExploreWorkspaceStore((s) => s.clearSearch);
  const resetAllFilters = useExploreWorkspaceStore((s) => s.resetAllFilters);
  const setMapLevel = useExploreWorkspaceStore((s) => s.setMapLevel);

  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const search = useSeatSearch(q, presentation);

  useEffect(() => {
    if (!open) setQ("");
  }, [open]);

  return (
    <div className="relative min-w-[220px] flex-1">
      <label className="mb-1.5 flex items-center gap-2 text-sm font-semibold text-[var(--color-ink)]">
        <Search className="h-4 w-4 text-[var(--color-ink-muted)]" />
        Carian Negeri, Parlimen, Dun, MP, ADUN
      </label>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex h-10 flex-1 items-center rounded-md border border-[var(--color-line)] bg-white px-3 text-left text-sm text-[var(--color-ink-muted)] outline-none focus:ring-2 focus:ring-[var(--color-accent)]"
        >
          {searchSelection ? (
            <span className="truncate text-[var(--color-ink)]">
              {searchSelection.display}
            </span>
          ) : (
            <span className="truncate uppercase tracking-wide">
              Carian negeri, parlimen, dun, mp, ad…
            </span>
          )}
        </button>
        {searchSelection && (
          <button
            type="button"
            title="Kembali"
            className="inline-flex h-10 items-center gap-1.5 rounded-md border border-[var(--color-danger)]/40 px-3 text-sm font-medium text-[var(--color-danger)]"
            onClick={() => {
              clearSearch();
              resetAllFilters();
            }}
          >
            <Undo2 className="h-3.5 w-3.5" />
            Kembali
          </button>
        )}
      </div>

      {open && (
        <>
          <button
            type="button"
            aria-label="Close search"
            className="fixed inset-0 z-40"
            onClick={() => setOpen(false)}
          />
          <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-[var(--color-line)] bg-white shadow-xl">
            <Command shouldFilter={false} label="Seat search">
              <Command.Input
                autoFocus
                value={q}
                onValueChange={setQ}
                placeholder="Taip nama, kod, MP, ADUN…"
                className="h-10 w-full border-b border-[var(--color-line)] px-3 text-sm outline-none"
              />
              <Command.List className="max-h-72 overflow-auto p-1">
                <Command.Empty className="px-3 py-6 text-center text-sm text-[var(--color-ink-muted)]">
                  {search.isLoading ? "Mencari…" : "Tiada keputusan"}
                </Command.Empty>
                {(search.data?.groups || []).map((g) => (
                  <Command.Group
                    key={g.state}
                    heading={g.state}
                    className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--color-ink-muted)]"
                  >
                    {g.options.map((o) => (
                      <Command.Item
                        key={o.code}
                        value={o.code}
                        onSelect={() => {
                          resetAllFilters();
                          setMapLevel(
                            o.electoralType === "dun" ? "dun" : "parliament",
                          );
                          setSearchSelection(o);
                          setOpen(false);
                        }}
                        className="cursor-pointer rounded-md px-2 py-2 text-sm aria-selected:bg-[var(--color-accent)]/10"
                      >
                        <div className="font-medium text-[var(--color-ink)]">
                          {o.display}
                        </div>
                        <div className="text-xs text-[var(--color-ink-muted)]">
                          {o.member || "—"} · {o.party}
                        </div>
                      </Command.Item>
                    ))}
                  </Command.Group>
                ))}
              </Command.List>
            </Command>
          </div>
        </>
      )}
    </div>
  );
}
