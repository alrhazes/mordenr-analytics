import { createHash } from "node:crypto";
import { Hono } from "hono";
import type { RowDataPacket } from "mysql2";
import { getKnowledgePool } from "../db/knowledge.js";
import { seatDetailMedia } from "../lib/electoral-media.js";

const ELECTION = "GE15";

/** Same SHA-256 as bdcat `verify_presentation_mode_password` (override via env). */
const DEFAULT_OPS66_PASSWORD_SHA256 =
  "59a4dfaa1a79b8ad4491f2ac7605ef65dae2d8d506d989e3923565f7fd0e8ba3";

export type MapLevel = "parliament" | "dun";
export type Presentation = "normal" | "ops66";

export const exploreRoutes = new Hono();

function parseLevel(raw: string | undefined): MapLevel {
  return raw === "dun" ? "dun" : "parliament";
}

function parsePresentation(raw: string | undefined): Presentation {
  return raw === "ops66" ? "ops66" : "normal";
}

function seatTable(level: MapLevel, presentation: Presentation): string {
  if (level === "parliament") {
    return presentation === "ops66"
      ? "electorals_parliament_ops66"
      : "electorals_parliament";
  }
  return presentation === "ops66" ? "electorals_dun_ops66" : "electorals_dun";
}

function parseGeometry(raw: unknown, lng: number, lat: number): unknown {
  let geometry: unknown = null;
  try {
    if (typeof raw === "string") {
      geometry = JSON.parse(raw);
    } else if (Buffer.isBuffer(raw)) {
      geometry = JSON.parse(raw.toString("utf8"));
    } else if (raw && typeof raw === "object") {
      geometry = raw;
    }
  } catch {
    geometry = null;
  }
  if (!geometry) {
    geometry = { type: "Point", coordinates: [lng, lat] };
  }
  return geometry;
}

function featureProps(
  r: RowDataPacket,
  electoralType: MapLevel,
): Record<string, string | number> {
  const partyColor = String(r.partyColor || r.color || "#999999");
  const groupColor = String(r.groupColor || partyColor || "#999999");
  return {
    code: String(r.code),
    name: String(r.name),
    state: String(r.state || "").toUpperCase(),
    party: String(r.party || ""),
    partyGroup: String(r.partyGroup || ""),
    partyColor,
    groupColor,
    color: partyColor,
    member: String(r.member || ""),
    electorate: Number(r.electorate ?? 0),
    turnout: Number(r.turnout ?? 0),
    majorityPercent: Number(r.majorityPercent ?? 0),
    majority: Number(r.majority ?? 0),
    government: String(r.government || "tidak"),
    electoralType,
  };
}

function parliamentSelect(table: string, withGeometry: boolean): string {
  const geo = withGeometry
    ? ", ST_AsGeoJSON(m.map_coordinates_detail) AS geometryJson"
    : "";
  return `
    SELECT
      p.parliament_code AS code,
      p.parliament_name AS name,
      UPPER(p.parliament_statename) AS state,
      p.parliament_party AS party,
      p.parliament_group AS partyGroup,
      COALESCE(NULLIF(party.party_color, ''), p.parliament_color, '#999999') AS partyColor,
      COALESCE(NULLIF(party.group_color, ''), grp.group_color, '#999999') AS groupColor,
      COALESCE(NULLIF(party.party_color, ''), p.parliament_color, '#999999') AS color,
      p.parliament_ahli AS member,
      p.total_electorate AS electorate,
      p.total_turnout AS turnout,
      p.candidate_majority_percent AS majorityPercent,
      p.candidate_majority_won AS majority,
      IF(party.party_gov, 'ya', 'tidak') AS government,
      m.center_lat AS lat,
      m.center_lng AS lng
      ${geo}
    FROM \`${table}\` p
    LEFT JOIN electorals_party party ON p.parliament_party = party.party_name
    LEFT JOIN electorals_party grp ON p.parliament_group = grp.party_name
    INNER JOIN electorals_map m
      ON m.map_code = p.parliament_code AND m.enabled = 1
  `;
}

