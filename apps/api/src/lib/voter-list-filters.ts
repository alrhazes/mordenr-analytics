import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import {
  buildBooleanNameQuery,
  buildLikeNameTokens,
  shouldUseLikeNameSearch,
} from "./boolean-search.js";
import type { DemographyArea } from "./demography-scope.js";

export type VoterListAreaType =
  | "NEGARA"
  | "NEGERI"
  | "PARLIMEN"
  | "DUN"
  | "DM"
  | "LOKALITI";

export type VoterListFilterKind = "race" | "age" | "gender" | "party" | "sikap";

export type VoterListQuery = {
  areaType: VoterListAreaType;
  areaCode?: string;
  areaName?: string;
  filterKind?: VoterListFilterKind;
  filterKey?: string;
  q?: string;
  jantina?: string;
  bangsa?: string;
  negeri?: string;
  limit?: number;
  offset?: number;
};

export type VoterListRow = {
  registerId: number;
  ic: string;
  nama: string;
  jantina: string;
  bangsa: string;
  agama: string;
  age: number;
  negeri: string;
  parlimen: string;
  dun: string;
  dm: string;
  lokaliti: string;
  sikap: string;
  parti: string;
};

type BuiltFilters = {
  whereClause: string;
  params: unknown[];
  partyQuery: boolean;
  partyQueryName: string;
};

function buildAreaFilter(query: VoterListQuery): BuiltFilters {
  let whereClause = "";
  const params: unknown[] = [];
  let partyQuery = false;
  let partyQueryName = "";

  if (query.areaType === "NEGERI" && query.areaName) {
    whereClause = " WHERE negeri = ?";
    params.push(query.areaName);
  } else if (query.areaType === "PARLIMEN" && query.areaCode) {
    whereClause = " WHERE parliament_code = ?";
    params.push(query.areaCode);
  } else if (query.areaType === "DUN" && query.areaCode) {
    whereClause = " WHERE map_code = ?";
    params.push(query.areaCode);
  } else if (query.areaType === "DM" && query.areaCode) {
    whereClause = " WHERE dm_code = ?";
    params.push(query.areaCode);
  } else if (query.areaType === "LOKALITI" && query.areaCode) {
    const lokalitiCode = query.areaCode.replace(/\D+/g, "").padStart(10, "0");
    whereClause = " WHERE kodlokaliti = ?";
    params.push(lokalitiCode);
  }

  const connector = whereClause ? " AND" : " WHERE";

  if (query.filterKind === "gender" && query.filterKey === "male") {
    whereClause += `${connector} jantina = 'LELAKI'`;
  } else if (query.filterKind === "gender" && query.filterKey === "female") {
    whereClause += `${connector} jantina = 'PEREMPUAN'`;
  } else if (query.filterKind === "age" && query.filterKey === "age_18_25") {
    whereClause += `${connector} (age >= 18 AND age <= 25)`;
  } else if (query.filterKind === "age" && query.filterKey === "age_26_40") {
    whereClause += `${connector} (age >= 26 AND age <= 40)`;
  } else if (query.filterKind === "age" && query.filterKey === "age_41_60") {
    whereClause += `${connector} (age >= 41 AND age <= 60)`;
  } else if (query.filterKind === "age" && query.filterKey === "age_61_above") {
    whereClause += `${connector} age >= 61`;
  } else if (query.filterKind === "race" && query.filterKey === "malay") {
    whereClause += `${connector} bangsa = 'MELAYU'`;
  } else if (query.filterKind === "race" && query.filterKey === "chinese") {
    whereClause += `${connector} bangsa = 'CINA'`;
  } else if (query.filterKind === "race" && query.filterKey === "indian") {
    whereClause += `${connector} bangsa = 'INDIA'`;
  } else if (query.filterKind === "race" && query.filterKey === "bumi_sabah") {
    whereClause += `${connector} bangsa = 'BUMIPUTERA SABAH'`;
  } else if (query.filterKind === "race" && query.filterKey === "bumi_sarawak") {
    whereClause += `${connector} bangsa = 'BUMIPUTERA SARAWAK'`;
  } else if (query.filterKind === "race" && query.filterKey === "others") {
    whereClause += `${connector} (bangsa = 'LAIN-LAIN' OR bangsa = '')`;
  } else if (query.filterKind === "party" && query.filterKey === "pkr") {
    partyQuery = true;
    partyQueryName = " AND name = 'PKR'";
  } else if (query.filterKind === "party" && query.filterKey === "umno") {
    partyQuery = true;
    partyQueryName = " AND name = 'UMNO'";
  } else if (query.filterKind === "party" && query.filterKey === "ppbm") {
    partyQuery = true;
    partyQueryName = " AND name = 'PPBM'";
  } else if (query.filterKind === "party" && query.filterKey === "pas") {
    partyQuery = true;
    partyQueryName = " AND name = 'PAS'";
  } else if (query.filterKind === "sikap" && query.filterKey === "putih") {
    whereClause += `${connector} sikap = 'PUTIH'`;
  } else if (query.filterKind === "sikap" && query.filterKey === "kelabu") {
    whereClause += `${connector} sikap = 'KELABU'`;
  } else if (query.filterKind === "sikap" && query.filterKey === "hitam") {
    whereClause += `${connector} sikap = 'HITAM'`;
  }

  return { whereClause, params, partyQuery, partyQueryName };
}

