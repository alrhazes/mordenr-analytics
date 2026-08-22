import { useState } from "react";
import { cn } from "@/lib/utils";
import { electoralAssetUrl } from "@/lib/electoral-assets";

type Props = {
  src: string;
  fallback: string;
  alt: string;
  className?: string;
};

export function ElectoralImage({ src, fallback, alt, className }: Props) {
  const [logoSrc, setLogoSrc] = useState(() => electoralAssetUrl(src));

  return (
    <img
      src={logoSrc}
      alt={alt}
      className={cn("shrink-0 bg-white object-contain", className)}
      onError={() => {
        const next = electoralAssetUrl(fallback);
        if (logoSrc !== next) setLogoSrc(next);
      }}
    />
  );
}
