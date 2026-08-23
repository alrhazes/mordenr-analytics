import { ElectoralImage } from "@/features/explore/electoral-image";
import type {
  DemographyScope,
  DemographyTableResult,
  DemographyTableRow,
  VoterListArea,
  VoterListFilter,
} from "@/queries/demography";
import { rowToVoterListArea } from "./voter-list-dialog";

function formatNumber(n: number) {
  return new Intl.NumberFormat("en-MY").format(n);
}

function percent(count: number, total: number) {
  if (total <= 0) return 0;
  return Math.round((count / total) * 100);
}

type CellFilter = VoterListFilter & {
  label: string;
  area: VoterListArea;
};

type DemographyTableProps = {
  data?: DemographyTableResult;
  scope: DemographyScope;
  isLoading: boolean;
  onDrillDown: (scope: DemographyScope) => void;
  onOpenVoters: (filter: CellFilter) => void;
};

const GROUP = {
  race: {
    label: "Kaum",
    header: "bg-emerald-800 text-white",
    sub: "bg-emerald-50/80 text-emerald-950",
    cell: "bg-emerald-50/35",
  },
  age: {
    label: "Peringkat Umur",
    header: "bg-blue-800 text-white",
    sub: "bg-blue-50/80 text-blue-950",
    cell: "bg-blue-50/35",
  },
  gender: {
    label: "Jantina",
    header: "bg-violet-800 text-white",
    sub: "bg-violet-50/80 text-violet-950",
    cell: "bg-violet-50/35",
  },
  party: {
    label: "Parti",
    header: "bg-amber-800 text-white",
    sub: "bg-amber-50/80 text-amber-950",
    cell: "bg-amber-50/35",
  },
  sikap: {
    label: "Sikap",
    header: "bg-slate-700 text-white",
    sub: "bg-slate-100/90 text-slate-900",
    cell: "bg-slate-50/60",
  },
} as const;

const thBase =
  "px-2.5 py-2 text-[10px] font-semibold uppercase tracking-[0.06em] whitespace-nowrap";
const tdBase = "px-2.5 py-2.5 text-[13px] tabular-nums align-middle";

function nextDrillScope(
  scope: DemographyScope,
  row: DemographyTableRow,
  childArea: string,
): DemographyScope | null {
  if (scope.area === "NEGARA") {
    return { area: "NEGERI", value: row.name };
  }
  if (scope.area === "NEGERI") {
    return { area: "PARLIMEN", value: row.code };
  }
  if (scope.area === "PARLIMEN") {
    return {
      area: childArea === "DM" ? "DM" : "DUN",
      value: row.code,
    };
  }
  if (scope.area === "DUN") {
    return { area: "DM", value: row.code };
  }
  return null;
}

function ClickableCount({
  count,
  onClick,
}: {
  count: number;
  onClick?: () => void;
}) {
  if (count <= 0) {
    return (
      <span className="text-[var(--color-ink-muted)]/50">—</span>
    );
  }

  if (!onClick) {
    return <span>{formatNumber(count)}</span>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-1.5 py-0.5 font-medium text-[var(--color-accent)] transition-colors hover:bg-[var(--color-accent-soft)]"
    >
      {formatNumber(count)}
    </button>
  );
}

function SikapBadge({ tone }: { tone: "putih" | "kelabu" | "hitam" }) {
  const styles = {
    putih: "border border-slate-300 bg-white text-slate-700",
    kelabu: "border border-slate-400 bg-slate-500 text-white",
    hitam: "border border-slate-700 bg-slate-900 text-white",
  } as const;

  return (
    <span
      className={`inline-flex min-w-[2.75rem] items-center justify-center rounded px-1.5 py-0.5 text-[9px] font-bold uppercase ${styles[tone]}`}
    >
      {tone}
    </span>
  );
}

