import { useMemo, useState } from "react";
import { ChevronRight, ChevronsRight, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { SimulationSeatOption } from "@/stores/simulation-workspace";

type Props = {
  available: SimulationSeatOption[];
  selected: string[];
  onChange: (codes: string[]) => void;
};

function filterSeats(seats: SimulationSeatOption[], q: string) {
  const needle = q.trim().toLowerCase();
  if (!needle) return seats;
  return seats.filter(
    (s) =>
      s.code.toLowerCase().includes(needle) ||
      s.name.toLowerCase().includes(needle) ||
      s.state.toLowerCase().includes(needle) ||
      s.label.toLowerCase().includes(needle),
  );
}

function sortByCode(seats: SimulationSeatOption[]) {
  return [...seats].sort((a, b) =>
    a.code.localeCompare(b.code, undefined, { numeric: true }),
  );
}

export function SeatDualList({ available, selected, onChange }: Props) {
  const [availSearch, setAvailSearch] = useState("");
  const [selSearch, setSelSearch] = useState("");
  const [highlightAvail, setHighlightAvail] = useState<string[]>([]);
  const [highlightSel, setHighlightSel] = useState<string[]>([]);

  const selectedSet = useMemo(() => new Set(selected), [selected]);
  const availableList = useMemo(
    () =>
      sortByCode(
        filterSeats(
          available.filter((s) => !selectedSet.has(s.code)),
          availSearch,
        ),
      ),
    [available, selectedSet, availSearch],
  );
  const selectedList = useMemo(() => {
    const map = new Map(available.map((s) => [s.code, s]));
    return sortByCode(
      filterSeats(
        selected
          .map((code) => map.get(code))
          .filter(Boolean) as SimulationSeatOption[],
        selSearch,
      ),
    );
  }, [available, selected, selSearch]);

  function moveToSelected() {
    onChange([...new Set([...selected, ...highlightAvail])]);
    setHighlightAvail([]);
  }

  function moveToAvailable() {
    const remove = new Set(highlightSel);
    onChange(selected.filter((c) => !remove.has(c)));
    setHighlightSel([]);
  }

  function toggleHighlight(
    code: string,
    list: string[],
    setList: (v: string[]) => void,
  ) {
    setList(list.includes(code) ? list.filter((c) => c !== code) : [...list, code]);
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-[1fr_auto_1fr]">
        <ListPanel
          title="SENARAI TERSEDIA"
          search={availSearch}
          onSearch={setAvailSearch}
          items={availableList}
          highlighted={highlightAvail}
          onToggle={(code) => toggleHighlight(code, highlightAvail, setHighlightAvail)}
        />
        <div className="flex flex-row items-center justify-center gap-2 lg:flex-col">
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={moveToSelected}
            disabled={highlightAvail.length === 0}
            aria-label="Pindah ke pilihan"
          >
            <ChevronRight className="h-4 w-4 lg:rotate-0 rotate-90" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="outline"
            onClick={moveToAvailable}
            disabled={highlightSel.length === 0}
            aria-label="Buang dari pilihan"
          >
            <ChevronsRight className="h-4 w-4 rotate-180 lg:rotate-180" />
          </Button>
        </div>
        <ListPanel
          title="SENARAI PILIHAN"
          search={selSearch}
          onSearch={setSelSearch}
          items={selectedList}
          highlighted={highlightSel}
          onToggle={(code) => toggleHighlight(code, highlightSel, setHighlightSel)}
          selectedTone
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => onChange(available.map((s) => s.code))}
        >
          PILIH SEMUA SENARAI
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            onChange([]);
            setHighlightAvail([]);
            setHighlightSel([]);
          }}
        >
          RESET SENARAI
        </Button>
      </div>
    </div>
  );
}

function ListPanel({
  title,
  search,
  onSearch,
  items,
  highlighted,
  onToggle,
  selectedTone,
}: {
  title: string;
  search: string;
  onSearch: (v: string) => void;
  items: SimulationSeatOption[];
  highlighted: string[];
  onToggle: (code: string) => void;
  selectedTone?: boolean;
}) {
  return (
    <div className="flex min-h-[280px] flex-col rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)]">
      <div
        className={`border-b border-[var(--color-line)] px-3 py-2 text-center text-xs font-bold tracking-wide ${
          selectedTone ? "bg-[#1e3a8a] text-white" : "text-[var(--color-ink)]"
        }`}
      >
        {title}
      </div>
      <div className="border-b border-[var(--color-line)] p-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--color-ink-muted)]" />
          <Input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="CARIAN..."
            className="h-8 pl-8 text-xs"
          />
        </div>
      </div>
      <ul className="max-h-64 flex-1 overflow-auto p-1">
        {items.length === 0 && (
          <li className="px-3 py-6 text-center text-xs text-[var(--color-ink-muted)]">
            Tiada rekod
          </li>
        )}
        {items.map((item) => {
          const active = highlighted.includes(item.code);
          return (
            <li key={item.code}>
              <button
                type="button"
                onClick={() => onToggle(item.code)}
                className={`flex w-full items-start justify-between gap-2 rounded-md px-2 py-2 text-left text-xs transition-colors ${
                  active
                    ? "bg-[var(--color-accent-soft)] text-[var(--color-ink)]"
                    : "hover:bg-white/60"
                }`}
              >
                <span className="font-medium">{item.label}</span>
                <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                  {item.state}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
