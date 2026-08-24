import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { electoralAssetUrl } from "@/lib/electoral-assets";

type LogoProps = {
  src: string;
  fallback: string;
  alt: string;
  className?: string;
};

function LogoImg({ src, fallback, alt, className }: LogoProps) {
  const primary = electoralAssetUrl(src);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [src]);

  return (
    <img
      src={useFallback ? electoralAssetUrl(fallback) : primary}
      alt={alt}
      className={className}
      onError={() => {
        if (!useFallback) setUseFallback(true);
      }}
    />
  );
}

export type PartyLogoPairProps = {
  groupLogo: string;
  partyLogo: string;
  groupLogoFallback?: string;
  partyLogoFallback?: string;
  hidePartyLogo?: boolean;
  groupAlt?: string;
  partyAlt?: string;
  size?: "sm" | "md";
  className?: string;
};

export function PartyLogoPair({
  groupLogo,
  partyLogo,
  groupLogoFallback = "parties/ind.png",
  partyLogoFallback = "parties/ind.png",
  hidePartyLogo = false,
  groupAlt = "Coalition",
  partyAlt = "Party",
  size = "sm",
  className,
}: PartyLogoPairProps) {
  const imgClass =
    size === "sm"
      ? "h-5 max-w-[30px] border border-[var(--color-line)] bg-white object-contain p-px"
      : "h-8 max-w-[52px] border border-[var(--color-line)] bg-white object-contain p-0.5";

  return (
    <span className={cn("inline-flex shrink-0 items-center gap-1", className)}>
      <LogoImg
        src={groupLogo}
        fallback={groupLogoFallback}
        alt={groupAlt}
        className={imgClass}
      />
      {!hidePartyLogo && (
        <LogoImg
          src={partyLogo}
          fallback={partyLogoFallback}
          alt={partyAlt}
          className={imgClass}
        />
      )}
    </span>
  );
}
