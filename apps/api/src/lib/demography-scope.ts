import type { RowDataPacket } from "mysql2";

export type DemographyArea =
  | "NEGARA"
  | "NEGERI"
  | "PARLIMEN"
  | "DUN"
  | "DM";

export type DemographyScope = {
  area: DemographyArea;
  value: string;
};

const STATE_ORDER =
  "FIELD(voters_area_name, 'PERLIS', 'KEDAH', 'KELANTAN', 'TERENGGANU', 'PULAU PINANG', 'PERAK', 'PAHANG', 'SELANGOR', 'WILAYAH PERSEKUTUAN KUALA LUMPUR', 'WILAYAH PERSEKUTUAN LABUAN', 'WILAYAH PERSEKUTUAN PUTRAJAYA', 'NEGERI SEMBILAN', 'MELAKA', 'JOHOR', 'SABAH', 'SARAWAK')";

const DEMOGRAPHY_COLUMNS = `
  voters_area,
  voters_area_code,
  voters_area_name,
  voters_parent_state,
  voters_parent_parliament_code,
  voters_parent_parliament_name,
  voters_parent_dun_code,
  voters_parent_dun_name,
  voters_parent_dm_code,
  voters_parent_dm_name,
  voters_total,
  voters_gender_female,
  voters_gender_male,
  voters_age_18_25,
  voters_age_26_40,
  voters_age_41_60,
  voters_age_61_above,
  voters_race_malay,
  voters_race_chinese,
  voters_race_indian,
  voters_race_bumi_sabah,
  voters_race_bumi_sarawak,
  voters_race_others,
  voters_malay_majority,
  voters_party_pkr,
  voters_party_umno,
  voters_party_ppbm,
  voters_party_pas,
  voters_sikap_putih,
  voters_sikap_kelabu,
  voters_sikap_hitam
`;

export function demographySummaryWhere(scope: DemographyScope): {
  clause: string;
  params: string[];
} {
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
  if (scope.area === "DM") {
    return {
      clause: " WHERE voters_area = 'DM' AND LOWER(voters_area_code) = ?",
      params: [scope.value.toLowerCase()],
    };
  }
  return { clause: " WHERE voters_area = 'NEGARA'", params: [] };
}

export function childAreaForParent(parentArea: DemographyArea): string {
  if (parentArea === "NEGARA") return "NEGERI";
  if (parentArea === "NEGERI") return "PARLIMEN";
  if (parentArea === "PARLIMEN") return "DUN";
  if (parentArea === "DUN") return "DM";
  return "LOKALITI";
}

export function formatDemographyCodeLabel(
  code: string,
  areaName?: string | null,
): string {
  const normalizedCode = code.toUpperCase();
  const name = String(areaName ?? "").trim();
  return name ? `${normalizedCode} ${name.toUpperCase()}` : normalizedCode;
}

export function demographyAreaLabel(
  scope: DemographyScope,
  areaName?: string | null,
): string {
  if (scope.area === "NEGERI") {
    return `SELURUH NEGERI ${scope.value.toUpperCase()}`;
  }
  if (
    scope.area === "PARLIMEN" ||
    scope.area === "DUN" ||
    scope.area === "DM"
  ) {
    return formatDemographyCodeLabel(scope.value, areaName);
  }
  return "SELURUH NEGARA";
}

export function malayMajorityCounts(rows: RowDataPacket[]): {
  malayMajority: number;
  nonMalayMajority: number;
} {
  let malayMajority = 0;
  let nonMalayMajority = 0;
  for (const row of rows) {
    if (Number(row.voters_malay_majority ?? 0) === 1) {
      malayMajority += 1;
    } else {
      nonMalayMajority += 1;
    }
  }
  return { malayMajority, nonMalayMajority };
}

