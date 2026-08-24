import type { GroupSeat } from "@/queries/explore";

/** Brand-adjacent colors so similar coalitions stay visually distinct. */
const BRAND_COLORS: Record<string, string> = {
  PH: "#e42535",
  PN: "#2563eb",
  BN: "#00007C",
  GPS: "#ea580c",
  GRS: "#0284c7",
  WARISAN: "#06b6d4",
  SK: "#4338ca",
  BEBAS: "#64748b",
  IND: "#64748b",
  OTH: "#94a3b8",
  PAS: "#16a34a",
  UMNO: "#1d4ed8",
  DAP: "#dc2626",
  PKR: "#38bdf8",
  PPBM: "#db2777",
  BERSATU: "#db2777",
  MCA: "#312e81",
  MIC: "#7c3aed",
  AMANAH: "#f59e0b",
  PBB: "#facc15",
  SUPP: "#ef4444",
  UPKO: "#0ea5e9",
  PBS: "#22c55e",
  MUDA: "#171717",
  PBM: "#a855f7",
};

const FALLBACK_PALETTE = [
  "#dc2626",
  "#2563eb",
  "#7c3aed",
  "#ea580c",
  "#059669",
  "#0891b2",
  "#ca8a04",
  "#64748b",
  "#db2777",
  "#4f46e5",
  "#16a34a",
  "#0f766e",
];

function hexToRgb(hex: string) {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return { r: 128, g: 128, b: 128 };
  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
  };
}

function normalizeHex(color: string): string {
  const trimmed = color.trim();
  if (!trimmed) return "#94a3b8";
  if (trimmed.startsWith("#")) return trimmed.length === 7 ? trimmed : "#94a3b8";
  if (/^[0-9a-f]{6}$/i.test(trimmed)) return `#${trimmed}`;
  return "#94a3b8";
}

function colorDistance(a: string, b: string): number {
  const c1 = hexToRgb(a);
  const c2 = hexToRgb(b);
  return Math.hypot(c1.r - c2.r, c1.g - c2.g, c1.b - c2.b);
}

function brandColor(label: string): string | undefined {
  const key = label.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return BRAND_COLORS[key] || BRAND_COLORS[label.toUpperCase()];
}

export function resolveSeatColors(items: GroupSeat[]): GroupSeat[] {
  const sorted = [...items].sort((a, b) => b.seats - a.seats);
  const used: string[] = [];

  return sorted.map((item, index) => {
    let color = normalizeHex(brandColor(item.group) || item.color);
    const tooClose = (candidate: string) =>
      used.some((usedColor) => colorDistance(usedColor, candidate) < 58);

    if (tooClose(color)) {
      color =
        FALLBACK_PALETTE.find((candidate) => !tooClose(candidate)) ||
        FALLBACK_PALETTE[index % FALLBACK_PALETTE.length];
    }

    used.push(color);
    return { ...item, color };
  });
}

export function contrastText(hex: string): string {
  const { r, g, b } = hexToRgb(normalizeHex(hex));
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#0b1f33" : "#ffffff";
}
