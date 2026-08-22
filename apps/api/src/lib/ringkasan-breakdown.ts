import type { RowDataPacket } from "mysql2";
import type { Pool } from "mysql2/promise";

const ELECTION = "GE15";

export type RingkasanScope = "NEGARA" | "NEGERI" | "PARLIMEN" | "DUN";

export type BreakdownChip = {
  name: string;
  label: string;
  seats: number;
  contested: number;
  isGovernment: boolean;
  logo: string;
};

export type BreakdownSection = {
  government: BreakdownChip[];
  nonGovernment: BreakdownChip[];
  governmentTotal: number;
  nonGovernmentTotal: number;
};

export type RingkasanBreakdown = {
  showParliament: boolean;
  showDun: boolean;
  parliamentCoalition: BreakdownSection;
  parliamentParty: BreakdownSection;
  dunCoalition: BreakdownSection;
  dunParty: BreakdownSection;
};

type Scope = { area: RingkasanScope; value: string };

type Where = { clause: string; params: string[] };

function eq(col: string, value: string): Where {
  return { clause: ` AND LOWER(${col}) = ?`, params: [value.toLowerCase()] };
}

function partyLogo(name: string): string {
  const file = String(name || "ind").trim().replace(/ /g, "_").toLowerCase();
  return `parties/${file || "ind"}.png`;
}

function splitChips(rows: RowDataPacket[], govKey: string): BreakdownSection {
  const government: BreakdownChip[] = [];
  const nonGovernment: BreakdownChip[] = [];
  let governmentTotal = 0;
  let nonGovernmentTotal = 0;

  for (const r of rows) {
    const name = String(r.name || "").trim();
    if (!name) continue;
    const seats = Number(r.seats ?? 0);
    const contested = Number(r.contested ?? 0);
    const chip: BreakdownChip = {
      name,
      label: name,
      seats,
      contested,
      isGovernment: String(r[govKey] ?? "0") === "1",
      logo: partyLogo(name),
    };
    if (chip.isGovernment) {
      government.push(chip);
      governmentTotal += seats;
    } else {
      nonGovernment.push(chip);
      nonGovernmentTotal += seats;
    }
  }

  return { government, nonGovernment, governmentTotal, nonGovernmentTotal };
}

function parliamentSeatWhere(scope: Scope): Where {
  if (scope.area === "NEGERI") return eq("parliament_statename", scope.value);
  if (scope.area === "PARLIMEN") return eq("parliament_code", scope.value);
  return { clause: "", params: [] };
}

function dunSeatWhere(scope: Scope): Where {
  if (scope.area === "NEGERI") return eq("dun_statename", scope.value);
  if (scope.area === "PARLIMEN") return eq("parliament_code", scope.value);
  if (scope.area === "DUN") return eq("dun_mapcode", scope.value);
  return { clause: "", params: [] };
}

function parliamentContestWhere(scope: Scope): Where {
  if (scope.area === "NEGERI") return eq("candidate_state", scope.value);
  if (scope.area === "PARLIMEN") return eq("parliament_code", scope.value);
  return { clause: "", params: [] };
}

function dunContestStateWhere(scope: Scope): Where {
  if (scope.area === "NEGERI") return eq("d.dun_statename", scope.value);
  if (scope.area === "PARLIMEN") return eq("d.parliament_code", scope.value);
  if (scope.area === "DUN") return eq("d.dun_mapcode", scope.value);
  return { clause: "", params: [] };
}

async function queryParliamentCoalition(
  pool: Pool,
  scope: Scope,
): Promise<BreakdownSection> {
  const seatWhere = parliamentSeatWhere(scope);
  const contestWhere = parliamentContestWhere(scope);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       T1.group_name AS name,
       T1.seats AS seats,
       COALESCE(T3.contested, 0) AS contested,
       T2.party_gov AS party_gov
     FROM (
       SELECT parliament_group AS group_name, COUNT(*) AS seats
       FROM electorals_parliament
       WHERE parliament_group IS NOT NULL AND parliament_group <> ''
       ${seatWhere.clause}
       GROUP BY parliament_group
     ) T1
     LEFT JOIN electorals_party T2 ON T1.group_name = T2.party_name
     LEFT JOIN (
       SELECT candidate_group AS group_name, COUNT(DISTINCT map_code) AS contested
       FROM electorals_candidates_main
       WHERE candidate_election = ?
         AND dun_code = ''
         AND candidate_vote_won > 0
       ${contestWhere.clause}
       GROUP BY candidate_group
     ) T3 ON T1.group_name = T3.group_name
     ORDER BY T1.seats DESC`,
    [...seatWhere.params, ELECTION, ...contestWhere.params],
  );
  return splitChips(rows || [], "party_gov");
}

async function queryParliamentParty(
  pool: Pool,
  scope: Scope,
): Promise<BreakdownSection> {
  const seatWhere = parliamentSeatWhere(scope);
  const contestWhere = parliamentContestWhere(scope);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       T1.party_name AS name,
       T1.seats AS seats,
       COALESCE(T3.contested, 0) AS contested,
       T2.party_gov AS party_gov
     FROM (
       SELECT parliament_party AS party_name, COUNT(*) AS seats
       FROM electorals_parliament
       WHERE parliament_party IS NOT NULL AND parliament_party <> ''
       ${seatWhere.clause}
       GROUP BY parliament_party
     ) T1
     LEFT JOIN electorals_party T2 ON T1.party_name = T2.party_name
     LEFT JOIN (
       SELECT candidate_party AS party_name, COUNT(DISTINCT map_code) AS contested
       FROM electorals_candidates_main
       WHERE candidate_election = ?
         AND dun_code = ''
         AND candidate_vote_won > 0
       ${contestWhere.clause}
       GROUP BY candidate_party
     ) T3 ON T1.party_name = T3.party_name
     ORDER BY T1.seats DESC`,
    [...seatWhere.params, ELECTION, ...contestWhere.params],
  );
  return splitChips(rows || [], "party_gov");
}