function dunSelect(table: string, withGeometry: boolean): string {
  const geo = withGeometry
    ? ", ST_AsGeoJSON(m.map_coordinates_detail) AS geometryJson"
    : "";
  return `
    SELECT
      p.dun_mapcode AS code,
      p.dun_name AS name,
      UPPER(p.dun_statename) AS state,
      p.dun_party AS party,
      p.dun_group AS partyGroup,
      COALESCE(NULLIF(party.party_color, ''), p.dun_color, '#999999') AS partyColor,
      COALESCE(NULLIF(party.group_color, ''), grp.group_color, '#999999') AS groupColor,
      COALESCE(NULLIF(party.party_color, ''), p.dun_color, '#999999') AS color,
      p.dun_ahli AS member,
      p.total_electorate AS electorate,
      p.total_turnout AS turnout,
      p.candidate_majority_percent AS majorityPercent,
      p.candidate_majority_won AS majority,
      IF(party.party_gov_dun, 'ya', 'tidak') AS government,
      p.parliament_code AS parliamentCode,
      m.center_lat AS lat,
      m.center_lng AS lng
      ${geo}
    FROM \`${table}\` p
    LEFT JOIN electorals_party party ON p.dun_party = party.party_name
    LEFT JOIN electorals_party grp ON p.dun_group = grp.party_name
    INNER JOIN electorals_map m
      ON m.map_code = p.dun_mapcode AND m.enabled = 1
  `;
}

exploreRoutes.get("/summary", async (c) => {
  const state = c.req.query("state")?.trim() || "";
  const level = parseLevel(c.req.query("level"));
  const presentation = parsePresentation(c.req.query("presentation"));
  const table = seatTable(level, presentation);
  const pool = getKnowledgePool();

  if (level === "parliament") {
    const where = ["1=1"];
    const params: string[] = [];
    // Live parliament rows are GE15-scoped when column exists; ops66 may omit election filter
    if (presentation === "normal") {
      where.push("p.parliament_election = ?");
      params.push(ELECTION);
    }
    if (state) {
      where.push("UPPER(p.parliament_statename) = ?");
      params.push(state.toUpperCase());
    }
    const clause = where.join(" AND ");

    const [kpiRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         COUNT(*) AS seats,
         COALESCE(SUM(p.total_electorate), 0) AS electorate,
         ROUND(AVG(NULLIF(p.total_turnout, 0)), 2) AS avgTurnout,
         COUNT(DISTINCT p.parliament_party) AS parties
       FROM \`${table}\` p
       WHERE ${clause}`,
      params,
    );
    const kpi = kpiRows[0] || {};

    const [partyRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         p.parliament_party AS party,
         MAX(COALESCE(NULLIF(party.party_color, ''), p.parliament_color, '#5a6e82')) AS color,
         COUNT(*) AS seats
       FROM \`${table}\` p
       LEFT JOIN electorals_party party ON p.parliament_party = party.party_name
       WHERE ${clause}
       GROUP BY p.parliament_party
       ORDER BY seats DESC
       LIMIT 12`,
      params,
    );

    return c.json({
      source: "stt_electorals",
      mode: "read-only",
      election: ELECTION,
      level,
      presentation,
      state: state || null,
      kpis: [
        {
          id: "seats",
          label: presentation === "ops66" ? "OPS66 seats" : "Parliament seats",
          value: Number(kpi.seats ?? 0),
          hint: state || (presentation === "ops66" ? "OPS66" : "GE15 national"),
        },
        {
          id: "electorate",
          label: "Electorate",
          value: Number(kpi.electorate ?? 0),
          hint: "Registered voters",
        },
        {
          id: "turnout",
          label: "Avg turnout",
          value: Number(kpi.avgTurnout ?? 0),
          hint: "%",
        },
        {
          id: "parties",
          label: "Parties",
          value: Number(kpi.parties ?? 0),
          hint: "With seats",
        },
      ],
      partySeats: (partyRows || []).map((r) => ({
        party: String(r.party || "Unknown"),
        color: String(r.color || "#5a6e82"),
        seats: Number(r.seats ?? 0),
      })),
    });
  }

  const where = ["1=1"];
  const params: string[] = [];
  if (state) {
    where.push("UPPER(p.dun_statename) = ?");
    params.push(state.toUpperCase());
  }
  const clause = where.join(" AND ");

  const [kpiRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS seats,
       COALESCE(SUM(p.total_electorate), 0) AS electorate,
       ROUND(AVG(NULLIF(p.total_turnout, 0)), 2) AS avgTurnout,
       COUNT(DISTINCT p.dun_party) AS parties
     FROM \`${table}\` p
     WHERE ${clause}`,
    params,
  );
  const kpi = kpiRows[0] || {};

  const [partyRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       p.dun_party AS party,
       MAX(COALESCE(NULLIF(party.party_color, ''), p.dun_color, '#5a6e82')) AS color,
       COUNT(*) AS seats
     FROM \`${table}\` p
     LEFT JOIN electorals_party party ON p.dun_party = party.party_name
     WHERE ${clause}
     GROUP BY p.dun_party
     ORDER BY seats DESC
     LIMIT 12`,
    params,
  );

  return c.json({
    source: "stt_electorals",
    mode: "read-only",
    election: ELECTION,
    level,
    presentation,
    state: state || null,
    kpis: [
      {
        id: "seats",
        label: "DUN seats",
        value: Number(kpi.seats ?? 0),
        hint: state || (presentation === "ops66" ? "OPS66" : "National"),
      },
      {
        id: "electorate",
        label: "Electorate",
        value: Number(kpi.electorate ?? 0),
        hint: "Registered voters",
      },
      {
        id: "turnout",
        label: "Avg turnout",
        value: Number(kpi.avgTurnout ?? 0),
        hint: "%",
      },
      {
        id: "parties",
        label: "Parties",
        value: Number(kpi.parties ?? 0),
        hint: "With seats",
      },
    ],
    partySeats: (partyRows || []).map((r) => ({
      party: String(r.party || "Unknown"),
      color: String(r.color || "#5a6e82"),
      seats: Number(r.seats ?? 0),
    })),
  });
});

