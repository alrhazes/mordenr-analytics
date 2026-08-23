import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";
import {
  buildDemographyTableQuery,
  childAreaForParent,
  demographyAreaLabel,
  formatDemographyCodeLabel,
  demographySummaryWhere,
  malayMajorityCounts,
  resolveParliamentChildArea,
  type DemographyArea,
  type DemographyScope,
} from "./demography-scope.js";

export type DemographySegment = {
  key: string;
  label: string;
  count: number;
  percent: number;
  roundedPercent: number;
  color: string;
};

export type DemographyTableRow = {
  area: string;
  code: string;
  name: string;
  parentState: string | null;
  parentParliamentCode: string | null;
  parentParliamentName: string | null;
  parentDunCode: string | null;
  parentDunName: string | null;
  parentDmCode: string | null;
  parentDmName: string | null;
  total: number;
  malayMajority: boolean;
  partyName: string | null;
  race: {
    malay: number;
    chinese: number;
    indian: number;
    bumiSabah: number;
    bumiSarawak: number;
    others: number;
  };
  age: {
    age18_25: number;
    age26_40: number;
    age41_60: number;
    age61Above: number;
  };
  gender: {
    male: number;
    female: number;
  };
  party: {
    pkr: number;
    umno: number;
    ppbm: number;
    pas: number;
  };
  sikap: {
    putih: number;
    kelabu: number;
    hitam: number;
  };
};

export type DemographyBreadcrumb = {
  area: DemographyArea;
  value: string;
  label: string;
};

export type DemographySummary = {
  area: DemographyArea;
  areaValue: string | null;
  areaLabel: string;
  totalVoters: number;
  childArea: string;
  childAreaLabel: string;
  tableTitle: string;
  segments: {
    race: DemographySegment[];
    age: DemographySegment[];
    gender: DemographySegment[];
  };
  malayMajority: number;
  nonMalayMajority: number;
  parent: DemographyBreadcrumb | null;
};

export type DemographyTableResult = {
  parentArea: DemographyArea;
  parentValue: string;
  childArea: string;
  childAreaLabel: string;
  tableTitle: string;
  rows: DemographyTableRow[];
  totals: DemographyTableRow | null;
  malayMajority: number;
  nonMalayMajority: number;
};

const RACE_SEGMENTS = [
  { key: "malay", label: "Melayu", column: "voters_race_malay", color: "#2ca02c" },
  { key: "chinese", label: "Cina", column: "voters_race_chinese", color: "#dc2626" },
  { key: "indian", label: "India", column: "voters_race_indian", color: "#2563eb" },
  {
    key: "bumi_sabah",
    label: "Bumi Sabah",
    column: "voters_race_bumi_sabah",
    color: "#9467bd",
  },
  {
    key: "bumi_sarawak",
    label: "Bumi Sarawak",
    column: "voters_race_bumi_sarawak",
    color: "#8c564b",
  },
  { key: "others", label: "Lain-Lain", column: "voters_race_others", color: "#777777" },
] as const;

const AGE_SEGMENTS = [
  { key: "age_18_25", label: "18 - 25", column: "voters_age_18_25", color: "#2563eb" },
  { key: "age_26_40", label: "26 - 40", column: "voters_age_26_40", color: "#dc2626" },
  { key: "age_41_60", label: "41 - 60", column: "voters_age_41_60", color: "#2ca02c" },
  {
    key: "age_61_above",
    label: "> 61",
    column: "voters_age_61_above",
    color: "#9467bd",
  },
] as const;

const GENDER_SEGMENTS = [
  { key: "male", label: "Lelaki", column: "voters_gender_male", color: "#2563eb" },
  {
    key: "female",
    label: "Perempuan",
    column: "voters_gender_female",
    color: "#dc2626",
  },
] as const;

function buildSegments(
  row: RowDataPacket,
  defs: readonly {
    key: string;
    label: string;
    column: string;
    color: string;
  }[],
  total: number,
): DemographySegment[] {
  return defs.map((def) => {
    const count = Number(row[def.column] ?? 0);
    const percent = total > 0 ? Number(((count / total) * 100).toFixed(2)) : 0;
    return {
      key: def.key,
      label: def.label,
      count,
      percent,
      roundedPercent: total > 0 ? Math.round((count / total) * 100) : 0,
      color: def.color,
    };
  });
}

