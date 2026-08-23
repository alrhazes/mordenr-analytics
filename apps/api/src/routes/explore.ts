import { createHash } from "node:crypto";
import { Hono } from "hono";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { getKnowledgePool } from "../db/knowledge.js";
import {
  seatDetailMedia,
  seatListRowMedia,
  seatMediaPaths,
} from "../lib/electoral-media.js";
import { getVoterProfile } from "../lib/voter-profile.js";
import { fetchRingkasanBreakdown } from "../lib/ringkasan-breakdown.js";
import { fetchVotersParty } from "../lib/ringkasan-voters-party.js";
import {
  fetchDemographySummary,
  fetchDemographyTable,
} from "../lib/demography.js";
import type { DemographyArea } from "../lib/demography-scope.js";
import { fetchVoterList, fetchVoterListExport } from "../lib/voter-list-filters.js";

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

type RingkasanScope = "NEGARA" | "NEGERI" | "PARLIMEN" | "DUN";

type RingkasanRow = {
  parliamentSeats: number;
  dunSeats: number;
  dmCount: number;
  electorate: number;
  ballots: number;
  turnout: number;
  unreturned: number;
  rejected: number;
  validVotes: number;
  validPercent: number;
  parties: number;
  majority?: number;
  majorityPercent?: number;
  seatName?: string;
  seatState?: string;
};

function parseRingkasanScope(
  areaRaw: string | undefined,
  valueRaw: string | undefined,
  stateFallback: string,
): { area: RingkasanScope; value: string } {
  const area = (areaRaw || "").toUpperCase();
  const value = (valueRaw || stateFallback || "").trim();
  if (area === "NEGERI" && value) return { area: "NEGERI", value };
  if (area === "PARLIMEN" && value) return { area: "PARLIMEN", value };
  if (area === "DUN" && value) return { area: "DUN", value };
  if (value && !areaRaw) return { area: "NEGERI", value };
  return { area: "NEGARA", value: "" };
}

function eqWhere(column: string, value: string): { clause: string; params: string[] } {
  return {
    clause: ` WHERE LOWER(${column}) = ?`,
    params: [value.toLowerCase()],
  };
}

function mapRingkasanRow(r: RowDataPacket): RingkasanRow {
  const electorate = Number(r.electorate ?? 0);
  const ballots = Number(r.ballots ?? 0);
  const validVotes = Number(r.validVotes ?? 0);
  return {
    parliamentSeats: Number(r.parliamentSeats ?? 0),
    dunSeats: Number(r.dunSeats ?? 0),
    dmCount: Number(r.dmCount ?? 0),
    electorate,
    ballots,
    turnout: electorate > 0 ? Number(((ballots / electorate) * 100).toFixed(2)) : 0,
    unreturned: Number(r.unreturned ?? 0),
    rejected: Number(r.rejected ?? 0),
    validVotes,
    validPercent: ballots > 0 ? Number(((validVotes / ballots) * 100).toFixed(2)) : 0,
    parties: Number(r.parties ?? 0),
  };
}

