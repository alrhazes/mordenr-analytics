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