function mapTableRow(row: RowDataPacket): DemographyTableRow {
  return {
    area: String(row.voters_area ?? ""),
    code: String(row.voters_area_code ?? ""),
    name: String(row.voters_area_name ?? ""),
    parentState: row.voters_parent_state ? String(row.voters_parent_state) : null,
    parentParliamentCode: row.voters_parent_parliament_code
      ? String(row.voters_parent_parliament_code)
      : null,
    parentParliamentName: row.voters_parent_parliament_name
      ? String(row.voters_parent_parliament_name)
      : null,
    parentDunCode: row.voters_parent_dun_code
      ? String(row.voters_parent_dun_code)
      : null,
    parentDunName: row.voters_parent_dun_name
      ? String(row.voters_parent_dun_name)
      : null,
    parentDmCode: row.voters_parent_dm_code
      ? String(row.voters_parent_dm_code)
      : null,
    parentDmName: row.voters_parent_dm_name
      ? String(row.voters_parent_dm_name)
      : null,
    total: Number(row.voters_total ?? 0),
    malayMajority: Number(row.voters_malay_majority ?? 0) === 1,
    partyName: row.party_name ? String(row.party_name) : null,
    race: {
      malay: Number(row.voters_race_malay ?? 0),
      chinese: Number(row.voters_race_chinese ?? 0),
      indian: Number(row.voters_race_indian ?? 0),
      bumiSabah: Number(row.voters_race_bumi_sabah ?? 0),
      bumiSarawak: Number(row.voters_race_bumi_sarawak ?? 0),
      others: Number(row.voters_race_others ?? 0),
    },
    age: {
      age18_25: Number(row.voters_age_18_25 ?? 0),
      age26_40: Number(row.voters_age_26_40 ?? 0),
      age41_60: Number(row.voters_age_41_60 ?? 0),
      age61Above: Number(row.voters_age_61_above ?? 0),
    },
    gender: {
      male: Number(row.voters_gender_male ?? 0),
      female: Number(row.voters_gender_female ?? 0),
    },
    party: {
      pkr: Number(row.voters_party_pkr ?? 0),
      umno: Number(row.voters_party_umno ?? 0),
      ppbm: Number(row.voters_party_ppbm ?? 0),
      pas: Number(row.voters_party_pas ?? 0),
    },
    sikap: {
      putih: Number(row.voters_sikap_putih ?? 0),
      kelabu: Number(row.voters_sikap_kelabu ?? 0),
      hitam: Number(row.voters_sikap_hitam ?? 0),
    },
  };
}

function sumTableRows(rows: DemographyTableRow[]): DemographyTableRow | null {
  if (!rows.length) return null;
  const totals = rows.reduce(
    (acc, row) => ({
      ...acc,
      total: acc.total + row.total,
      race: {
        malay: acc.race.malay + row.race.malay,
        chinese: acc.race.chinese + row.race.chinese,
        indian: acc.race.indian + row.race.indian,
        bumiSabah: acc.race.bumiSabah + row.race.bumiSabah,
        bumiSarawak: acc.race.bumiSarawak + row.race.bumiSarawak,
        others: acc.race.others + row.race.others,
      },
      age: {
        age18_25: acc.age.age18_25 + row.age.age18_25,
        age26_40: acc.age.age26_40 + row.age.age26_40,
        age41_60: acc.age.age41_60 + row.age.age41_60,
        age61Above: acc.age.age61Above + row.age.age61Above,
      },
      gender: {
        male: acc.gender.male + row.gender.male,
        female: acc.gender.female + row.gender.female,
      },
      party: {
        pkr: acc.party.pkr + row.party.pkr,
        umno: acc.party.umno + row.party.umno,
        ppbm: acc.party.ppbm + row.party.ppbm,
        pas: acc.party.pas + row.party.pas,
      },
      sikap: {
        putih: acc.sikap.putih + row.sikap.putih,
        kelabu: acc.sikap.kelabu + row.sikap.kelabu,
        hitam: acc.sikap.hitam + row.sikap.hitam,
      },
    }),
    {
      total: 0,
      race: {
        malay: 0,
        chinese: 0,
        indian: 0,
        bumiSabah: 0,
        bumiSarawak: 0,
        others: 0,
      },
      age: { age18_25: 0, age26_40: 0, age41_60: 0, age61Above: 0 },
      gender: { male: 0, female: 0 },
      party: { pkr: 0, umno: 0, ppbm: 0, pas: 0 },
      sikap: { putih: 0, kelabu: 0, hitam: 0 },
    },
  );

  return {
    area: "",
    code: "",
    name: "JUMLAH",
    parentState: null,
    parentParliamentCode: null,
    parentParliamentName: null,
    parentDunCode: null,
    parentDunName: null,
    parentDmCode: null,
    parentDmName: null,
    malayMajority: false,
    partyName: null,
    ...totals,
  };
}

function tableTitleForScope(
  scope: DemographyScope,
  areaName?: string | null,
): string {
  if (scope.area === "NEGARA") return "Senarai Data Demografi Seluruh Negara";
  if (scope.area === "NEGERI") {
    return `Senarai Data Demografi Seluruh ${scope.value.toUpperCase()}`;
  }
  return `Senarai Data Demografi ${formatDemographyCodeLabel(scope.value, areaName)}`;
}

