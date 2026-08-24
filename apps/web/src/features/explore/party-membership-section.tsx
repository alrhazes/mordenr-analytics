import { useEffect, useState } from "react";
import type { VotersPartyChip } from "@/queries/explore";
import { Skeleton } from "@/components/ui/skeleton";
import { electoralAssetUrl } from "@/lib/electoral-assets";

function ChipLogo({ logo, alt }: { logo: string; alt: string }) {
  const primary = electoralAssetUrl(logo);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [logo]);

  return (
    <img
      src={useFallback ? electoralAssetUrl("parties/ind.png") : primary}
      alt={alt}
      className="h-8 w-8 shrink-0 rounded border border-[var(--color-line)] bg-white object-contain p-0.5"
      onError={() => {
        if (!useFallback) setUseFallback(true);
      }}
    />
  );
}

function MembershipChip({ chip }: { chip: VotersPartyChip }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5 rounded-lg border border-dashed border-[var(--color-line)] bg-white px-3 py-2.5 shadow-sm">
      <ChipLogo logo={chip.logo} alt={chip.name} />
      <div className="min-w-0">
        <div className="text-[10px] font-medium uppercase tracking-wide text-[var(--color-ink-muted)]">
          {chip.name}
        </div>
        <div className="text-base font-semibold tabular-nums text-[var(--color-ink)]">
          {new Intl.NumberFormat("en-MY").format(chip.count)}
        </div>
      </div>
    </div>
  );
}

type PartyMembershipSectionProps = {
  chips?: VotersPartyChip[];
  isLoading: boolean;
};

export function PartyMembershipSection({
  chips,
  isLoading,
}: PartyMembershipSectionProps) {
  if (isLoading) {
    return (
      <div className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4">
        <Skeleton className="mb-3 h-4 w-24" />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!chips?.length) return null;

  return (
    <div className="mt-5 rounded-xl border border-[var(--color-line)] bg-[var(--color-bg)] p-4">
      <h4 className="mb-3 text-sm font-semibold uppercase tracking-[0.1em] text-[var(--color-ink)]">
        Ahli Parti
      </h4>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {chips.map((chip) => (
          <MembershipChip key={chip.name} chip={chip} />
        ))}
      </div>
    </div>
  );
}
