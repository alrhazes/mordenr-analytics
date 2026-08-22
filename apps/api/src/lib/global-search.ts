import type { RowDataPacket } from "mysql2";
import { getKnowledgePool } from "../db/knowledge.js";
import { getSystemPool } from "../db/system-mysql.js";
import { buildBooleanNameQuery } from "./boolean-search.js";
import { seatMediaPaths, voterPhotoPaths } from "./electoral-media.js";

const DEFAULT_TOTAL_RECORDS = 21_000_000;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 50;

export type GlobalSearchSuggestion = {
  value: string;
  label: string;
  id: string;
  type: string;
  totalRecords: number;
  icon: string;
  extras: Record<string, unknown>;
  ic: string;
  member?: string;
  party?: string;
  partyGroup?: string;
  groupLogo?: string;
  partyLogo?: string;
  groupLogoFallback?: string;
  partyLogoFallback?: string;
  hidePartyLogo?: boolean;
  state?: string;
  electoralType?: "parliament" | "dun";
  mapCode?: string;
  photo?: string;
  photoLocal?: string;
  photoFallback?: string;
};

type SearchMode = "text" | "ic" | "phone" | "email" | "empty";

function parseSearchMode(q: string): SearchMode {
  const s = q.trim();
  if (!s) return "empty";

  if (filter_var_email(s)) return "email";

  const isFirst3Digits = s.length >= 3 && /^\d{3}/.test(s);
  if (isFirst3Digits) {
    if (/^\d{12}$/.test(s)) return "ic";
    if (/^\d{10,11}$/.test(s)) return "phone";
    return "empty";
  }

  return "text";
}

function filter_var_email(s: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
}

