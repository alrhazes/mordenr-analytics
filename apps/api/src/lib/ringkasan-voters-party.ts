import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";

export type RingkasanScope = "NEGARA" | "NEGERI" | "PARLIMEN" | "DUN";

export type VotersPartyChip = {
  name: string;
  count: number;
  logo: string;
};

const PARTY_KEYS = [
  { name: "PKR", column: "pkr", logo: "parties/pkr.png" },
  { name: "UMNO", column: "umno", logo: "parties/umno.png" },
  { name: "PPBM", column: "ppbm", logo: "parties/ppbm.png" },
  { name: "PAS", column: "pas", logo: "parties/pas.png" },
] as const;

function votersPartyWhere(scope: {
  area: RingkasanScope;
  value: string;
}): { clause: string; params: string[] } {
  if (scope.area === "NEGERI") {
    return {
      clause:
        " WHERE voters_area = 'NEGERI' AND LOWER(voters_area_name) = ?",
      params: [scope.value.toLowerCase()],
    };
  }
  if (scope.area === "PARLIMEN") {
    return {
      clause:
        " WHERE voters_area = 'PARLIMEN' AND LOWER(voters_area_code) = ?",
      params: [scope.value.toLowerCase()],
    };
  }
  if (scope.area === "DUN") {
    return {
      clause: " WHERE voters_area = 'DUN' AND LOWER(voters_area_code) = ?",
      params: [scope.value.toLowerCase()],
    };
  }
  return { clause: " WHERE voters_area = 'NEGARA'", params: [] };
}

/** Match legacy bdcat `get_ringkasan_details` voters_party block. */
export async function fetchVotersParty(
  pool: Pool,
  scope: { area: RingkasanScope; value: string },
): Promise<VotersPartyChip[]> {
  const where = votersPartyWhere(scope);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       voters_party_pkr AS pkr,
       voters_party_umno AS umno,
       voters_party_ppbm AS ppbm,
       voters_party_pas AS pas
     FROM electorals_voters_demography
     ${where.clause}
     LIMIT 1`,
    where.params,
  );

  const row = rows?.[0] || {};
  return PARTY_KEYS.map((party) => ({
    name: party.name,
    count: Number(row[party.column] ?? 0),
    logo: party.logo,
  }));
}