/** Match legacy bdcat `get_ringkasan_details` — scope-driven aggregates. */
async function fetchRingkasan(
  pool: ReturnType<typeof getKnowledgePool>,
  scope: { area: RingkasanScope; value: string },
  votesTable: string,
  presentation: Presentation,
): Promise<RingkasanRow> {
  const empty = { clause: "", params: [] as string[] };
  let par = empty;
  let dun = empty;
  let dm = empty;
  let voteSource = votesTable;
  let voteScope = empty;
  let useWilayahQuery = false;

  if (scope.area === "NEGERI") {
    par = eqWhere("parliament_statename", scope.value);
    dun = eqWhere("dun_statename", scope.value);
    dm = eqWhere("dm_state", scope.value);
    voteSource = "electorals_dun";
    voteScope = dun;
    useWilayahQuery = scope.value.toLowerCase().includes("wilayah");
  } else if (scope.area === "PARLIMEN") {
    par = eqWhere("parliament_code", scope.value);
    dun = eqWhere("parliament_code", scope.value);
    dm = eqWhere("parliament_code", scope.value);
    voteSource = "electorals_parliament";
    voteScope = par;
  } else if (scope.area === "DUN") {
    par = eqWhere("parliament_code", scope.value);
    dun = eqWhere("dun_mapcode", scope.value);
    dm = eqWhere("map_code", scope.value);
    voteSource = "electorals_dun";
    voteScope = dun;
  }

  if (useWilayahQuery) {
    voteSource = "electorals_parliament";
    voteScope = par;
  }

  const params = [
    ...par.params,
    ...dun.params,
    ...dm.params,
    ...voteScope.params,
    ...voteScope.params,
    ...voteScope.params,
    ...voteScope.params,
    ...voteScope.params,
    ...voteScope.params,
  ];

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       (SELECT COUNT(*) FROM electorals_parliament${par.clause}) AS parliamentSeats,
       (SELECT COUNT(*) FROM electorals_dun${dun.clause}) AS dunSeats,
       (SELECT COUNT(*) FROM electorals_dm_main${dm.clause}) AS dmCount,
       (SELECT COALESCE(SUM(total_electorate), 0) FROM \`${voteSource}\`${voteScope.clause}) AS electorate,
       (SELECT COALESCE(SUM(total_ballots), 0) FROM \`${voteSource}\`${voteScope.clause}) AS ballots,
       (SELECT COALESCE(SUM(total_unreturned), 0) FROM \`${voteSource}\`${voteScope.clause}) AS unreturned,
       (SELECT COALESCE(SUM(total_rejected), 0) FROM \`${voteSource}\`${voteScope.clause}) AS rejected,
       (SELECT COALESCE(SUM(total_valid), 0) FROM \`${voteSource}\`${voteScope.clause}) AS validVotes`,
    params,
  );

  const ring = mapRingkasanRow(rows?.[0] || {});

  if (scope.area === "PARLIMEN" || scope.area === "DUN") {
    const seatTableName =
      scope.area === "PARLIMEN" ? votesTable : seatTable("dun", presentation);
    const codeColumn =
      scope.area === "PARLIMEN" ? "parliament_code" : "dun_mapcode";
    const nameColumn =
      scope.area === "PARLIMEN" ? "parliament_name" : "dun_name";
    const stateColumn =
      scope.area === "PARLIMEN" ? "parliament_statename" : "dun_statename";

    const [seatRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         ${nameColumn} AS seatName,
         ${stateColumn} AS seatState,
         candidate_majority_won AS majority,
         candidate_majority_percent AS majorityPercent
       FROM \`${seatTableName}\`
       WHERE LOWER(${codeColumn}) = ?
       LIMIT 1`,
      [scope.value.toLowerCase()],
    );
    const seat = seatRows?.[0];
    if (seat) {
      ring.seatName = String(seat.seatName || "");
      ring.seatState = String(seat.seatState || "");
      ring.majority = Number(seat.majority ?? 0);
      ring.majorityPercent = Number(seat.majorityPercent ?? 0);
    }
  }

  return ring;
}

function buildRingkasanAreaLabel(
  scope: { area: RingkasanScope; value: string },
  ring: RingkasanRow,
): string {
  if (scope.area === "NEGERI") {
    return `SELURUH NEGERI ${scope.value.toUpperCase()}`;
  }
  if (scope.area === "PARLIMEN" && ring.seatName) {
    return `PARLIMEN ${ring.seatName.toUpperCase()} (${scope.value.toUpperCase()})`;
  }
  if (scope.area === "DUN" && ring.seatName) {
    return `DUN ${ring.seatName.toUpperCase()} (${scope.value.toUpperCase()})`;
  }
  if (scope.area === "PARLIMEN" || scope.area === "DUN") {
    return `${scope.area} ${scope.value.toUpperCase()}`;
  }
  return "SELURUH NEGARA";
}

function ringkasanPartyWhere(
  level: MapLevel,
  scope: { area: RingkasanScope; value: string },
): { clause: string; params: string[] } {
  if (scope.area === "NEGERI") {
    const col = level === "parliament" ? "parliament_statename" : "dun_statename";
    return eqWhere(col, scope.value);
  }
  if (scope.area === "PARLIMEN") {
    return eqWhere(
      level === "parliament" ? "parliament_code" : "parliament_code",
      scope.value,
    );
  }
  if (scope.area === "DUN") {
    return eqWhere("dun_mapcode", scope.value);
  }
  return { clause: "", params: [] };
}