function DataRow({
  row,
  scope,
  childArea,
  index,
  onDrillDown,
  onOpenVoters,
}: {
  row: DemographyTableRow;
  scope: DemographyScope;
  childArea: string;
  index: number;
  onDrillDown: (scope: DemographyScope) => void;
  onOpenVoters: (filter: CellFilter) => void;
}) {
  const nextScope = nextDrillScope(scope, row, childArea);
  const rowArea = rowToVoterListArea(scope, row, childArea);
  const open = (
    filterKind: CellFilter["filterKind"],
    filterKey: string,
    label: string,
  ) => onOpenVoters({ filterKind, filterKey, label, area: rowArea });

  const rowBg = index % 2 === 0 ? "bg-[var(--color-surface)]" : "bg-[var(--color-bg)]/50";

  return (
    <tr className={`group border-b border-[var(--color-line)]/80 ${rowBg}`}>
      <td
        className={`${tdBase} sticky left-0 z-[1] min-w-[3.5rem] border-r border-[var(--color-line)]/60 text-xs font-semibold ${rowBg} group-hover:bg-[var(--color-accent-soft)]/40`}
      >
        {row.code}
      </td>
      <td
        className={`${tdBase} sticky left-[3.5rem] z-[1] min-w-[10rem] max-w-[14rem] border-r border-[var(--color-line)] text-left text-sm font-medium ${rowBg} group-hover:bg-[var(--color-accent-soft)]/40`}
      >
        {nextScope ? (
          <button
            type="button"
            onClick={() => onDrillDown(nextScope)}
            className="truncate text-left text-[var(--color-accent)] underline-offset-2 hover:underline"
            title={`Lihat ${row.name}`}
          >
            {row.name}
          </button>
        ) : (
          <span className="truncate" title={row.name}>
            {row.name}
          </span>
        )}
      </td>
      <td className={`${tdBase} min-w-[6.5rem] border-r border-[var(--color-line)] text-right font-semibold`}>
        <ClickableCount
          count={row.total}
          onClick={() => onOpenVoters({ label: row.name, area: rowArea })}
        />
      </td>
      <td
        className={`${tdBase} w-10 border-r border-[var(--color-line)] text-center`}
        title={row.malayMajority ? "Majoriti Melayu" : "Majoriti Bukan Melayu"}
      >
        <span
          className={`inline-block h-2.5 w-2.5 rounded-full ${row.malayMajority ? "bg-[#2563eb]" : "bg-[#dc2626]"}`}
        />
      </td>

      <RaceCells row={row} onOpen={open} />
      <AgeCells row={row} onOpen={open} />
      <GenderCells row={row} onOpen={open} />
      <PartyCells row={row} onOpen={open} />
      <SikapCells row={row} onOpen={open} />
    </tr>
  );
}

function MetricCells({
  cells,
  groupClass,
  onOpen,
}: {
  groupClass: string;
  cells: readonly [CellFilter["filterKind"], string, number, string?][];
  onOpen: (
    filterKind: CellFilter["filterKind"],
    filterKey: string,
    label: string,
  ) => void;
}) {
  return (
    <>
      {cells.map(([kind, key, count, label]) => (
        <td
          key={key}
          className={`${tdBase} ${groupClass} min-w-[4.25rem] text-right`}
        >
          <ClickableCount
            count={count}
            onClick={
              count > 0 ? () => onOpen(kind, key, label ?? key) : undefined
            }
          />
        </td>
      ))}
    </>
  );
}

function RaceCells({
  row,
  onOpen,
}: {
  row: DemographyTableRow;
  onOpen: (
    filterKind: CellFilter["filterKind"],
    filterKey: string,
    label: string,
  ) => void;
}) {
  return (
    <MetricCells
      groupClass={GROUP.race.cell}
      onOpen={onOpen}
      cells={[
        ["race", "malay", row.race.malay],
        ["race", "chinese", row.race.chinese],
        ["race", "indian", row.race.indian],
        ["race", "bumi_sabah", row.race.bumiSabah],
        ["race", "bumi_sarawak", row.race.bumiSarawak],
        ["race", "others", row.race.others],
      ]}
    />
  );
}

function AgeCells({
  row,
  onOpen,
}: {
  row: DemographyTableRow;
  onOpen: (
    filterKind: CellFilter["filterKind"],
    filterKey: string,
    label: string,
  ) => void;
}) {
  return (
    <MetricCells
      groupClass={GROUP.age.cell}
      onOpen={onOpen}
      cells={[
        ["age", "age_18_25", row.age.age18_25],
        ["age", "age_26_40", row.age.age26_40],
        ["age", "age_41_60", row.age.age41_60],
        ["age", "age_61_above", row.age.age61Above],
      ]}
    />
  );
}