async function fetchScopeAreaName(
  pool: Pool,
  scope: DemographyScope,
): Promise<string | null> {
  if (scope.area === "NEGARA" || scope.area === "NEGERI") return null;
  const where = demographySummaryWhere(scope);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT voters_area_name
     FROM electorals_voters_demography
     ${where.clause}
     LIMIT 1`,
    where.params,
  );
  const name = rows?.[0]?.voters_area_name;
  return name ? String(name) : null;
}

function childAreaLabelFor(parentArea: DemographyArea, childArea: string): string {
  if (childArea === "LOKALITI") return "LOKALITI";
  return childArea;
}

export async function fetchDemographySummary(
  pool: Pool,
  scope: DemographyScope,
): Promise<DemographySummary> {
  const where = demographySummaryWhere(scope);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT *
     FROM electorals_voters_demography
     ${where.clause}
     LIMIT 1`,
    where.params,
  );

  const row = rows?.[0] || {};
  const totalVoters = Number(row.voters_total ?? 0);
  let childArea = childAreaForParent(scope.area);

  if (scope.area === "PARLIMEN") {
    childArea = await resolveParliamentChildArea(pool, scope.value);
  }

  const areaName = String(row.voters_area_name ?? "");

  return {
    area: scope.area,
    areaValue: scope.value || null,
    areaLabel: demographyAreaLabel(scope, areaName),
    totalVoters,
    childArea,
    childAreaLabel: childAreaLabelFor(scope.area, childArea),
    tableTitle: tableTitleForScope(scope, areaName),
    segments: {
      race: buildSegments(row, RACE_SEGMENTS, totalVoters),
      age: buildSegments(row, AGE_SEGMENTS, totalVoters),
      gender: buildSegments(row, GENDER_SEGMENTS, totalVoters),
    },
    malayMajority: 0,
    nonMalayMajority: 0,
    parent: buildParentBreadcrumb(scope, row),
  };
}

function buildParentBreadcrumb(
  scope: DemographyScope,
  row: RowDataPacket,
): DemographyBreadcrumb | null {
  if (scope.area === "NEGARA") return null;
  if (scope.area === "NEGERI") {
    return { area: "NEGARA", value: "", label: "MALAYSIA" };
  }
  if (scope.area === "PARLIMEN") {
    const state = String(row.voters_parent_state ?? "");
    return state
      ? { area: "NEGERI", value: state, label: state }
      : { area: "NEGARA", value: "", label: "MALAYSIA" };
  }
  if (scope.area === "DUN") {
    const state = String(row.voters_parent_state ?? "");
    const parCode = String(row.voters_parent_parliament_code ?? "");
    const parName = String(row.voters_parent_parliament_name ?? "");
    return {
      area: "PARLIMEN",
      value: parCode,
      label: `${parCode} ${parName}`.trim(),
    };
  }
  if (scope.area === "DM") {
    const dunCode = String(row.voters_parent_dun_code ?? "");
    const dunName = String(row.voters_parent_dun_name ?? "");
    if (dunCode) {
      return {
        area: "DUN",
        value: dunCode,
        label: `${dunCode.slice(-3)} ${dunName}`.trim(),
      };
    }
    const parCode = String(row.voters_parent_parliament_code ?? "");
    const parName = String(row.voters_parent_parliament_name ?? "");
    return {
      area: "PARLIMEN",
      value: parCode,
      label: `${parCode} ${parName}`.trim(),
    };
  }
  return null;
}

export async function fetchDemographyTable(
  pool: Pool,
  parentArea: DemographyArea,
  parentValue: string,
): Promise<DemographyTableResult> {
  let childArea = childAreaForParent(parentArea);
  if (parentArea === "PARLIMEN") {
    childArea = await resolveParliamentChildArea(pool, parentValue);
  }

  const query = buildDemographyTableQuery(parentArea, parentValue, childArea);
  const [rows] = await pool.query<RowDataPacket[]>(query.sql, query.params);
  const mapped = (rows || []).map(mapTableRow);
  const majority = malayMajorityCounts(rows || []);

  const scope: DemographyScope = { area: parentArea, value: parentValue };
  const areaName = await fetchScopeAreaName(pool, scope);

  return {
    parentArea,
    parentValue,
    childArea,
    childAreaLabel: childAreaLabelFor(parentArea, childArea),
    tableTitle: tableTitleForScope(scope, areaName),
    rows: mapped,
    totals: sumTableRows(mapped),
    malayMajority: majority.malayMajority,
    nonMalayMajority: majority.nonMalayMajority,
  };
}