function parseExtras(raw: unknown): Record<string, unknown> {
  if (!raw) return {};
  if (typeof raw === "object") return raw as Record<string, unknown>;
  try {
    const parsed = JSON.parse(String(raw));
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

function withVoterPhoto(item: GlobalSearchSuggestion): GlobalSearchSuggestion {
  if (item.type !== "voters") return item;
  const ic = item.ic || item.id;
  if (!ic) return item;
  return { ...item, ...voterPhotoPaths(ic) };
}

function mapDashRow(r: RowDataPacket): GlobalSearchSuggestion {
  return withVoterPhoto({
    value: String(r.globalsearch_autotext || ""),
    label: String(r.globalsearch_autolabel || ""),
    id: String(r.globalsearch_autoid || ""),
    type: String(r.globalsearch_type || ""),
    totalRecords: Number(r.globalsearch_totalrecords ?? 0),
    icon: String(r.globalsearch_icon || ""),
    extras: parseExtras(r.globalsearch_extras),
    ic: String(r.ic || ""),
  });
}

let dashTableCache: boolean | null = null;

async function hasDashGlobalSearch(): Promise<boolean> {
  if (dashTableCache != null) return dashTableCache;
  try {
    const pool = getSystemPool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT 1 AS ok
       FROM information_schema.tables
       WHERE table_schema = DATABASE()
         AND table_name = 'dash_globalsearch'
       LIMIT 1`,
    );
    dashTableCache = Boolean(rows?.[0]);
  } catch {
    dashTableCache = false;
  }
  return dashTableCache;
}

async function searchDashGlobalSearch(
  q: string,
  limit: number,
): Promise<GlobalSearchSuggestion[]> {
  const pool = getSystemPool();
  const mode = parseSearchMode(q);

  if (mode === "empty") return [];

  let query = "";
  let params: Array<string | number> = [];

  if (mode === "ic") {
    query = `SELECT
      globalsearch_autotext,
      globalsearch_autoid,
      globalsearch_autolabel,
      globalsearch_type,
      globalsearch_icon,
      globalsearch_totalrecords,
      globalsearch_extras,
      ic
    FROM dash_globalsearch
    WHERE ic = ?
    LIMIT 1`;
    params = [q.trim()];
  } else if (mode === "phone") {
    const knowledge = getKnowledgePool();
    const [icRows] = await knowledge.query<RowDataPacket[]>(
      `SELECT DISTINCT ic FROM electorals_mantooman_phone WHERE number = ?`,
      [q.trim()],
    );
    const ics = (icRows || []).map((r) => String(r.ic)).filter(Boolean);
    if (!ics.length) return [];

    const placeholders = ics.map(() => "?").join(",");
    query = `SELECT
      globalsearch_autotext,
      globalsearch_autoid,
      globalsearch_autolabel,
      globalsearch_type,
      globalsearch_icon,
      globalsearch_totalrecords,
      globalsearch_extras,
      ic
    FROM dash_globalsearch
    WHERE ic IN (${placeholders})`;
    params = ics;
  } else if (mode === "email") {
    const knowledge = getKnowledgePool();
    const [icRows] = await knowledge.query<RowDataPacket[]>(
      `SELECT DISTINCT ic FROM electorals_mantooman_email WHERE email = ?`,
      [q.trim()],
    );
    const ics = (icRows || []).map((r) => String(r.ic)).filter(Boolean);
    if (!ics.length) return [];

    const placeholders = ics.map(() => "?").join(",");
    query = `SELECT
      globalsearch_autotext,
      globalsearch_autoid,
      globalsearch_autolabel,
      globalsearch_type,
      globalsearch_icon,
      globalsearch_totalrecords,
      globalsearch_extras,
      ic
    FROM dash_globalsearch
    WHERE ic IN (${placeholders})`;
    params = ics;
  } else {
    const boolean = buildBooleanNameQuery(q);
    if (!boolean) return [];
    query = `SELECT
      globalsearch_autotext,
      globalsearch_autoid,
      globalsearch_autolabel,
      globalsearch_type,
      globalsearch_icon,
      globalsearch_totalrecords,
      globalsearch_extras,
      ic
    FROM dash_globalsearch
    WHERE MATCH(globalsearch_autotext) AGAINST (? IN BOOLEAN MODE)
    LIMIT ?`;
    params = [boolean, limit];
  }

  const [rows] = await pool.query<RowDataPacket[]>(query, params);
  return (rows || []).map(mapDashRow);
}

async function searchElectoralFallback(
  q: string,
  limit: number,
): Promise<GlobalSearchSuggestion[]> {
  const pool = getKnowledgePool();
  const term = q.trim().toLowerCase();
  if (!term) return [];

  const mode = parseSearchMode(q);
  const suggestions: GlobalSearchSuggestion[] = [];

  if (mode === "ic" || mode === "phone" || mode === "email") {
    let ics: string[] = [];
    if (mode === "ic") {
      ics = [q.trim()];
    } else if (mode === "phone") {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT ic FROM electorals_mantooman_phone WHERE number = ?`,
        [q.trim()],
      );
      ics = (rows || []).map((r) => String(r.ic)).filter(Boolean);
    } else {
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT DISTINCT ic FROM electorals_mantooman_email WHERE email = ?`,
        [q.trim()],
      );
      ics = (rows || []).map((r) => String(r.ic)).filter(Boolean);
    }

    if (ics.length) {
      const placeholders = ics.map(() => "?").join(",");
      const [rows] = await pool.query<RowDataPacket[]>(
        `SELECT nama, ic, parlimen, parliament_code, dun, map_code
         FROM electorals_register
         WHERE ic IN (${placeholders})
         LIMIT ?`,
        [...ics, limit],
      );
      for (const r of rows || []) {
        suggestions.push(
          withVoterPhoto({
            value: String(r.nama || r.ic),
            label: "PENGUNDI",
            id: String(r.ic || ""),
            type: "voters",
            totalRecords: 0,
            icon: "fa fa-user",
            extras: {
              parliamentCode: r.parliament_code,
              mapCode: r.map_code,
            },
            ic: String(r.ic || ""),
          }),
        );
      }
    }
    return suggestions;
  }

  const like = `%${term}%`;
  const [parRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       parliament_code AS code,
       parliament_name AS name,
       UPPER(parliament_statename) AS state,
       parliament_ahli AS member,
       parliament_party AS party,
       parliament_group AS partyGroup,
       REPLACE(parliament_partylogo, ' ', '_') AS partyLogoFile,
       REPLACE(parliament_grouplogo, ' ', '_') AS groupLogoFile
     FROM electorals_parliament
     WHERE parliament_election = 'GE15'
       AND (
         LOWER(parliament_name) LIKE ?
         OR LOWER(parliament_code) LIKE ?
         OR LOWER(parliament_ahli) LIKE ?
         OR LOWER(parliament_party) LIKE ?
         OR LOWER(parliament_statename) LIKE ?
       )
     ORDER BY parliament_statename, parliament_name
     LIMIT ?`,
    [like, like, like, like, like, Math.ceil(limit / 2)],
  );

  for (const r of parRows || []) {
    const code = String(r.code);
    const media = seatMediaPaths({
      code,
      electoralType: "parliament",
      presentation: "normal",
      partyLogoFile: r.partyLogoFile,
      groupLogoFile: r.groupLogoFile,
    });
    suggestions.push({
      value: `PAR : ${String(r.name).toUpperCase()} (${code})`,
      label: String(r.state),
      id: code,
      type: "par",
      totalRecords: 0,
      icon: "fa fa-institution",
      extras: { map_code: code },
      ic: "",
      member: String(r.member || ""),
      party: String(r.party || ""),
      partyGroup: String(r.partyGroup || ""),
      state: String(r.state || ""),
      electoralType: "parliament",
      mapCode: code,
      ...media,
    });
  }

  const [dunRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       dun_mapcode AS code,
       dun_name AS name,
       UPPER(dun_statename) AS state,
       dun_ahli AS member,
       dun_party AS party,
       dun_group AS partyGroup,
       REPLACE(dun_partylogo, ' ', '_') AS partyLogoFile,
       REPLACE(dun_grouplogo, ' ', '_') AS groupLogoFile
     FROM electorals_dun
     WHERE (
       LOWER(dun_name) LIKE ?
       OR LOWER(dun_mapcode) LIKE ?
       OR LOWER(dun_ahli) LIKE ?
       OR LOWER(dun_party) LIKE ?
       OR LOWER(dun_statename) LIKE ?
     )
     ORDER BY dun_statename, dun_name
     LIMIT ?`,
    [like, like, like, like, like, Math.ceil(limit / 2)],
  );

  for (const r of dunRows || []) {
    const code = String(r.code);
    const media = seatMediaPaths({
      code,
      electoralType: "dun",
      presentation: "normal",
      partyLogoFile: r.partyLogoFile,
      groupLogoFile: r.groupLogoFile,
    });
    suggestions.push({
      value: `DUN : ${String(r.name).toUpperCase()} (${code})`,
      label: String(r.state),
      id: code,
      type: "dun",
      totalRecords: 0,
      icon: "fa fa-institution",
      extras: { map_code: code },
      ic: "",
      member: String(r.member || ""),
      party: String(r.party || ""),
      partyGroup: String(r.partyGroup || ""),
      state: String(r.state || ""),
      electoralType: "dun",
      mapCode: code,
      ...media,
    });
  }

  const boolean = buildBooleanNameQuery(q);
  if (boolean && suggestions.length < limit) {
    try {
      const [voterRows] = await pool.query<RowDataPacket[]>(
        `SELECT nama, ic, parlimen, parliament_code, map_code
         FROM electorals_register
         WHERE MATCH(nama) AGAINST (? IN BOOLEAN MODE)
         LIMIT ?`,
        [boolean, limit - suggestions.length],
      );
      for (const r of voterRows || []) {
        suggestions.push(
          withVoterPhoto({
            value: String(r.nama || r.ic),
            label: "PENGUNDI",
            id: String(r.ic || ""),
            type: "voters",
            totalRecords: 0,
            icon: "fa fa-user",
            extras: {
              parliamentCode: r.parliament_code,
              mapCode: r.map_code,
            },
            ic: String(r.ic || ""),
          }),
        );
      }
    } catch {
      /* electorals_register FULLTEXT may be unavailable */
    }
  }

  return suggestions.slice(0, limit);
}

async function enrichElectoralSuggestions(
  items: GlobalSearchSuggestion[],
): Promise<GlobalSearchSuggestion[]> {
  const pool = getKnowledgePool();
  const out: GlobalSearchSuggestion[] = [];

  for (const item of items) {
    if (item.type !== "par" && item.type !== "dun") {
      out.push(item);
      continue;
    }

    const mapCode =
      item.mapCode ||
      String(item.extras?.map_code || item.extras?.mapCode || item.id || "");
    const isDun = item.type === "dun";

    try {
      if (isDun) {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT
             dun_mapcode AS code,
             dun_name AS name,
             UPPER(dun_statename) AS state,
             dun_ahli AS member,
             dun_party AS party,
             dun_group AS partyGroup,
             REPLACE(dun_partylogo, ' ', '_') AS partyLogoFile,
             REPLACE(dun_grouplogo, ' ', '_') AS groupLogoFile
           FROM electorals_dun
           WHERE dun_mapcode = ? OR dun_code = ?
           LIMIT 1`,
          [mapCode, item.id],
        );
        const r = rows?.[0];
        if (r) {
          const code = String(r.code);
          const media = seatMediaPaths({
            code,
            electoralType: "dun",
            presentation: "normal",
            partyLogoFile: r.partyLogoFile,
            groupLogoFile: r.groupLogoFile,
          });
          out.push({
            ...item,
            value: item.value || `DUN : ${String(r.name).toUpperCase()} (${code})`,
            label: item.label || String(r.state),
            member: String(r.member || ""),
            party: String(r.party || ""),
            partyGroup: String(r.partyGroup || ""),
            state: String(r.state || ""),
            electoralType: "dun",
            mapCode: code,
            ...media,
          });
          continue;
        }
      } else {
        const [rows] = await pool.query<RowDataPacket[]>(
          `SELECT
             parliament_code AS code,
             parliament_name AS name,
             UPPER(parliament_statename) AS state,
             parliament_ahli AS member,
             parliament_party AS party,
             parliament_group AS partyGroup,
             REPLACE(parliament_partylogo, ' ', '_') AS partyLogoFile,
             REPLACE(parliament_grouplogo, ' ', '_') AS groupLogoFile
           FROM electorals_parliament
           WHERE parliament_code = ?
           LIMIT 1`,
          [mapCode || item.id],
        );
        const r = rows?.[0];
        if (r) {
          const code = String(r.code);
          const media = seatMediaPaths({
            code,
            electoralType: "parliament",
            presentation: "normal",
            partyLogoFile: r.partyLogoFile,
            groupLogoFile: r.groupLogoFile,
          });
          out.push({
            ...item,
            value:
              item.value ||
              `PAR : ${String(r.name).toUpperCase()} (${code})`,
            label: item.label || String(r.state),
            member: String(r.member || ""),
            party: String(r.party || ""),
            partyGroup: String(r.partyGroup || ""),
            state: String(r.state || ""),
            electoralType: "parliament",
            mapCode: code,
            ...media,
          });
          continue;
        }
      }
    } catch {
      /* ignore enrichment errors */
    }

    out.push(item);
  }

  return out;
}

