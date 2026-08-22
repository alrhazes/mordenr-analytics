import { useMemo, useState } from "react";
import { User } from "lucide-react";
import { cn } from "@/lib/utils";
import { electoralAssetUrl } from "@/lib/electoral-assets";

type Props = {
  ic?: string;
  photo?: string;
  photoLocal?: string;
  photoFallback?: string;
  alt: string;
  className?: string;
};

export function VoterPhoto({
  ic,
  photo,
  photoLocal,
  photoFallback = "voters/default.png",
  alt,
  className,
}: Props) {
  const sources = useMemo(() => {
    const chain: string[] = [];
    const cleanIc = ic?.trim();

    if (photo) chain.push(photo);
    else if (cleanIc) chain.push(`https://photo.mantooman.com/${cleanIc}.jpg`);

    if (photoLocal) chain.push(electoralAssetUrl(photoLocal));
    else if (cleanIc) chain.push(electoralAssetUrl(`voters/${cleanIc}.jpg`));

    chain.push(electoralAssetUrl(photoFallback));
    return [...new Set(chain)];
  }, [ic, photo, photoLocal, photoFallback]);

  const [index, setIndex] = useState(0);
  const current = sources[index];

  if (!current) {
    return <VoterPhotoPlaceholder className={className} />;
  }

  return (
    <img
      src={current}
      alt={alt}
      className={cn(
        "shrink-0 rounded border border-[var(--color-line)] bg-white object-cover",
        className,
      )}
      onError={() => {
        setIndex((prev) => (prev + 1 < sources.length ? prev + 1 : prev));
      }}
    />
  );
}

function VoterPhotoPlaceholder({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded border border-[var(--color-line)] bg-[var(--color-bg)] text-[var(--color-accent)]",
        className,
      )}
    >
      <User className="h-3 w-3" />
    </span>
  );
}