function GenderCells({
  row,
  onOpen,
}: {
  row: DemographyTableRow;
  onOpen: (
    filterKind: CellFilter["filterKind"],
    filterKey: string,
    label: string,
  ) => void;
}) {
  return (
    <MetricCells
      groupClass={GROUP.gender.cell}
      onOpen={onOpen}
      cells={[
        ["gender", "male", row.gender.male, "Lelaki"],
        ["gender", "female", row.gender.female, "Perempuan"],
      ]}
    />
  );
}

function PartyCells({
  row,
  onOpen,
}: {
  row: DemographyTableRow;
  onOpen: (
    filterKind: CellFilter["filterKind"],
    filterKey: string,
    label: string,
  ) => void;
}) {
  return (
    <MetricCells
      groupClass={GROUP.party.cell}
      onOpen={onOpen}
      cells={[
        ["party", "pkr", row.party.pkr, "PKR"],
        ["party", "umno", row.party.umno, "UMNO"],
        ["party", "ppbm", row.party.ppbm, "PPBM"],
        ["party", "pas", row.party.pas, "PAS"],
      ]}
    />
  );
}

function SikapCells({
  row,
  onOpen,
}: {
  row: DemographyTableRow;
  onOpen: (
    filterKind: CellFilter["filterKind"],
    filterKey: string,
    label: string,
  ) => void;
}) {
  return (
    <MetricCells
      groupClass={GROUP.sikap.cell}
      onOpen={onOpen}
      cells={[
        ["sikap", "putih", row.sikap.putih, "Putih"],
        ["sikap", "kelabu", row.sikap.kelabu, "Kelabu"],
        ["sikap", "hitam", row.sikap.hitam, "Hitam"],
      ]}
    />
  );
}

