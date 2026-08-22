import { useState } from "react";
import type {
  BreakdownChip,
  BreakdownSection,
  RingkasanBreakdown,
} from "@/queries/explore";
import { Skeleton } from "@/components/ui/skeleton";
import { electoralAssetUrl } from "@/lib/electoral-assets";

function ChipLogo({ logo, alt }: { logo: string; alt: string }) {
  const [src, setSrc] = useState(() => electoralAssetUrl(logo));

  return (
    <img
      src={src}
      alt={alt}
      className="h-7 w-7 shrink-0 rounded border border-[var(--color-line)] bg-white object-contain p-0.5"
      onError={() => {
        const fallback = electoralAssetUrl("parties/ind.png");
        if (src !== fallback) setSrc(fallback);
      }}
    />
  );
}

function BreakdownChipCard({ chip }: { chip: BreakdownChip }) {
  return (
    <div className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-dashed border-[var(--color-line)] bg-white px-1.5 py-2 text-center shadow-sm">
      <ChipLogo logo={chip.logo} alt={chip.name} />
      <div className="min-w-0 w-full">
        <div className="truncate text-[9px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
          {chip.name}
        </div>
        <div className="text-xs font-semibold tabular-nums text-[var(--color-ink)]">
          {chip.seats} / {chip.contested}
        </div>
      </div>
    </div>
  );
}

function ChipGroup({
  title,
  total,
  chips,
}: {
  title: string;
  total: number;
  chips: BreakdownChip[];
}) {
  if (chips.length === 0) return null;

  return (
    <div className="space-y-2">
      <h5 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--color-ink-muted)]">
        {title}{" "}
        <span className="text-[var(--color-accent)]">({total})</span>
      </h5>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 xl:grid-cols-12">
        {chips.map((chip) => (
          <BreakdownChipCard key={`${title}-${chip.name}`} chip={chip} />
        ))}
      </div>
    </div>
  );
}

function BreakdownPanel({
  title,
  section,
}: {
  title: string;
  section: BreakdownSection;
}) {
  const hasData =
    section.government.length > 0 || section.nonGovernment.length > 0;

  return (
    <div className="rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)]">
        {title}
      </h4>
      {!hasData ? (
        <p className="text-sm text-[var(--color-ink-muted)]">
          No seat data for this scope.
        </p>
      ) : (
        <div className="space-y-4">
          <ChipGroup
            title="Kerajaan"
            total={section.governmentTotal}
            chips={section.government}
          />
          <ChipGroup
            title="Bukan Kerajaan"
            total={section.nonGovernmentTotal}
            chips={section.nonGovernment}
          />
        </div>
      )}
    </div>
  );
}

type CoalitionBreakdownProps = {
  breakdown?: RingkasanBreakdown;
  isLoading: boolean;
};

export function CoalitionBreakdown({
  breakdown,
  isLoading,
}: CoalitionBreakdownProps) {
  if (isLoading) {
    return (
      <div className="mt-5 flex flex-col gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-40 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (!breakdown) return null;

  const panels: Array<{ key: string; title: string; section: BreakdownSection }> =
    [];

  if (breakdown.showParliament) {
    panels.push(
      {
        key: "par-coalition",
        title: "Parlimen (Gabungan)",
        section: breakdown.parliamentCoalition,
      },
      {
        key: "par-party",
        title: "Parlimen (Parti)",
        section: breakdown.parliamentParty,
      },
    );
  }

  if (breakdown.showDun) {
    panels.push(
      {
        key: "dun-coalition",
        title: "DUN (Gabungan)",
        section: breakdown.dunCoalition,
      },
      {
        key: "dun-party",
        title: "DUN (Parti)",
        section: breakdown.dunParty,
      },
    );
  }

  if (panels.length === 0) return null;

  return (
    <div className="mt-5 flex w-full flex-col gap-4">
      {panels.map((panel) => (
        <BreakdownPanel
          key={panel.key}
          title={panel.title}
          section={panel.section}
        />
      ))}
    </div>
  );
}
