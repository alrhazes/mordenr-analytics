import type { RowDataPacket } from "mysql2";
import type mysql from "mysql2/promise";
import type {
  CandidateRow,
  SimulationAreaType,
  SimulationScopeArea,
} from "./types.js";

export type LoadCandidatesOptions = {
  areaType: SimulationAreaType;
  scopeArea: SimulationScopeArea;
  scopeName?: string;
  seatCodes?: string[];
};

export async function loadCandidateRows(
  pool: mysql.Pool,
  options: LoadCandidatesOptions,
): Promise<CandidateRow[]> {
  const { areaType, scopeArea, scopeName, seatCodes } = options;
  const isParlimen = areaType === "parlimen";

  const where: string[] = [];
  const params: Array<string | number> = [];

  if (isParlimen) {
    if (seatCodes?.length) {
      where.push(
        `parliament_code IN (${seatCodes.map(() => "?").join(",")})`,
      );
      params.push(...seatCodes);
    } else {
      where.push("parliament_code <> ''");
    }

    if (scopeArea === "NEGERI" && scopeName) {
      where.push("candidate_state = ?");
      params.push(scopeName);
    }

    const filterClause = where.length ? `AND ${where.join(" AND ")}` : "";

    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT t.*
       FROM electorals_candidates_main t
       JOIN (
         SELECT parliament_code, MAX(candidate_year) AS latest_year
         FROM electorals_candidates_main
         WHERE dun_code = ''
         ${filterClause}
         GROUP BY parliament_code
       ) x ON t.parliament_code = x.parliament_code
          AND t.candidate_year = x.latest_year
       WHERE t.dun_code = ''
       ORDER BY t.parliament_code, t.candidate_vote_won DESC`,
      params,
    );

    return (rows || []).map(mapCandidateRow);
  }

  if (seatCodes?.length) {
    where.push(`map_code IN (${seatCodes.map(() => "?").join(",")})`);
    params.push(...seatCodes);
  } else {
    where.push("map_code <> ''");
  }

  if (scopeArea === "NEGERI" && scopeName) {
    where.push("candidate_state = ?");
    params.push(scopeName);
  }

  const filterClause = where.length ? `AND ${where.join(" AND ")}` : "";

  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT t.*
     FROM electorals_candidates_main t
     JOIN (
       SELECT map_code, MAX(candidate_year) AS latest_year
       FROM electorals_candidates_main
       WHERE dun_code <> '' AND parliament_code <> ''
       ${filterClause}
       GROUP BY map_code
     ) x ON t.map_code = x.map_code AND t.candidate_year = x.latest_year
     WHERE t.dun_code <> '' AND t.parliament_code <> ''
     ORDER BY t.map_code, t.candidate_vote_won DESC`,
    params,
  );

  return (rows || []).map(mapCandidateRow);
}

function mapCandidateRow(r: RowDataPacket): CandidateRow {
  return {
    parliament_code: String(r.parliament_code ?? ""),
    parliament_name: String(r.parliament_name ?? ""),
    dun_name: String(r.dun_name ?? ""),
    map_code: String(r.map_code ?? ""),
    dun_code: String(r.dun_code ?? ""),
    candidate_election: String(r.candidate_election ?? ""),
    candidate_year: Number(r.candidate_year ?? 0),
    candidate_state: String(r.candidate_state ?? ""),
    candidate_group: String(r.candidate_group ?? ""),
    candidate_party: String(r.candidate_party ?? ""),
    candidate_verdict: String(r.candidate_verdict ?? ""),
    candidate_vote_won: Number(r.candidate_vote_won ?? 0),
    candidate_majority_won: Number(r.candidate_majority_won ?? 0),
    total_electorate: Number(r.total_electorate ?? 0),
    total_ballots: Number(r.total_ballots ?? 0),
    total_unreturned: Number(r.total_unreturned ?? 0),
    total_rejected: Number(r.total_rejected ?? 0),
  };
}

export async function loadPartyColors(
  pool: mysql.Pool,
): Promise<Map<string, string>> {
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT party_name, party_color FROM electorals_party WHERE TRIM(party_name) <> ''`,
  );
  const map = new Map<string, string>();
  for (const r of rows || []) {
    const name = String(r.party_name ?? "").trim().toUpperCase();
    if (name && !map.has(name)) {
      map.set(name, String(r.party_color || "#999999"));
    }
  }
  return map;
}

export async function loadPartyChangesForMaps(
  pool: mysql.Pool,
  mapCodes: string[],
): Promise<
  Record<
    string,
    {
      by_group: import("./types.js").PartyChangeByGroup;
      rows: import("./types.js").PartyChangeRow[];
    }
  >
> {
  if (!mapCodes.length) return {};

  const placeholders = mapCodes.map(() => "?").join(",");
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT map_code, candidate_id, candidate_group, historical_party, simulation_party
     FROM electorals_mainsim_partychange
     WHERE map_code IN (${placeholders})`,
    mapCodes,
  );

  const { partyChangesToByGroup } = await import("./party-change.js");
  const byMap: Record<
    string,
    {
      by_group: import("./types.js").PartyChangeByGroup;
      rows: import("./types.js").PartyChangeRow[];
    }
  > = {};

  const grouped = new Map<string, import("./types.js").PartyChangeRow[]>();
  for (const r of rows || []) {
    const code = String(r.map_code ?? "");
    const list = grouped.get(code) || [];
    list.push({
      candidate_id: Number(r.candidate_id),
      candidate_group: String(r.candidate_group ?? ""),
      historical_party: String(r.historical_party ?? ""),
      simulation_party: String(r.simulation_party ?? ""),
    });
    grouped.set(code, list);
  }

  for (const [code, list] of grouped) {
    byMap[code] = { rows: list, by_group: partyChangesToByGroup(list) };
  }

  return byMap;
}