export function DemographyTable({
  data,
  scope,
  isLoading,
  onDrillDown,
  onOpenVoters,
}: DemographyTableProps) {
  if (isLoading && !data?.rows.length) {
    return (
      <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-8 text-center text-sm text-[var(--color-ink-muted)]">
        Memuatkan jadual demografi…
      </div>
    );
  }

  if (!data) return null;

  const childLabel = data.childAreaLabel;

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] shadow-sm">
      <div className="flex items-center justify-between gap-3 border-b border-[var(--color-line)] bg-[var(--color-bg)]/60 px-3 py-2 text-[11px] text-[var(--color-ink-muted)] sm:px-4">
        <span>
          {data.rows.length} {childLabel.toLowerCase()} · Klik nombor untuk senarai pengundi
        </span>
        <span className="hidden sm:inline">Scroll →</span>
      </div>

      <div className="relative overflow-x-auto">
        <div className="pointer-events-none absolute inset-y-0 right-0 z-[2] w-8 bg-gradient-to-l from-[var(--color-surface)] to-transparent sm:hidden" />

        <table className="min-w-[1280px] w-full border-collapse text-[var(--color-ink)]">
          <thead className="sticky top-0 z-[3]">
            <tr>
              <th
                rowSpan={2}
                className={`${thBase} sticky left-0 z-[4] min-w-[3.5rem] border-b border-r border-[var(--color-line)] bg-[var(--color-ink)] text-left text-white`}
              >
                Kod
              </th>
              <th
                rowSpan={2}
                className={`${thBase} sticky left-[3.5rem] z-[4] min-w-[10rem] border-b border-r border-[var(--color-line)] bg-[var(--color-ink)] text-left text-white`}
              >
                {childLabel}
              </th>
              <th
                rowSpan={2}
                className={`${thBase} min-w-[6.5rem] border-b border-r border-[var(--color-line)] bg-[var(--color-ink)] text-right text-white`}
              >
                Jumlah Pengundi
              </th>
              <th
                rowSpan={2}
                className={`${thBase} w-10 border-b border-r border-[var(--color-line)] bg-[var(--color-ink)] text-white`}
                title="Majoriti kaum"
              >
                Maj.
              </th>
              <th
                colSpan={6}
                className={`${thBase} border-b border-[var(--color-line)]/30 ${GROUP.race.header}`}
              >
                {GROUP.race.label}
              </th>
              <th
                colSpan={4}
                className={`${thBase} border-b border-[var(--color-line)]/30 ${GROUP.age.header}`}
              >
                {GROUP.age.label}
              </th>
              <th
                colSpan={2}
                className={`${thBase} border-b border-[var(--color-line)]/30 ${GROUP.gender.header}`}
              >
                {GROUP.gender.label}
              </th>
              <th
                colSpan={4}
                className={`${thBase} border-b border-[var(--color-line)]/30 ${GROUP.party.header}`}
              >
                {GROUP.party.label}
              </th>
              <th
                colSpan={3}
                className={`${thBase} border-b ${GROUP.sikap.header}`}
              >
                {GROUP.sikap.label}
              </th>
            </tr>
            <tr>
              {["Melayu", "Cina", "India", "Bumi Sabah", "Bumi Sarawak", "Lain-lain"].map(
                (label) => (
                  <th
                    key={label}
                    className={`${thBase} border-b border-[var(--color-line)] ${GROUP.race.sub}`}
                  >
                    {label}
                  </th>
                ),
              )}
              {["18–25", "26–40", "41–60", ">61"].map((label) => (
                <th
                  key={label}
                  className={`${thBase} border-b border-[var(--color-line)] ${GROUP.age.sub}`}
                >
                  {label}
                </th>
              ))}
              {["L", "P"].map((label) => (
                <th
                  key={label}
                  className={`${thBase} border-b border-[var(--color-line)] ${GROUP.gender.sub}`}
                >
                  {label}
                </th>
              ))}
              {(["pkr", "umno", "ppbm", "pas"] as const).map((party) => (
                <th
                  key={party}
                  className={`${thBase} border-b border-[var(--color-line)] ${GROUP.party.sub}`}
                >
                  <ElectoralImage
                    src={`parties/${party}.png`}
                    fallback="parties/ind.png"
                    alt={party.toUpperCase()}
                    className="mx-auto h-5 w-5 rounded border border-[var(--color-line)] p-0.5"
                  />
                </th>
              ))}
              {(["putih", "kelabu", "hitam"] as const).map((tone) => (
                <th
                  key={tone}
                  className={`${thBase} border-b border-[var(--color-line)] ${GROUP.sikap.sub}`}
                >
                  <SikapBadge tone={tone} />
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {data.rows.map((row, index) => (
              <DataRow
                key={`${row.code}-${row.name}`}
                row={row}
                scope={scope}
                childArea={data.childArea}
                index={index}
                onDrillDown={onDrillDown}
                onOpenVoters={onOpenVoters}
              />
            ))}
          </tbody>

          {data.totals ? (
            <tfoot>
              <tr className="border-t-2 border-[var(--color-ink)]/15 bg-[var(--color-accent-soft)]/50 font-semibold">
                <td
                  className={`${tdBase} sticky left-0 z-[1] border-r border-[var(--color-line)] bg-[var(--color-accent-soft)]/90`}
                  colSpan={2}
                >
                  Jumlah
                </td>
                <td className={`${tdBase} border-r border-[var(--color-line)] text-right`}>
                  {formatNumber(data.totals.total)}
                </td>
                <td className={`${tdBase} border-r border-[var(--color-line)]`} />
                <PercentCells totals={data.totals} group={GROUP.race.cell} field="race" />
                <PercentCells totals={data.totals} group={GROUP.age.cell} field="age" />
                <PercentCells totals={data.totals} group={GROUP.gender.cell} field="gender" />
                <PercentCells totals={data.totals} group={GROUP.party.cell} field="party" />
                <PercentCells totals={data.totals} group={GROUP.sikap.cell} field="sikap" />
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  );
}

function PercentCells({
  totals,
  group,
  field,
}: {
  totals: DemographyTableRow;
  group: string;
  field: "race" | "age" | "gender" | "party" | "sikap";
}) {
  const values =
    field === "race"
      ? [
          totals.race.malay,
          totals.race.chinese,
          totals.race.indian,
          totals.race.bumiSabah,
          totals.race.bumiSarawak,
          totals.race.others,
        ]
      : field === "age"
        ? [
            totals.age.age18_25,
            totals.age.age26_40,
            totals.age.age41_60,
            totals.age.age61Above,
          ]
        : field === "gender"
          ? [totals.gender.male, totals.gender.female]
          : field === "party"
            ? [
                totals.party.pkr,
                totals.party.umno,
                totals.party.ppbm,
                totals.party.pas,
              ]
            : [totals.sikap.putih, totals.sikap.kelabu, totals.sikap.hitam];

  return (
    <>
      {values.map((value, index) => (
        <td
          key={`${field}-${index}`}
          className={`${tdBase} ${group} text-right text-xs font-bold text-[var(--color-ink-muted)]`}
        >
          {percent(value, totals.total)}%
        </td>
      ))}
    </>
  );
}

export type { CellFilter };