exploreRoutes.get("/states", async (c) => {
  const level = parseLevel(c.req.query("level"));
  const presentation = parsePresentation(c.req.query("presentation"));
  const table = seatTable(level, presentation);
  const pool = getKnowledgePool();

  if (level === "parliament") {
    const params: string[] = [];
    let electionClause = "";
    if (presentation === "normal") {
      electionClause = "WHERE parliament_election = ?";
      params.push(ELECTION);
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         parliament_statename AS name,
         COUNT(*) AS seats
       FROM \`${table}\`
       ${electionClause}
       GROUP BY parliament_statename
       ORDER BY parliament_statename ASC`,
      params,
    );
    return c.json({
      election: ELECTION,
      level,
      presentation,
      states: (rows || []).map((r) => ({
        name: String(r.name),
        seats: Number(r.seats ?? 0),
      })),
    });
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       dun_statename AS name,
       COUNT(*) AS seats
     FROM \`${table}\`
     GROUP BY dun_statename
     ORDER BY dun_statename ASC`,
  );
  return c.json({
    election: ELECTION,
    level,
    presentation,
    states: (rows || []).map((r) => ({
      name: String(r.name),
      seats: Number(r.seats ?? 0),
    })),
  });
});

exploreRoutes.get("/filter-options", async (c) => {
  const level = parseLevel(c.req.query("level"));
  const presentation = parsePresentation(c.req.query("presentation"));
  const table = seatTable(level, presentation);
  const pool = getKnowledgePool();

  if (level === "parliament") {
    const params: string[] = [];
    let electionClause = "WHERE 1=1";
    if (presentation === "normal") {
      electionClause = "WHERE parliament_election = ?";
      params.push(ELECTION);
    }
    const [states] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT UPPER(parliament_statename) AS name
       FROM \`${table}\` ${electionClause}
       ORDER BY name`,
      params,
    );
    const [groups] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT parliament_group AS name
       FROM \`${table}\` ${electionClause}
         AND parliament_group IS NOT NULL AND parliament_group <> ''
       ORDER BY name`,
      params,
    );
    const [parties] = await pool.query<RowDataPacket[]>(
      `SELECT DISTINCT parliament_party AS name
       FROM \`${table}\` ${electionClause}
         AND parliament_party IS NOT NULL AND parliament_party <> ''
       ORDER BY name`,
      params,
    );
    return c.json({
      level,
      presentation,
      states: (states || []).map((r) => String(r.name)),
      groups: (groups || []).map((r) => String(r.name)),
      parties: (parties || []).map((r) => String(r.name)),
    });
  }

  const [states] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT UPPER(dun_statename) AS name
     FROM \`${table}\`
     ORDER BY name`,
  );
  const [groups] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT dun_group AS name
     FROM \`${table}\`
     WHERE dun_group IS NOT NULL AND dun_group <> ''
     ORDER BY name`,
  );
  const [parties] = await pool.query<RowDataPacket[]>(
    `SELECT DISTINCT dun_party AS name
     FROM \`${table}\`
     WHERE dun_party IS NOT NULL AND dun_party <> ''
     ORDER BY name`,
  );
  return c.json({
    level,
    presentation,
    states: (states || []).map((r) => String(r.name)),
    groups: (groups || []).map((r) => String(r.name)),
    parties: (parties || []).map((r) => String(r.name)),
  });
});