function buildRingkasanStats(
  ring: RingkasanRow,
  level: MapLevel,
  presentation: Presentation,
  scope: { area: RingkasanScope; value: string },
): Array<{ id: string; label: string; value: string | number; subValue?: string }> {
  const seatLabel =
    level === "dun"
      ? presentation === "ops66"
        ? "OPS66 DUN"
        : "Jumlah DUN"
      : presentation === "ops66"
        ? "OPS66 Parlimen"
        : "Jumlah Parlimen";

  const seatValue = level === "dun" ? ring.dunSeats : ring.parliamentSeats;
  const hasMajority =
    (scope.area === "PARLIMEN" || scope.area === "DUN") &&
    ring.majority != null &&
    ring.majority > 0;

  return [
    { id: "parliament", label: seatLabel, value: seatValue },
    {
      id: "dun",
      label: level === "dun" ? "Parlimen" : "Jumlah DUN",
      value: level === "dun" ? ring.parliamentSeats : ring.dunSeats,
    },
    { id: "dm", label: "Jumlah DM", value: ring.dmCount },
    { id: "electorate", label: "Pengundi Berdaftar", value: ring.electorate },
    {
      id: "ballots",
      label: "Keluar Mengundi",
      value: ring.ballots,
      subValue: `${ring.turnout}%`,
    },
    { id: "turnout", label: "TOV", value: ring.turnout, subValue: "%" },
    {
      id: "majority",
      label: "Majoriti",
      value: hasMajority ? ring.majority! : "N/A",
      subValue: hasMajority ? `${ring.majorityPercent}%` : undefined,
    },
    {
      id: "valid",
      label: "Undi Diterima",
      value: ring.validVotes,
      subValue: `${ring.validPercent}%`,
    },
    {
      id: "spoilt",
      label: "Undi Rosak / Hilang",
      value: `${ring.rejected.toLocaleString("en-MY")} / ${ring.unreturned.toLocaleString("en-MY")}`,
    },
  ];
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

function ringkasanPartyQuery(
  level: MapLevel,
  presentation: Presentation,
  scope: { area: RingkasanScope; value: string },
): {
  fromTable: string;
  partyColumn: string;
  colorColumn: string;
  where: { clause: string; params: string[] };
} {
  if (scope.area === "DUN") {
    const dunTable = seatTable("dun", presentation);
    return {
      fromTable: dunTable,
      partyColumn: "dun_party",
      colorColumn: "dun_color",
      where: eqWhere("dun_mapcode", scope.value),
    };
  }

  const table = seatTable(level, presentation);
  const partyColumn = level === "parliament" ? "parliament_party" : "dun_party";
  const colorColumn = level === "parliament" ? "parliament_color" : "dun_color";
  return {
    fromTable: table,
    partyColumn,
    colorColumn,
    where: ringkasanPartyWhere(level, scope),
  };
}

function ringkasanGroupQuery(
  level: MapLevel,
  presentation: Presentation,
  scope: { area: RingkasanScope; value: string },
): {
  fromTable: string;
  groupColumn: string;
  where: { clause: string; params: string[] };
} {
  if (scope.area === "DUN") {
    const dunTable = seatTable("dun", presentation);
    return {
      fromTable: dunTable,
      groupColumn: "dun_group",
      where: eqWhere("dun_mapcode", scope.value),
    };
  }

  const table = seatTable(level, presentation);
  const groupColumn =
    level === "parliament" ? "parliament_group" : "dun_group";
  return {
    fromTable: table,
    groupColumn,
    where: ringkasanPartyWhere(level, scope),
  };
}

exploreRoutes.get("/summary", async (c) => {
  try {
    const state = c.req.query("state")?.trim() || "";
    const areaParam = c.req.query("area")?.trim() || "";
    const valueParam = c.req.query("value")?.trim() || "";
    const level = parseLevel(c.req.query("level"));
    const presentation = parsePresentation(c.req.query("presentation"));
    const table = seatTable(level, presentation);
    const pool = getKnowledgePool();
    const scope = parseRingkasanScope(areaParam, valueParam, state);

    const ring = await fetchRingkasan(pool, scope, table, presentation);

    const partyQuery = ringkasanPartyQuery(level, presentation, scope);
    const partyFilter = partyQuery.where.clause
      ? ` AND p.${partyQuery.partyColumn} IS NOT NULL AND p.${partyQuery.partyColumn} <> ''`
      : ` WHERE p.${partyQuery.partyColumn} IS NOT NULL AND p.${partyQuery.partyColumn} <> ''`;
    const [partyRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         p.${partyQuery.partyColumn} AS party,
         MAX(COALESCE(NULLIF(party.party_color, ''), p.${partyQuery.colorColumn}, '#5a6e82')) AS color,
         COUNT(*) AS seats
       FROM \`${partyQuery.fromTable}\` p
       LEFT JOIN electorals_party party ON p.${partyQuery.partyColumn} = party.party_name
       ${partyQuery.where.clause}${partyFilter}
       GROUP BY p.${partyQuery.partyColumn}
       ORDER BY seats DESC`,
      partyQuery.where.params,
    );

    const groupQuery = ringkasanGroupQuery(level, presentation, scope);
    const groupFilter = groupQuery.where.clause
      ? ` AND p.${groupQuery.groupColumn} IS NOT NULL AND p.${groupQuery.groupColumn} <> ''`
      : ` WHERE p.${groupQuery.groupColumn} IS NOT NULL AND p.${groupQuery.groupColumn} <> ''`;
    const [groupRows] = await pool.query<RowDataPacket[]>(
      `SELECT
         p.${groupQuery.groupColumn} AS \`group\`,
         MAX(COALESCE(NULLIF(grp.group_color, ''), '#5a6e82')) AS color,
         COUNT(*) AS seats
       FROM \`${groupQuery.fromTable}\` p
       LEFT JOIN electorals_party grp ON p.${groupQuery.groupColumn} = grp.party_name
       ${groupQuery.where.clause}${groupFilter}
       GROUP BY p.${groupQuery.groupColumn}
       ORDER BY seats DESC`,
      groupQuery.where.params,
    );

    const partySeats = (partyRows || []).map((r) => ({
      group: String(r.party || "Unknown"),
      color: String(r.color || "#5a6e82"),
      seats: Number(r.seats ?? 0),
    }));

    const groupSeats = (groupRows || []).map((r) => ({
      group: String(r.group || "Unknown"),
      color: String(r.color || "#5a6e82"),
      seats: Number(r.seats ?? 0),
    }));
    const totalSeats = Math.max(
      groupSeats.reduce((sum, g) => sum + g.seats, 0),
      partySeats.reduce((sum, g) => sum + g.seats, 0),
    );
    const seatOverview = {
      totalSeats,
      majorityRequired: totalSeats > 0 ? Math.floor(totalSeats / 2) + 1 : 0,
      byCoalition: groupSeats,
      byParty: partySeats,
    };

    const areaLabel = buildRingkasanAreaLabel(scope, ring);
    const [breakdown, votersParty] = await Promise.all([
      fetchRingkasanBreakdown(pool, scope),
      fetchVotersParty(pool, scope),
    ]);

    return c.json({
      source: "stt_electorals",
      mode: "read-only",
      election: ELECTION,
      level,
      presentation,
      state: scope.area === "NEGERI" ? scope.value : state || null,
      area: scope.area,
      areaValue: scope.value || null,
      areaLabel,
      stats: buildRingkasanStats(ring, level, presentation, scope),
      partySeats: partySeats.map((r) => ({
        party: r.group,
        color: r.color,
        seats: r.seats,
      })),
      seatOverview,
      breakdown,
      votersParty,
    });
  } catch (err) {
    console.error("[explore/summary]", err);
    return c.json(
      { error: err instanceof Error ? err.message : "Summary query failed" },
      500,
    );
  }
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
       REPLACE(parliament_partylogo, ' ', '_') AS partyLogoFile,
       REPLACE(parliament_grouplogo, ' ', '_') AS groupLogoFile,
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
         REPLACE(dun_partylogo, ' ', '_') AS partyLogoFile,
         REPLACE(dun_grouplogo, ' ', '_') AS groupLogoFile,
         dun_color AS color,
         parliament_code AS parliamentCode
       FROM \`${dunTable}\`
       ORDER BY dun_statename, dun_name`,
    );
    dunRows = rows || [];
  }

  function searchItem(
    r: RowDataPacket,
    electoralType: "parliament" | "dun",
  ) {
    const code = String(r.code);
    const media = seatMediaPaths({
      code,
      electoralType,
      presentation,
      partyLogoFile: r.partyLogoFile,
      groupLogoFile: r.groupLogoFile,
    });
    return {
      code,
      mapCode: String(r.mapCode),
      name: String(r.name),
      electoralType,
      state: String(r.state),
      member: String(r.member || ""),
      party: String(r.party || ""),
      partyGroup: String(r.partyGroup || ""),
      color: String(r.color || "#999999"),
      display:
        electoralType === "parliament"
          ? `PAR : ${String(r.name).toUpperCase()} (${code})`
          : `DUN : ${String(r.name).toUpperCase()} (${code})`,
      partyLogo: media.partyLogo,
      groupLogo: media.groupLogo,
      partyLogoFallback: media.partyLogoFallback,
      groupLogoFallback: media.groupLogoFallback,
      hidePartyLogo: media.hidePartyLogo,
      ...(electoralType === "dun"
        ? { parliamentCode: String(r.parliamentCode || "") }
        : {}),
    };
  }

  const all = [
    ...(parRows || []).map((r) => searchItem(r, "parliament")),
    ...dunRows.map((r) => searchItem(r, "dun")),
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
         REPLACE(p.parliament_partylogo, ' ', '_') AS partyLogoFile,
         REPLACE(p.parliament_grouplogo, ' ', '_') AS groupLogoFile,
         CONCAT(p.parliament_code, ' - ', p.parliament_name) AS seatLabel,
         COALESCE(v.voters_total, p.total_electorate) AS voters,
         IF(party.party_gov, 'YA', 'TIDAK') AS government,
         p.parliament_statename AS state,
         p.parliament_year AS year,
         p.candidate_majority_won AS majority,
         p.candidate_majority_percent AS majorityPercent,
         p.total_turnout AS turnout,
         d.voters_race_malay AS raceMalay,
         d.voters_race_chinese AS raceChinese,
         d.voters_race_indian AS raceIndian,
         d.voters_race_bumi_sabah AS raceBumiSabah,
         d.voters_race_bumi_sarawak AS raceBumiSarawak,
         d.voters_race_others AS raceOthers
       FROM \`${table}\` p
       LEFT JOIN electorals_party party ON p.parliament_party = party.party_name
       LEFT JOIN electorals_voters v
         ON p.parliament_code = v.voters_area_code AND v.voters_area = 'PARLIMEN'
       LEFT JOIN electorals_voters_demography d
         ON p.parliament_code = d.voters_area_code AND d.voters_area = 'PARLIMEN'
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
        "ethnicity",
        "majority",
        "turnout",
      ],
      rows: (rows || []).map((r) => {
        const base = {
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
        };
        const media = seatListRowMedia(
          {
            ...base,
            partyLogoFile: r.partyLogoFile,
            groupLogoFile: r.groupLogoFile,
            raceMalay: Number(r.raceMalay ?? 0),
            raceChinese: Number(r.raceChinese ?? 0),
            raceIndian: Number(r.raceIndian ?? 0),
            raceBumiSabah: Number(r.raceBumiSabah ?? 0),
            raceBumiSarawak: Number(r.raceBumiSarawak ?? 0),
            raceOthers: Number(r.raceOthers ?? 0),
          },
          "parliament",
          presentation,
        );
        return {
          ...base,
          ...media,
        };
      }),
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
       REPLACE(p.dun_partylogo, ' ', '_') AS partyLogoFile,
       REPLACE(p.dun_grouplogo, ' ', '_') AS groupLogoFile,
       p.parliament_code AS parliamentCode,
       CONCAT(p.dun_mapcode, ' - ', p.dun_name) AS seatLabel,
       COALESCE(v.voters_total, p.total_electorate) AS voters,
       IF(party.party_gov_dun, 'YA', 'TIDAK') AS government,
       p.dun_statename AS state,
       p.dun_year AS year,
       p.candidate_majority_won AS majority,
       p.candidate_majority_percent AS majorityPercent,
       p.total_turnout AS turnout,
       d.voters_race_malay AS raceMalay,
       d.voters_race_chinese AS raceChinese,
       d.voters_race_indian AS raceIndian,
       d.voters_race_bumi_sabah AS raceBumiSabah,
       d.voters_race_bumi_sarawak AS raceBumiSarawak,
       d.voters_race_others AS raceOthers
     FROM \`${table}\` p
     LEFT JOIN electorals_party party ON p.dun_party = party.party_name
     LEFT JOIN electorals_voters v
       ON p.dun_mapcode = v.voters_area_code AND v.voters_area = 'DUN'
     LEFT JOIN electorals_voters_demography d
       ON p.dun_mapcode = d.voters_area_code AND d.voters_area = 'DUN'
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
      "ethnicity",
      "majority",
      "turnout",
    ],
    rows: (rows || []).map((r) => {
      const base = {
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
      };
      const media = seatListRowMedia(
        {
          ...base,
          partyLogoFile: r.partyLogoFile,
          groupLogoFile: r.groupLogoFile,
          raceMalay: Number(r.raceMalay ?? 0),
          raceChinese: Number(r.raceChinese ?? 0),
          raceIndian: Number(r.raceIndian ?? 0),
          raceBumiSabah: Number(r.raceBumiSabah ?? 0),
          raceBumiSarawak: Number(r.raceBumiSarawak ?? 0),
          raceOthers: Number(r.raceOthers ?? 0),
        },
        "dun",
        presentation,
      );
      return {
        ...base,
        ...media,
      };
    }),
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

const demographyAreaSchema = z.enum([
  "NEGARA",
  "NEGERI",
  "PARLIMEN",
  "DUN",
  "DM",
]);

function parseDemographyScope(
  areaRaw: string | undefined,
  valueRaw: string | undefined,
): { area: DemographyArea; value: string } {
  const parsed = demographyAreaSchema.safeParse(
    (areaRaw || "NEGARA").toUpperCase(),
  );
  const area = parsed.success ? parsed.data : "NEGARA";
  return { area, value: (valueRaw || "").trim() };
}

exploreRoutes.get("/demography/summary", async (c) => {
  try {
    const scope = parseDemographyScope(
      c.req.query("area"),
      c.req.query("value"),
    );
    const pool = getKnowledgePool();
    const summary = await fetchDemographySummary(pool, scope);
    return c.json(summary);
  } catch (err) {
    console.error("[explore/demography/summary]", err);
    return c.json(
      {
        error: err instanceof Error ? err.message : "Demography summary failed",
      },
      500,
    );
  }
});

exploreRoutes.get("/demography/table", async (c) => {
  try {
    const parent = parseDemographyScope(
      c.req.query("parent"),
      c.req.query("view"),
    );
    const pool = getKnowledgePool();
    const table = await fetchDemographyTable(pool, parent.area, parent.value);
    return c.json(table);
  } catch (err) {
    console.error("[explore/demography/table]", err);
    return c.json(
      {
        error: err instanceof Error ? err.message : "Demography table failed",
      },
      500,
    );
  }
});

const voterListQuerySchema = z.object({
  areaType: z.enum(["NEGARA", "NEGERI", "PARLIMEN", "DUN", "DM", "LOKALITI"]),
  areaCode: z.string().optional(),
  areaName: z.string().optional(),
  filterKind: z
    .enum(["race", "age", "gender", "party", "sikap"])
    .optional(),
  filterKey: z.string().optional(),
  q: z.string().optional(),
  jantina: z.string().optional(),
  bangsa: z.string().optional(),
  negeri: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  offset: z.coerce.number().int().min(0).default(0),
});

function parseVoterListQuery(c: { req: { query: (key: string) => string | undefined } }) {
  return voterListQuerySchema.safeParse({
    areaType: c.req.query("areaType")?.toUpperCase() || "NEGARA",
    areaCode: c.req.query("areaCode") || undefined,
    areaName: c.req.query("areaName") || undefined,
    filterKind: c.req.query("filterKind") || undefined,
    filterKey: c.req.query("filterKey") || undefined,
    q: c.req.query("q") || undefined,
    jantina: c.req.query("jantina") || undefined,
    bangsa: c.req.query("bangsa") || undefined,
    negeri: c.req.query("negeri") || undefined,
    limit: c.req.query("limit") || "25",
    offset: c.req.query("offset") || "0",
  });
}

exploreRoutes.get("/voters", async (c) => {
  try {
    const parsed = parseVoterListQuery(c);

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const pool = getKnowledgePool();
    const result = await fetchVoterList(pool, parsed.data);
    return c.json(result);
  } catch (err) {
    console.error("[explore/voters]", err);
    return c.json(
      { error: err instanceof Error ? err.message : "Voter list failed" },
      500,
    );
  }
});

exploreRoutes.get("/voters/export", async (c) => {
  try {
    const parsed = parseVoterListQuery(c);

    if (!parsed.success) {
      return c.json({ error: parsed.error.flatten() }, 400);
    }

    const { limit: _limit, offset: _offset, ...exportQuery } = parsed.data;
    const pool = getKnowledgePool();
    const result = await fetchVoterListExport(pool, exportQuery);
    return c.json(result);
  } catch (err) {
    console.error("[explore/voters/export]", err);
    return c.json(
      { error: err instanceof Error ? err.message : "Voter export failed" },
      500,
    );
  }
});

exploreRoutes.get("/voters/:ic", async (c) => {
  const ic = c.req.param("ic").trim();
  if (!/^\d{12}$/.test(ic)) {
    return c.json({ error: "Invalid IC" }, 400);
  }

  try {
    const profile = await getVoterProfile(ic);
    if (!profile) return c.json({ error: "Not found" }, 404);
    return c.json(profile);
  } catch (err) {
    console.error("voter profile error", err);
    return c.json({ error: "Failed to load voter profile" }, 500);
  }
});
