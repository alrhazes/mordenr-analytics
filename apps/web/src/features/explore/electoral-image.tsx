import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { electoralAssetUrl } from "@/lib/electoral-assets";

type Props = {
  src: string;
  fallback: string;
  alt: string;
  className?: string;
};

export function ElectoralImage({ src, fallback, alt, className }: Props) {
  const primary = electoralAssetUrl(src);
  const [useFallback, setUseFallback] = useState(false);

  useEffect(() => {
    setUseFallback(false);
  }, [src]);

  return (
    <img
      src={useFallback ? electoralAssetUrl(fallback) : primary}
      alt={alt}
      className={cn("shrink-0 bg-white object-contain", className)}
      onError={() => {
        if (!useFallback) setUseFallback(true);
      }}
    />
  );
}