exploreRoutes.get("/geo", async (c) => {
  const state = c.req.query("state")?.trim() || "";
  const level = parseLevel(c.req.query("level"));
  const presentation = parsePresentation(c.req.query("presentation"));
  const polygons = c.req.query("polygons") !== "0";
  const table = seatTable(level, presentation);
  const pool = getKnowledgePool();

  const withGeometry = polygons;
  let sql: string;
  const params: string[] = [];

  if (level === "parliament") {
    sql = parliamentSelect(table, withGeometry);
    const where: string[] = ["m.center_lat <> 0", "m.center_lng <> 0"];
    if (presentation === "normal") {
      where.push("p.parliament_election = ?");
      params.push(ELECTION);
    }
    if (state) {
      where.push("UPPER(p.parliament_statename) = ?");
      params.push(state.toUpperCase());
    }
    sql += ` WHERE ${where.join(" AND ")}`;
  } else {
    sql = dunSelect(table, withGeometry);
    const where: string[] = ["m.center_lat <> 0", "m.center_lng <> 0"];
    if (state) {
      where.push("UPPER(p.dun_statename) = ?");
      params.push(state.toUpperCase());
    }
    sql += ` WHERE ${where.join(" AND ")}`;
  }

  const [rows] = await pool.query<RowDataPacket[]>(sql, params);

  const features = [];
  let kind: "points" | "polygons" = withGeometry ? "polygons" : "points";

  for (const r of rows || []) {
    const lat = Number(r.lat ?? 0);
    const lng = Number(r.lng ?? 0);
    let geometry: unknown;
    if (withGeometry) {
      const raw =
        (r as RowDataPacket).geometryJson ??
        (r as RowDataPacket).geometryjson ??
        (r as RowDataPacket).GEOMETRYJSON;
      geometry = parseGeometry(raw, lng, lat);
      if (
        geometry &&
        typeof geometry === "object" &&
        (geometry as { type?: string }).type === "Point"
      ) {
        // keep kind polygons if any real polygon exists
      }
    } else {
      geometry = { type: "Point", coordinates: [lng, lat] };
      kind = "points";
    }

    features.push({
      type: "Feature",
      geometry,
      properties: featureProps(r, level),
    });
  }

  // If every feature fell back to Point, label as points
  if (
    withGeometry &&
    features.every(
      (f) =>
        f.geometry &&
        typeof f.geometry === "object" &&
        (f.geometry as { type?: string }).type === "Point",
    )
  ) {
    kind = "points";
  }

  return c.json({
    type: "FeatureCollection",
    kind,
    election: ELECTION,
    level,
    presentation,
    state: state || null,
    features,
  });
});