async function queryDunCoalition(pool: Pool, scope: Scope): Promise<BreakdownSection> {
  const seatWhere = dunSeatWhere(scope);
  const contestWhere = dunContestStateWhere(scope);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       T1.group_name AS name,
       T1.seats AS seats,
       COALESCE(T3.contested, 0) AS contested,
       T2.party_gov_dun AS party_gov
     FROM (
       SELECT dun_group AS group_name, COUNT(*) AS seats
       FROM electorals_dun
       WHERE dun_group IS NOT NULL AND dun_group <> ''
       ${seatWhere.clause}
       GROUP BY dun_group
     ) T1
     LEFT JOIN electorals_party T2 ON T1.group_name = T2.party_name
     LEFT JOIN (
       SELECT c.candidate_group AS group_name, COUNT(DISTINCT c.map_code) AS contested
       FROM electorals_candidates_main c
       INNER JOIN electorals_dun d ON c.map_code = d.dun_mapcode
       INNER JOIN (
         SELECT map_code, MAX(candidate_year) AS latest_year
         FROM electorals_candidates_main
         WHERE dun_code <> ''
           AND candidate_vote_won > 0
           AND (candidate_election = ? OR candidate_election LIKE 'PRN%')
         GROUP BY map_code
       ) latest ON latest.map_code = c.map_code AND latest.latest_year = c.candidate_year
       WHERE c.dun_code <> ''
         AND c.candidate_vote_won > 0
         AND (c.candidate_election = ? OR c.candidate_election LIKE 'PRN%')
       ${contestWhere.clause}
       GROUP BY c.candidate_group
     ) T3 ON T1.group_name = T3.group_name
     ORDER BY T1.seats DESC`,
    [...seatWhere.params, ELECTION, ELECTION, ...contestWhere.params],
  );
  return splitChips(rows || [], "party_gov");
}

async function queryDunParty(pool: Pool, scope: Scope): Promise<BreakdownSection> {
  const seatWhere = dunSeatWhere(scope);
  const contestWhere = dunContestStateWhere(scope);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT
       T1.party_name AS name,
       T1.seats AS seats,
       COALESCE(T3.contested, 0) AS contested,
       T2.party_gov_dun AS party_gov
     FROM (
       SELECT dun_party AS party_name, COUNT(*) AS seats
       FROM electorals_dun
       WHERE dun_party IS NOT NULL AND dun_party <> ''
       ${seatWhere.clause}
       GROUP BY dun_party
     ) T1
     LEFT JOIN electorals_party T2 ON T1.party_name = T2.party_name
     LEFT JOIN (
       SELECT c.candidate_party AS party_name, COUNT(DISTINCT c.map_code) AS contested
       FROM electorals_candidates_main c
       INNER JOIN electorals_dun d ON c.map_code = d.dun_mapcode
       INNER JOIN (
         SELECT map_code, MAX(candidate_year) AS latest_year
         FROM electorals_candidates_main
         WHERE dun_code <> ''
           AND candidate_vote_won > 0
           AND (candidate_election = ? OR candidate_election LIKE 'PRN%')
         GROUP BY map_code
       ) latest ON latest.map_code = c.map_code AND latest.latest_year = c.candidate_year
       WHERE c.dun_code <> ''
         AND c.candidate_vote_won > 0
         AND (c.candidate_election = ? OR c.candidate_election LIKE 'PRN%')
       ${contestWhere.clause}
       GROUP BY c.candidate_party
     ) T3 ON T1.party_name = T3.party_name
     ORDER BY T1.seats DESC`,
    [...seatWhere.params, ELECTION, ELECTION, ...contestWhere.params],
  );
  return splitChips(rows || [], "party_gov");
}

function breakdownVisibility(scope: Scope): {
  showParliament: boolean;
  showDun: boolean;
} {
  const isWilayah =
    scope.area === "NEGERI" && scope.value.toLowerCase().includes("wilayah");

  if (scope.area === "DUN") {
    return { showParliament: false, showDun: true };
  }
  if (scope.area === "PARLIMEN" || isWilayah) {
    return { showParliament: true, showDun: false };
  }
  return { showParliament: true, showDun: true };
}

export async function fetchRingkasanBreakdown(
  pool: Pool,
  scope: Scope,
): Promise<RingkasanBreakdown> {
  const visibility = breakdownVisibility(scope);

  const [
    parliamentCoalition,
    parliamentParty,
    dunCoalition,
    dunParty,
  ] = await Promise.all([
    visibility.showParliament
      ? queryParliamentCoalition(pool, scope)
      : emptySection(),
    visibility.showParliament
      ? queryParliamentParty(pool, scope)
      : emptySection(),
    visibility.showDun ? queryDunCoalition(pool, scope) : emptySection(),
    visibility.showDun ? queryDunParty(pool, scope) : emptySection(),
  ]);

  return {
    ...visibility,
    parliamentCoalition,
    parliamentParty,
    dunCoalition,
    dunParty,
  };
}

function emptySection(): BreakdownSection {
  return {
    government: [],
    nonGovernment: [],
    governmentTotal: 0,
    nonGovernmentTotal: 0,
  };
}