function appendColumnFilters(
  built: BuiltFilters,
  query: VoterListQuery,
): BuiltFilters {
  let { whereClause, params, partyQuery, partyQueryName } = built;

  const addClause = (sql: string, value?: string) => {
    const connector = whereClause ? " AND" : " WHERE";
    whereClause += `${connector} ${sql}`;
    if (value !== undefined) params.push(value);
  };

  if (query.jantina) {
    addClause("jantina = ?", query.jantina);
  }
  if (query.bangsa) {
    addClause("bangsa = ?", query.bangsa);
  }
  if (query.negeri) {
    addClause("negeri = ?", query.negeri);
  }

  return { whereClause, params, partyQuery, partyQueryName };
}

function appendSearchFilter(
  built: BuiltFilters,
  search: string,
): BuiltFilters {
  const q = search.trim();
  if (!q) return built;

  const connector = built.whereClause ? " AND" : " WHERE";

  if (/^\d{12}$/.test(q)) {
    return {
      ...built,
      whereClause: `${built.whereClause}${connector} ic = ?`,
      params: [...built.params, q],
    };
  }

  const lower = q.toLowerCase();
  if (
    ["melayu", "cina", "india", "lain-lain", "bumiputera sabah", "bumiputera sarawak"].includes(
      lower,
    )
  ) {
    return {
      ...built,
      whereClause: `${built.whereClause}${connector} bangsa = ?`,
      params: [...built.params, q],
    };
  }
  if (lower === "lelaki" || lower === "perempuan") {
    return {
      ...built,
      whereClause: `${built.whereClause}${connector} jantina = ?`,
      params: [...built.params, q],
    };
  }
  if (lower === "putih" || lower === "kelabu" || lower === "hitam") {
    return {
      ...built,
      whereClause: `${built.whereClause}${connector} sikap = ?`,
      params: [...built.params, q],
    };
  }

  if (built.partyQuery) {
    return {
      ...built,
      whereClause: `${built.whereClause}${connector} nama LIKE ?`,
      params: [...built.params, `${q}%`],
    };
  }

  if (shouldUseLikeNameSearch(q)) {
    const tokens = buildLikeNameTokens(q);
    const parts = tokens.map(() => "LOWER(nama) LIKE ?");
    return {
      ...built,
      whereClause: `${built.whereClause}${connector} (${parts.join(" AND ")})`,
      params: [...built.params, ...tokens.map((t) => `%${t}%`)],
    };
  }

  const booleanQuery = buildBooleanNameQuery(q);
  if (booleanQuery) {
    return {
      ...built,
      whereClause: `${built.whereClause}${connector} MATCH(nama) AGAINST (? IN BOOLEAN MODE)`,
      params: [...built.params, booleanQuery],
    };
  }

  return {
    ...built,
    whereClause: `${built.whereClause}${connector} LOWER(nama) LIKE ?`,
    params: [...built.params, `%${q.toLowerCase()}%`],
  };
}

