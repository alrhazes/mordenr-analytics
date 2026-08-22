import { Hono } from "hono";
import type { RowDataPacket } from "mysql2";
import { getKnowledgePool } from "../db/knowledge.js";

const ELECTION = "GE15";

export const exploreRoutes = new Hono();

exploreRoutes.get("/summary", async (c) => {
  const state = c.req.query("state")?.trim() || "";
  const pool = getKnowledgePool();

  const where = ["p.parliament_election = ?"];
  const params: Array<string> = [ELECTION];
  if (state) {
    where.push("p.parliament_statename = ?");
    params.push(state);
  }
  const clause = where.join(" AND ");

  const [kpiRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       COUNT(*) AS seats,
       COALESCE(SUM(p.total_electorate), 0) AS electorate,
       ROUND(AVG(NULLIF(p.total_turnout, 0)), 2) AS avgTurnout,
       COUNT(DISTINCT p.parliament_party) AS parties
     FROM electorals_parliament p
     WHERE ${clause}`,
    params,
  );

  const kpi = kpiRows[0] || {};

  const [partyRows] = await pool.query<RowDataPacket[]>(
    `SELECT
       p.parliament_party AS party,
       MAX(p.parliament_color) AS color,
       COUNT(*) AS seats
     FROM electorals_parliament p
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
    state: state || null,
    kpis: [
      {
        id: "seats",
        label: "Parliament seats",
        value: Number(kpi.seats ?? 0),
        hint: state ? state : "GE15 national",
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
  const pool = getKnowledgePool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       parliament_statename AS name,
       COUNT(*) AS seats
     FROM electorals_parliament
     WHERE parliament_election = ?
     GROUP BY parliament_statename
     ORDER BY parliament_statename ASC`,
    [ELECTION],
  );

  return c.json({
    election: ELECTION,
    states: (rows || []).map((r) => ({
      name: String(r.name),
      seats: Number(r.seats ?? 0),
    })),
  });
});

exploreRoutes.get("/geo", async (c) => {
  const state = c.req.query("state")?.trim() || "";
  const pool = getKnowledgePool();

  if (!state) {
    // National overview: light point markers only
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         p.parliament_code AS code,
         p.parliament_name AS name,
         p.parliament_statename AS state,
         p.parliament_party AS party,
         p.parliament_color AS color,
         p.parliament_ahli AS member,
         p.total_electorate AS electorate,
         p.total_turnout AS turnout,
         m.center_lat AS lat,
         m.center_lng AS lng
       FROM electorals_parliament p
       INNER JOIN electorals_map m
         ON m.map_code = p.parliament_code AND m.enabled = 1
       WHERE p.parliament_election = ?
         AND m.center_lat <> 0 AND m.center_lng <> 0`,
      [ELECTION],
    );

    return c.json({
      type: "FeatureCollection",
      kind: "points",
      election: ELECTION,
      state: null,
      features: (rows || []).map((r) => ({
        type: "Feature",
        geometry: {
          type: "Point",
          coordinates: [Number(r.lng), Number(r.lat)],
        },
        properties: featureProps(r),
      })),
    });
  }

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       p.parliament_code AS code,
       p.parliament_name AS name,
       p.parliament_statename AS state,
       p.parliament_party AS party,
       p.parliament_color AS color,
       p.parliament_ahli AS member,
       p.total_electorate AS electorate,
       p.total_turnout AS turnout,
       m.center_lat AS lat,
       m.center_lng AS lng,
       ST_AsGeoJSON(m.map_coordinates_detail) AS geometryJson
     FROM electorals_parliament p
     INNER JOIN electorals_map m
       ON m.map_code = p.parliament_code AND m.enabled = 1
     WHERE p.parliament_election = ?
       AND p.parliament_statename = ?`,
    [ELECTION, state],
  );

  const features = [];
  for (const r of rows || []) {
    const raw =
      (r as RowDataPacket).geometryJson ??
      (r as RowDataPacket).geometryjson ??
      (r as RowDataPacket).GEOMETRYJSON;

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
      geometry = {
        type: "Point",
        coordinates: [Number(r.lng), Number(r.lat)],
      };
    }

    features.push({
      type: "Feature",
      geometry,
      properties: featureProps(r),
    });
  }

  return c.json({
    type: "FeatureCollection",
    kind: "polygons",
    election: ELECTION,
    state,
    features,
  });
});

exploreRoutes.get("/parliaments/:code", async (c) => {
  const code = c.req.param("code");
  const pool = getKnowledgePool();

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       p.parliament_code AS code,
       p.parliament_name AS name,
       p.parliament_statename AS state,
       p.parliament_party AS party,
       p.parliament_group AS partyGroup,
       p.parliament_color AS color,
       p.parliament_ahli AS member,
       p.total_electorate AS electorate,
       p.total_ballots AS ballots,
       p.total_valid AS validVotes,
       p.total_turnout AS turnout,
       p.candidate_majority_won AS majority,
       p.candidate_majority_percent AS majorityPercent,
       m.center_lat AS lat,
       m.center_lng AS lng
     FROM electorals_parliament p
     LEFT JOIN electorals_map m
       ON m.map_code = p.parliament_code AND m.enabled = 1
     WHERE p.parliament_election = ?
       AND p.parliament_code = ?
     LIMIT 1`,
    [ELECTION, code],
  );

  if (!rows?.[0]) {
    return c.json({ error: "Not found" }, 404);
  }

  const r = rows[0];
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
    },
  });
});

function featureProps(r: RowDataPacket) {
  return {
    code: String(r.code),
    name: String(r.name),
    state: String(r.state),
    party: String(r.party),
    color: String(r.color || "#5a6e82"),
    member: String(r.member || ""),
    electorate: Number(r.electorate ?? 0),
    turnout: Number(r.turnout ?? 0),
  };
}