export async function getGlobalSearchMeta() {
  if (await hasDashGlobalSearch()) {
    return {
      totalRecords: DEFAULT_TOTAL_RECORDS,
      source: "dash_globalsearch" as const,
    };
  }

  try {
    const pool = getKnowledgePool();
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         (SELECT COUNT(*) FROM electorals_parliament WHERE parliament_election = 'GE15') +
         (SELECT COUNT(*) FROM electorals_dun) AS seats`,
    );
    const seats = Number(rows?.[0]?.seats ?? 0);
    return {
      totalRecords: seats > 0 ? seats : DEFAULT_TOTAL_RECORDS,
      source: "electoral_fallback" as const,
    };
  } catch {
    return { totalRecords: DEFAULT_TOTAL_RECORDS, source: "default" as const };
  }
}

export async function runGlobalSearch(q: string, rawLimit?: number) {
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(1, Number(rawLimit) || DEFAULT_LIMIT),
  );
  const trimmed = q.trim();

  let suggestions: GlobalSearchSuggestion[] = [];
  let source: "dash_globalsearch" | "electoral_fallback" = "electoral_fallback";

  if (await hasDashGlobalSearch()) {
    suggestions = await searchDashGlobalSearch(trimmed, limit);
    source = "dash_globalsearch";
  }

  if (!suggestions.length) {
    suggestions = await searchElectoralFallback(trimmed, limit);
    source = "electoral_fallback";
  } else {
    suggestions = await enrichElectoralSuggestions(suggestions);
  }

  const meta = await getGlobalSearchMeta();

  return {
    source,
    totalRecords: meta.totalRecords,
    suggestions,
  };
}
