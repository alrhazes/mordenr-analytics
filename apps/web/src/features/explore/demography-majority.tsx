type DemographyMajorityProps = {
  total: number;
  malayMajority: number;
  nonMalayMajority: number;
};

function StatCard({
  value,
  label,
  accent,
  hint,
}: {
  value: number;
  label: string;
  accent: string;
  hint?: string;
}) {
  return (
    <div className="flex min-w-[140px] flex-1 items-center gap-3 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3.5 shadow-sm">
      <span
        className="inline-block h-3 w-3 shrink-0 rounded-full"
        style={{ backgroundColor: accent }}
        aria-hidden
      />
      <div className="min-w-0">
        <div className="text-2xl font-semibold tabular-nums leading-none text-[var(--color-ink)]">
          {value}
        </div>
        <div className="mt-1.5 text-[11px] font-medium uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
          {label}
        </div>
        {hint ? (
          <div className="mt-0.5 text-[10px] text-[var(--color-ink-muted)]">
            {hint}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function DemographyMajority({
  total,
  malayMajority,
  nonMalayMajority,
}: DemographyMajorityProps) {
  const malayPct = total > 0 ? Math.round((malayMajority / total) * 100) : 0;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard
          value={total}
          label="Jumlah Kawasan"
          accent="var(--color-ink-muted)"
          hint="Pada aras paparan semasa"
        />
        <StatCard
          value={malayMajority}
          label="Majoriti Melayu"
          accent="#2563eb"
          hint={total > 0 ? `${malayPct}% daripada kawasan` : undefined}
        />
        <StatCard
          value={nonMalayMajority}
          label="Majoriti Bukan Melayu"
          accent="#dc2626"
          hint={
            total > 0 ? `${100 - malayPct}% daripada kawasan` : undefined
          }
        />
      </div>

      {total > 0 ? (
        <div className="overflow-hidden rounded-full bg-[var(--color-line)]">
          <div className="flex h-2 w-full">
            <div
              className="bg-[#2563eb] transition-[width]"
              style={{ width: `${malayPct}%` }}
              title={`Majoriti Melayu: ${malayPct}%`}
            />
            <div
              className="bg-[#dc2626] transition-[width]"
              style={{ width: `${100 - malayPct}%` }}
              title={`Majoriti Bukan Melayu: ${100 - malayPct}%`}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