exploreRoutes.get("/search", async (c) => {
  const q = (c.req.query("q") || "").trim().toLowerCase();
  const presentation = parsePresentation(c.req.query("presentation"));
  const pool = getKnowledgePool();
  const parTable = seatTable("parliament", presentation);
  const dunTable = seatTable("dun", presentation);

  const parParams: string[] = [];
  let parElection = "";
  if (presentation === "normal") {
    parElection = "WHERE parliament_election = ?";
    parParams.push(ELECTION);
  }

  const [parRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       parliament_code AS code,
       parliament_code AS mapCode,
       parliament_name AS name,
       'parliament' AS electoralType,
       UPPER(parliament_statename) AS state,
       parliament_ahli AS member,
       parliament_party AS party,
       parliament_group AS partyGroup,
       parliament_color AS color
     FROM \`${parTable}\`
     ${parElection}
     ORDER BY parliament_statename, parliament_name`,
    parParams,
  );

  let dunRows: RowDataPacket[] = [];
  // OPS66 search is parliament-only (bdcat skips dun options)
  if (presentation !== "ops66") {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         dun_mapcode AS code,
         dun_mapcode AS mapCode,
         dun_name AS name,
         'dun' AS electoralType,
         UPPER(dun_statename) AS state,
         dun_ahli AS member,
         dun_party AS party,
         dun_group AS partyGroup,
         dun_color AS color,
         parliament_code AS parliamentCode
       FROM \`${dunTable}\`
       ORDER BY dun_statename, dun_name`,
    );
    dunRows = rows || [];
  }

  const all = [
    ...(parRows || []).map((r) => ({
      code: String(r.code),
      mapCode: String(r.mapCode),
      name: String(r.name),
      electoralType: "parliament" as const,
      state: String(r.state),
      member: String(r.member || ""),
      party: String(r.party || ""),
      partyGroup: String(r.partyGroup || ""),
      color: String(r.color || "#999999"),
      display: `PAR : ${String(r.name).toUpperCase()} (${r.code})`,
    })),
    ...dunRows.map((r) => ({
      code: String(r.code),
      mapCode: String(r.mapCode),
      name: String(r.name),
      electoralType: "dun" as const,
      state: String(r.state),
      member: String(r.member || ""),
      party: String(r.party || ""),
      partyGroup: String(r.partyGroup || ""),
      color: String(r.color || "#999999"),
      parliamentCode: String(r.parliamentCode || ""),
      display: `DUN : ${String(r.name).toUpperCase()} (${r.code})`,
    })),
  ];

  const filtered = q
    ? all.filter((item) => {
        const hay = [
          item.display,
          item.name,
          item.code,
          item.state,
          item.member,
          item.party,
          item.partyGroup,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
    : all;

  // Group by state for UI
  const byState = new Map<string, typeof filtered>();
  for (const item of filtered.slice(0, 400)) {
    const list = byState.get(item.state) || [];
    list.push(item);
    byState.set(item.state, list);
  }

  return c.json({
    presentation,
    groups: [...byState.entries()].map(([state, options]) => ({
      state,
      options,
    })),
    total: filtered.length,
  });
});

exploreRoutes.get("/seats", async (c) => {
  const level = parseLevel(c.req.query("level"));
  const presentation = parsePresentation(c.req.query("presentation"));
  const table = seatTable(level, presentation);
  const pool = getKnowledgePool();

  const state = c.req.query("state")?.trim() || "";
  const majority = c.req.query("majority")?.trim() || "0";
  const majorityMode = c.req.query("majorityMode")?.trim() || "";
  const turnout = c.req.query("turnout")?.trim() || "0";
  const groupname = c.req.query("group")?.trim() || "0";
  const party = c.req.query("party")?.trim() || "0";
  const government = c.req.query("government")?.trim() || "0";

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (level === "parliament") {
    if (presentation === "normal") {
      where.push("p.parliament_election = ?");
      params.push(ELECTION);
    }
    if (state && state !== "0") {
      where.push("LOWER(p.parliament_statename) = ?");
      params.push(state.toLowerCase());
    }
    if (majority && majority !== "0") {
      const op = majorityMode === "lebih" ? ">" : "<";
      where.push(`p.candidate_majority_percent ${op} ?`);
      params.push(Number(majority));
    }
    if (turnout && turnout !== "0") {
      where.push("p.total_turnout < ?");
      params.push(Number(turnout));
    }
    if (groupname && groupname !== "0") {
      where.push("p.parliament_group = ?");
      params.push(groupname);
    }
    if (party && party !== "0") {
      where.push("p.parliament_party = ?");
      params.push(party);
    }
    if (government && government !== "0") {
      where.push("party.party_gov = ?");
      params.push(government === "ya" ? 1 : 0);
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         p.parliament_code AS mapCode,
         p.parliament_ahli AS member,
         p.parliament_group AS partyGroup,
         p.parliament_party AS party,
         CONCAT(p.parliament_code, ' - ', p.parliament_name) AS seatLabel,
         COALESCE(v.voters_total, p.total_electorate) AS voters,
         IF(party.party_gov, 'YA', 'TIDAK') AS government,
         p.parliament_statename AS state,
         p.parliament_year AS year,
         p.candidate_majority_won AS majority,
         p.candidate_majority_percent AS majorityPercent,
         p.total_turnout AS turnout
       FROM \`${table}\` p
       LEFT JOIN electorals_party party ON p.parliament_party = party.party_name
       LEFT JOIN electorals_voters v
         ON p.parliament_code = v.voters_area_code AND v.voters_area = 'PARLIMEN'
       ${clause}
       ORDER BY p.parliament_statename, p.parliament_code`,
      params,
    );

    return c.json({
      level,
      presentation,
      columns: [
        "member",
        "partyGroup",
        "party",
        "seatLabel",
        "voters",
        "government",
        "state",
        "year",
        "majority",
        "turnout",
      ],
      rows: (rows || []).map((r) => ({
        mapCode: String(r.mapCode),
        member: String(r.member || ""),
        partyGroup: String(r.partyGroup || ""),
        party: String(r.party || ""),
        seatLabel: String(r.seatLabel || ""),
        voters: Number(r.voters ?? 0),
        government: String(r.government || "TIDAK"),
        state: String(r.state || ""),
        year: String(r.year || ""),
        majority: Number(r.majority ?? 0),
        majorityPercent: Number(r.majorityPercent ?? 0),
        turnout: Number(r.turnout ?? 0),
      })),
    });
  }

  if (state && state !== "0") {
    where.push("LOWER(p.dun_statename) = ?");
    params.push(state.toLowerCase());
  }
  if (majority && majority !== "0") {
    const op = majorityMode === "lebih" ? ">" : "<";
    where.push(`p.candidate_majority_percent ${op} ?`);
    params.push(Number(majority));
  }
  if (turnout && turnout !== "0") {
    where.push("p.total_turnout < ?");
    params.push(Number(turnout));
  }
  if (groupname && groupname !== "0") {
    where.push("p.dun_group = ?");
    params.push(groupname);
  }
  if (party && party !== "0") {
    where.push("p.dun_party = ?");
    params.push(party);
  }
  if (government && government !== "0") {
    where.push("party.party_gov_dun = ?");
    params.push(government === "ya" ? 1 : 0);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       p.dun_mapcode AS mapCode,
       p.dun_ahli AS member,
       p.dun_group AS partyGroup,
       p.dun_party AS party,
       p.parliament_code AS parliamentCode,
       CONCAT(p.dun_mapcode, ' - ', p.dun_name) AS seatLabel,
       COALESCE(v.voters_total, p.total_electorate) AS voters,
       IF(party.party_gov_dun, 'YA', 'TIDAK') AS government,
       p.dun_statename AS state,
       p.dun_year AS year,
       p.candidate_majority_won AS majority,
       p.candidate_majority_percent AS majorityPercent,
       p.total_turnout AS turnout
     FROM \`${table}\` p
     LEFT JOIN electorals_party party ON p.dun_party = party.party_name
     LEFT JOIN electorals_voters v
       ON p.dun_mapcode = v.voters_area_code AND v.voters_area = 'DUN'
     ${clause}
     ORDER BY p.dun_statename, p.dun_mapcode`,
    params,
  );

  return c.json({
    level,
    presentation,
    columns: [
      "member",
      "partyGroup",
      "party",
      "parliamentCode",
      "seatLabel",
      "voters",
      "government",
      "state",
      "year",
      "majority",
      "turnout",
    ],
    rows: (rows || []).map((r) => ({
      mapCode: String(r.mapCode),
      member: String(r.member || ""),
      partyGroup: String(r.partyGroup || ""),
      party: String(r.party || ""),
      parliamentCode: String(r.parliamentCode || ""),
      seatLabel: String(r.seatLabel || ""),
      voters: Number(r.voters ?? 0),
      government: String(r.government || "TIDAK"),
      state: String(r.state || ""),
      year: String(r.year || ""),
      majority: Number(r.majority ?? 0),
      majorityPercent: Number(r.majorityPercent ?? 0),
      turnout: Number(r.turnout ?? 0),
    })),
  });
});

exploreRoutes.post("/ops66/verify", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const password = String((body as { password?: string }).password ?? "");
  const expected =
    process.env.OPS66_PASSWORD_SHA256 || DEFAULT_OPS66_PASSWORD_SHA256;
  const hash = createHash("sha256").update(password).digest("hex");
  if (hash !== expected) {
    return c.json({ ok: false, error: "wrong password" }, 401);
  }
  return c.json({ ok: true });
});

exploreRoutes.get("/parliaments/:code", async (c) => {
  const code = c.req.param("code");
  const presentation = parsePresentation(c.req.query("presentation"));
  const table = seatTable("parliament", presentation);
  const pool = getKnowledgePool();

  const params: string[] = [code];
  let electionClause = "";
  if (presentation === "normal") {
    electionClause = "AND p.parliament_election = ?";
    params.push(ELECTION);
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       p.parliament_code AS code,
       p.parliament_name AS name,
       p.parliament_statename AS state,
       p.parliament_party AS party,
       p.parliament_group AS partyGroup,
       REPLACE(p.parliament_partylogo, ' ', '_') AS partyLogoFile,
       REPLACE(p.parliament_grouplogo, ' ', '_') AS groupLogoFile,
       COALESCE(NULLIF(party.party_color, ''), p.parliament_color, '#5a6e82') AS color,
       p.parliament_ahli AS member,
       p.total_electorate AS electorate,
       p.total_ballots AS ballots,
       p.total_valid AS validVotes,
       p.total_turnout AS turnout,
       p.candidate_majority_won AS majority,
       p.candidate_majority_percent AS majorityPercent,
       m.center_lat AS lat,
       m.center_lng AS lng
     FROM \`${table}\` p
     LEFT JOIN electorals_party party ON p.parliament_party = party.party_name
     LEFT JOIN electorals_map m
       ON m.map_code = p.parliament_code AND m.enabled = 1
     WHERE p.parliament_code = ?
       ${electionClause}
     LIMIT 1`,
    params,
  );

  if (!rows?.[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  const r = rows[0];
  const media = seatDetailMedia(
    {
      code: String(r.code),
      name: String(r.name),
      party: String(r.party),
      partyGroup: String(r.partyGroup || ""),
      partyLogoFile: r.partyLogoFile,
      groupLogoFile: r.groupLogoFile,
    },
    "parliament",
    presentation,
  );

  return c.json({
    parliament: {
      code: String(r.code),
      name: String(r.name),
      state: String(r.state),
      party: String(r.party),
      partyGroup: String(r.partyGroup || ""),
      color: String(r.color || "#5a6e82"),
      member: String(r.member || ""),
      electorate: Number(r.electorate ?? 0),
      ballots: Number(r.ballots ?? 0),
      validVotes: Number(r.validVotes ?? 0),
      turnout: Number(r.turnout ?? 0),
      majority: Number(r.majority ?? 0),
      majorityPercent: Number(r.majorityPercent ?? 0),
      lat: Number(r.lat ?? 0),
      lng: Number(r.lng ?? 0),
      electoralType: "parliament" as const,
      displayCode: media.displayCode,
      displayParty: media.displayParty,
      memberPhoto: media.memberPhoto,
      memberPhotoFallback: media.memberPhotoFallback,
      partyLogo: media.partyLogo,
      groupLogo: media.groupLogo,
      partyLogoFallback: media.partyLogoFallback,
      groupLogoFallback: media.groupLogoFallback,
      hidePartyLogo: media.hidePartyLogo,
    },
  });
});

exploreRoutes.get("/duns/:code", async (c) => {
  const code = c.req.param("code");
  const presentation = parsePresentation(c.req.query("presentation"));
  const table = seatTable("dun", presentation);
  const pool = getKnowledgePool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       p.dun_mapcode AS code,
       p.dun_name AS name,
       p.dun_statename AS state,
       p.dun_party AS party,
       p.dun_group AS partyGroup,
       REPLACE(p.dun_partylogo, ' ', '_') AS partyLogoFile,
       REPLACE(p.dun_grouplogo, ' ', '_') AS groupLogoFile,
       COALESCE(NULLIF(party.party_color, ''), p.dun_color, '#5a6e82') AS color,
       p.dun_ahli AS member,
       p.parliament_code AS parliamentCode,
       p.total_electorate AS electorate,
       p.total_ballots AS ballots,
       p.total_valid AS validVotes,
       p.total_turnout AS turnout,
       p.candidate_majority_won AS majority,
       p.candidate_majority_percent AS majorityPercent,
       m.center_lat AS lat,
       m.center_lng AS lng
     FROM \`${table}\` p
     LEFT JOIN electorals_party party ON p.dun_party = party.party_name
     LEFT JOIN electorals_map m
       ON m.map_code = p.dun_mapcode AND m.enabled = 1
     WHERE p.dun_mapcode = ?
     LIMIT 1`,
    [code],
  );

  if (!rows?.[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  const r = rows[0];
  const media = seatDetailMedia(
    {
      code: String(r.code),
      name: String(r.name),
      party: String(r.party),
      partyGroup: String(r.partyGroup || ""),
      partyLogoFile: r.partyLogoFile,
      groupLogoFile: r.groupLogoFile,
    },
    "dun",
    presentation,
  );

  return c.json({
    dun: {
      code: String(r.code),
      name: String(r.name),
      state: String(r.state),
      party: String(r.party),
      partyGroup: String(r.partyGroup || ""),
      color: String(r.color || "#5a6e82"),
      member: String(r.member || ""),
      parliamentCode: String(r.parliamentCode || ""),
      electorate: Number(r.electorate ?? 0),
      ballots: Number(r.ballots ?? 0),
      validVotes: Number(r.validVotes ?? 0),
      turnout: Number(r.turnout ?? 0),
      majority: Number(r.majority ?? 0),
      majorityPercent: Number(r.majorityPercent ?? 0),
      lat: Number(r.lat ?? 0),
      lng: Number(r.lng ?? 0),
      electoralType: "dun" as const,
      displayCode: media.displayCode,
      displayParty: media.displayParty,
      memberPhoto: media.memberPhoto,
      memberPhotoFallback: media.memberPhotoFallback,
      partyLogo: media.partyLogo,
      groupLogo: media.groupLogo,
      partyLogoFallback: media.partyLogoFallback,
      groupLogoFallback: media.groupLogoFallback,
      hidePartyLogo: media.hidePartyLogo,
    },
  });
});