function buildSelectQuery(
  built: BuiltFilters,
  limit: number,
  offset: number,
): { sql: string; params: unknown[]; countSql: string; countParams: unknown[] } {
  const baseSelect = `SELECT
    register_id AS registerId,
    ic,
    nama,
    jantina,
    bangsa,
    agama,
    age,
    negeri,
    CONCAT(parliament_code,' - ',parlimen) AS parlimen,
    CONCAT(map_code,' - ',dun) AS dun,
    CONCAT(dm_code,' - ',dm) AS dm,
    CONCAT(kodlokaliti,' - ',lokaliti) AS lokaliti,
    sikap,
    parti
  FROM electorals_register`;

  if (built.partyQuery) {
    const innerWhere = `${built.whereClause}${built.partyQueryName}`;
    const sql = `SELECT
      r.register_id AS registerId,
      r.ic,
      r.nama,
      r.jantina,
      r.bangsa,
      r.agama,
      r.age,
      r.negeri,
      CONCAT(r.parliament_code,' - ',r.parlimen) AS parlimen,
      CONCAT(r.map_code,' - ',r.dun) AS dun,
      CONCAT(r.dm_code,' - ',r.dm) AS dm,
      CONCAT(r.kodlokaliti,' - ',r.lokaliti) AS lokaliti,
      r.sikap,
      r.parti
    FROM (
      SELECT r.*
      FROM electorals_register r
      INNER JOIN electorals_members m ON r.ic = m.ic
      ${innerWhere}
    ) r
    ORDER BY r.ic
    LIMIT ? OFFSET ?`;

    const countSql = `SELECT COUNT(*) AS total
      FROM electorals_register r
      INNER JOIN electorals_members m ON r.ic = m.ic
      ${innerWhere}`;

    return {
      sql,
      params: [...built.params, limit, offset],
      countSql,
      countParams: [...built.params],
    };
  }

  const sql = `${baseSelect}${built.whereClause} ORDER BY ic LIMIT ? OFFSET ?`;
  const countSql = `SELECT COUNT(*) AS total FROM electorals_register${built.whereClause}`;

  return {
    sql,
    params: [...built.params, limit, offset],
    countSql,
    countParams: [...built.params],
  };
}

export function demographyScopeToVoterArea(
  area: DemographyArea,
  value: string,
): Pick<VoterListQuery, "areaType" | "areaCode" | "areaName"> {
  if (area === "NEGERI") {
    return { areaType: "NEGERI", areaName: value };
  }
  if (area === "PARLIMEN") {
    return { areaType: "PARLIMEN", areaCode: value };
  }
  if (area === "DUN") {
    return { areaType: "DUN", areaCode: value };
  }
  if (area === "DM") {
    return { areaType: "DM", areaCode: value };
  }
  return { areaType: "NEGARA" };
}

export async function fetchVoterList(
  pool: Pool,
  query: VoterListQuery,
): Promise<{ total: number; rows: VoterListRow[] }> {
  let built = buildAreaFilter(query);
  built = appendColumnFilters(built, query);
  if (query.q) {
    built = appendSearchFilter(built, query.q);
  }

  const { sql, params, countSql, countParams } = buildSelectQuery(
    built,
    query.limit ?? 25,
    query.offset ?? 0,
  );

  const [[countRows], [dataRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(countSql, countParams),
    pool.query<RowDataPacket[]>(sql, params),
  ]);

  return {
    total: Number(countRows?.[0]?.total ?? 0),
    rows: mapVoterRows(dataRows),
  };
}

const EXPORT_MAX_ROWS = 10_000;

export async function fetchVoterListExport(
  pool: Pool,
  query: Omit<VoterListQuery, "limit" | "offset">,
): Promise<{ total: number; rows: VoterListRow[]; truncated: boolean }> {
  let built = buildAreaFilter({
    ...query,
    limit: EXPORT_MAX_ROWS,
    offset: 0,
  });
  built = appendColumnFilters(built, query);
  if (query.q) {
    built = appendSearchFilter(built, query.q);
  }

  const { sql, params, countSql, countParams } = buildSelectQuery(
    built,
    EXPORT_MAX_ROWS,
    0,
  );

  const [[countRows], [dataRows]] = await Promise.all([
    pool.query<RowDataPacket[]>(countSql, countParams),
    pool.query<RowDataPacket[]>(sql, params),
  ]);

  const total = Number(countRows?.[0]?.total ?? 0);
  const rows = mapVoterRows(dataRows);

  return {
    total,
    rows,
    truncated: total > rows.length,
  };
}

function mapVoterRows(dataRows: RowDataPacket[] | undefined): VoterListRow[] {
  return (dataRows || []).map((r) => ({
    registerId: Number(r.registerId ?? 0),
    ic: String(r.ic ?? ""),
    nama: String(r.nama ?? ""),
    jantina: String(r.jantina ?? ""),
    bangsa: String(r.bangsa ?? ""),
    agama: String(r.agama ?? ""),
    age: Number(r.age ?? 0),
    negeri: String(r.negeri ?? ""),
    parlimen: String(r.parlimen ?? ""),
    dun: String(r.dun ?? ""),
    dm: String(r.dm ?? ""),
    lokaliti: String(r.lokaliti ?? ""),
    sikap: String(r.sikap ?? ""),
    parti: String(r.parti ?? ""),
  }));
}