export async function resolveParliamentChildArea(
  pool: import("mysql2/promise").Pool,
  parliamentCode: string,
): Promise<"DUN" | "DM"> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT 1 FROM electorals_voters_demography
     WHERE voters_area = 'DUN' AND voters_parent_parliament_code = ?
     LIMIT 1`,
    [parliamentCode],
  );
  return rows.length > 0 ? "DUN" : "DM";
}

export function buildDemographyTableQuery(
  parentArea: DemographyArea,
  parentValue: string,
  childArea: string,
): { sql: string; params: string[] } {
  if (parentArea === "NEGARA") {
    return {
      sql: `SELECT ${DEMOGRAPHY_COLUMNS}
            FROM electorals_voters_demography
            WHERE voters_area = 'NEGERI'
            ORDER BY ${STATE_ORDER}`,
      params: [],
    };
  }

  if (parentArea === "NEGERI") {
    return {
      sql: `SELECT ${DEMOGRAPHY_COLUMNS},
              T2.parliament_party AS party_name,
              T3.party_desc
            FROM electorals_voters_demography T1
            LEFT JOIN electorals_parliament T2
              ON T1.voters_area_code = T2.parliament_code
            LEFT JOIN electorals_party T3
              ON UPPER(T2.parliament_party) = T3.party_name
            WHERE T1.voters_area = 'PARLIMEN'
              AND T1.voters_parent_state = ?
            ORDER BY T1.voters_area_code`,
      params: [parentValue],
    };
  }

  if (parentArea === "PARLIMEN" && childArea === "DUN") {
    return {
      sql: `SELECT ${DEMOGRAPHY_COLUMNS},
              T2.dun_party AS party_name,
              T3.party_desc
            FROM electorals_voters_demography T1
            LEFT JOIN electorals_dun T2
              ON T1.voters_area_code = T2.dun_mapcode
            LEFT JOIN electorals_party T3
              ON UPPER(T2.dun_party) = T3.party_name
            WHERE T1.voters_area = 'DUN'
              AND T1.voters_parent_parliament_code = ?
            ORDER BY T1.voters_area_code`,
      params: [parentValue],
    };
  }

  if (parentArea === "PARLIMEN" && childArea === "DM") {
    return {
      sql: `SELECT *
            FROM (
              SELECT ${DEMOGRAPHY_COLUMNS},
                T2.dm_type AS party_name,
                T3.party_desc,
                ROW_NUMBER() OVER (
                  PARTITION BY T2.dm_code
                  ORDER BY T2.dm_total DESC
                ) AS rn
              FROM electorals_voters_demography T1
              LEFT JOIN electorals_dm_party_summary T2
                ON T1.voters_parent_parliament_code = T2.map_code
                AND T1.voters_area_code = T2.dm_code
              LEFT JOIN electorals_party T3
                ON UPPER(T2.dm_type) = T3.party_name
              WHERE T1.voters_area = 'DM'
                AND T1.voters_parent_parliament_code = ?
            ) x
            WHERE rn = 1
            ORDER BY voters_area_code`,
      params: [parentValue],
    };
  }

  if (parentArea === "DUN") {
    return {
      sql: `SELECT *
            FROM (
              SELECT ${DEMOGRAPHY_COLUMNS},
                T2.dm_type AS party_name,
                T3.party_desc,
                ROW_NUMBER() OVER (
                  PARTITION BY T2.dm_code
                  ORDER BY T2.dm_total DESC
                ) AS rn
              FROM electorals_voters_demography T1
              LEFT JOIN electorals_dm_party_summary T2
                ON T1.voters_parent_dun_code = T2.map_code
                AND T1.voters_area_code = T2.dm_code
              LEFT JOIN electorals_party T3
                ON UPPER(T2.dm_type) = T3.party_name
              WHERE T1.voters_area = 'DM'
                AND T1.voters_parent_dun_code = ?
            ) x
            WHERE rn = 1
            ORDER BY voters_area_code`,
      params: [parentValue],
    };
  }

  return {
    sql: `SELECT ${DEMOGRAPHY_COLUMNS}
          FROM electorals_voters_demography T1
          WHERE T1.voters_area = 'LOKALITI'
            AND T1.voters_parent_dm_code = ?
          ORDER BY T1.voters_area_name`,
    params: [parentValue],
  };
}

export { DEMOGRAPHY_COLUMNS, STATE_ORDER };
