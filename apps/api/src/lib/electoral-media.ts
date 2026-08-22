import path from "node:path";
import { fileURLToPath } from "node:url";
import type { MapLevel, Presentation } from "../routes/explore.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function defaultElectoralAssetsRoot(): string {
  const analyticsRoot = path.resolve(__dirname, "../../../..");
  return path.resolve(analyticsRoot, "assets/electorals/img");
}

export function electoralAssetsRoot(): string {
  return process.env.ELECTORALS_ASSETS_ROOT || defaultElectoralAssetsRoot();
}

function sanitizeLogoFile(raw: unknown): string {
  const value = String(raw ?? "").trim().replace(/ /g, "_");
  return value || "ind.png";
}

export function displaySeatCode(code: string, electoralType: MapLevel): string {
  if (electoralType === "dun" && code.length === 7) {
    return code.slice(-3);
  }
  return code;
}

export function displayPartyLabel(
  partyGroup: string,
  party: string,
): string {
  const group = partyGroup.trim();
  const p = party.trim();
  if (group && p) return `${group}-${p}`.toUpperCase();
  if (group) return group.toUpperCase();
  if (p) return p.toUpperCase();
  return "";
}

export function memberPhotoPath(
  code: string,
  electoralType: MapLevel,
  presentation: Presentation,
): string {
  if (presentation === "ops66") {
    return `spr/ahli/${electoralType}/ops66/${code}.jpg`;
  }
  return `spr/ahli/${electoralType}/${code}.jpg`;
}

export function seatMediaPaths(opts: {
  code: string;
  electoralType: MapLevel;
  presentation: Presentation;
  partyLogoFile?: unknown;
  groupLogoFile?: unknown;
}) {
  const partyLogoFile = sanitizeLogoFile(opts.partyLogoFile);
  const groupLogoFile = sanitizeLogoFile(opts.groupLogoFile);
  const hidePartyLogo = partyLogoFile === groupLogoFile;

  return {
    memberPhoto: memberPhotoPath(
      opts.code,
      opts.electoralType,
      opts.presentation,
    ),
    memberPhotoFallback: "spr/ahli/sample.png",
    partyLogo: `parties/${partyLogoFile}`,
    groupLogo: `parties/${groupLogoFile}`,
    partyLogoFallback: "parties/ind.png",
    groupLogoFallback: "parties/ind.png",
    hidePartyLogo,
  };
}

export function seatDetailMedia(
  row: {
    code: string;
    name: string;
    party: string;
    partyGroup: string;
    partyLogoFile?: unknown;
    groupLogoFile?: unknown;
  },
  electoralType: MapLevel,
  presentation: Presentation,
) {
  const media = seatMediaPaths({
    code: row.code,
    electoralType,
    presentation,
    partyLogoFile: row.partyLogoFile,
    groupLogoFile: row.groupLogoFile,
  });

  return {
    ...media,
    displayCode: displaySeatCode(row.code, electoralType),
    displayParty: displayPartyLabel(row.partyGroup, row.party),
  };
}

export function stateLogoPath(stateName: string): string {
  const file = String(stateName ?? "")
    .trim()
    .toLowerCase()
    .replace(/ /g, "_");
  return `states/${file}.png`;
}

export function governmentLogoPath(government: string): string {
  return government.toUpperCase() === "YA"
    ? "logo/kerajaan.png"
    : "logo/bukan_kerajaan.png";
}

const VOTER_PHOTO_CDN =
  process.env.VOTER_PHOTO_CDN?.replace(/\/+$/, "") ||
  "https://photo.mantooman.com";

export function voterPhotoPaths(ic: unknown) {
  const clean = String(ic ?? "").trim();
  if (!clean) {
    return {
      photo: undefined as string | undefined,
      photoLocal: undefined as string | undefined,
      photoFallback: "voters/default.png",
    };
  }

  return {
    photo: `${VOTER_PHOTO_CDN}/${clean}.jpg`,
    photoLocal: `voters/${clean}.jpg`,
    photoFallback: "voters/default.png",
  };
}

export function dominantRace(props: {
  malay?: number;
  chinese?: number;
  indian?: number;
  bumiSabah?: number;
  bumiSarawak?: number;
  others?: number;
}): { label: string; percent: number } | null {
  const entries = [
    { label: "Melayu", value: Number(props.malay ?? 0) },
    { label: "Cina", value: Number(props.chinese ?? 0) },
    { label: "India", value: Number(props.indian ?? 0) },
    { label: "Bumi Sabah", value: Number(props.bumiSabah ?? 0) },
    { label: "Bumi Sarawak", value: Number(props.bumiSarawak ?? 0) },
    { label: "Lain-lain", value: Number(props.others ?? 0) },
  ];
  const total = entries.reduce((sum, entry) => sum + entry.value, 0);
  if (total <= 0) return null;
  const top = [...entries].sort((a, b) => b.value - a.value)[0];
  return {
    label: top.label,
    percent: Math.round((top.value / total) * 100),
  };
}

export function seatListRowMedia(
  row: {
    mapCode: string;
    partyLogoFile?: unknown;
    groupLogoFile?: unknown;
    state: string;
    government: string;
    raceMalay?: number;
    raceChinese?: number;
    raceIndian?: number;
    raceBumiSabah?: number;
    raceBumiSarawak?: number;
    raceOthers?: number;
  },
  level: MapLevel,
  presentation: Presentation,
) {
  const media = seatMediaPaths({
    code: row.mapCode,
    electoralType: level,
    presentation,
    partyLogoFile: row.partyLogoFile,
    groupLogoFile: row.groupLogoFile,
  });
  const ethnicity = dominantRace({
    malay: row.raceMalay,
    chinese: row.raceChinese,
    indian: row.raceIndian,
    bumiSabah: row.raceBumiSabah,
    bumiSarawak: row.raceBumiSarawak,
    others: row.raceOthers,
  });

  return {
    ...media,
    stateLogo: stateLogoPath(row.state),
    stateLogoFallback: "parties/ind.png",
    governmentLogo: governmentLogoPath(row.government),
    governmentLogoFallback: "parties/ind.png",
    ethnicityLabel: ethnicity?.label ?? "",
    ethnicityPercent: ethnicity?.percent ?? 0,
  };
}
