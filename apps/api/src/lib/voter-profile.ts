import type { RowDataPacket } from "mysql2";
import { getKnowledgePool } from "../db/knowledge.js";
import { getBirthPlaceFromIc } from "./birth-place.js";
import { voterPhotoPaths } from "./electoral-media.js";

export type VoterEducation = {
  confermentDate: string;
  title: string;
  institution: string;
};

export type VoterPartyMembership = {
  name: string;
  membershipNo: string;
  branchName: string;
  divisionName: string;
  stateName: string;
  status: string;
  partyLogo: string;
  partyLogoFallback: string;
};

export type VoterAddress = {
  fullAddress: string;
  latitude: string;
  longitude: string;
  source: string;
};

export type VoterProfile = {
  ic: string;
  name: string;
  gender: string;
  race: string;
  religion: string;
  birthDate: string;
  birthDateDisplay: string;
  age: number | null;
  birthPlace: string;
  addressHtml: string;
  addresses: VoterAddress[];
  phones: string[];
  emails: string[];
  social: Array<{ network: string; url: string }>;
  education: VoterEducation[];
  income: { amount: number | null; class: string };
  partyMemberships: VoterPartyMembership[];
  sikap: string;
  state: string;
  lokaliti: string;
  dmCode: string;
  dmName: string;
  dunCode: string;
  dunName: string;
  parliamentCode: string;
  parliamentName: string;
  mapCode: string;
  partyPar: string;
  partyDun: string;
  partyParLogo: string;
  partyDunLogo: string;
  partyLogoFallback: string;
  photo?: string;
  photoLocal?: string;
  photoFallback?: string;
};

function isValidIc(ic: string): boolean {
  return /^\d{12}$/.test(ic);
}

function partyLogoPath(partyName: unknown): string {
  const file = String(partyName ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9._-]/g, "")
    .replace(/\.png$/i, "");
  return `parties/${file || "ind"}.png`;
}

function buildFullAddress(row: RowDataPacket): string {
  const lines: string[] = [];
  const firstLine = `${String(row.house_no ?? "").trim()} ${String(row.line1 ?? "").trim()}`.trim();
  if (firstLine) lines.push(firstLine);

  for (const col of ["line2", "line3", "line4"]) {
    const val = String(row[col] ?? "").trim();
    if (val) lines.push(val);
  }

  const postcodeCity = `${String(row.postcode ?? "").trim()} ${String(row.city ?? "").trim()}`.trim();
  const state = String(row.state ?? "").trim();
  if (postcodeCity) lines.push(postcodeCity);
  if (state) lines.push(state);

  return lines.join(", ");
}

function computeAge(birthDate: unknown): number | null {
  const raw = String(birthDate ?? "").slice(0, 10);
  if (!raw) return null;
  const birth = new Date(raw);
  if (Number.isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

function formatBirthDateDisplay(birthDate: unknown): string {
  const raw = String(birthDate ?? "").slice(0, 10);
  if (!raw) return "";
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw.toUpperCase();
  return date
    .toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

function uniqueStrings(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))];
}

export async function getVoterProfile(icRaw: string): Promise<VoterProfile | null> {
  const ic = icRaw.trim();
  if (!isValidIc(ic)) return null;

  const pool = getKnowledgePool();

  const [mainRows] = await pool.query<RowDataPacket[]>(
    `SELECT * FROM electorals_register WHERE ic = ? LIMIT 1`,
    [ic],
  );
  const main = mainRows?.[0];
  if (!main) return null;

  const [partyParRows, partyDunRows, educationRows, incomeRows, emailRows, socialRows, phoneRows, partyRows, addressRows] =
    await Promise.all([
      pool.query<RowDataPacket[]>(
        `SELECT parliament_party FROM electorals_parliament WHERE parliament_code = ? LIMIT 1`,
        [main.parliament_code],
      ),
      pool.query<RowDataPacket[]>(
        `SELECT dun_party FROM electorals_dun WHERE dun_mapcode = ? LIMIT 1`,
        [main.map_code],
      ),
      pool.query<RowDataPacket[]>(
        `SELECT conferment_date, title, institution
         FROM electorals_mantooman_education
         WHERE ic = ?
         ORDER BY conferment_date DESC`,
        [ic],
      ),
      pool.query<RowDataPacket[]>(
        `SELECT income FROM electorals_mantooman_income WHERE ic = ? LIMIT 1`,
        [ic],
      ),
      pool.query<RowDataPacket[]>(
        `SELECT email FROM electorals_mantooman_email WHERE ic = ?`,
        [ic],
      ),
      pool.query<RowDataPacket[]>(
        `SELECT network,
                CASE
                  WHEN network = 'FACEBOOK' THEN CONCAT('https://www.facebook.com/', handle)
                  WHEN network = 'TWITTER' THEN CONCAT('https://twitter.com/', handle)
                  WHEN network = 'LINKEDIN' THEN CONCAT('https://www.linkedin.com/in/', handle)
                  WHEN network = 'INSTAGRAM' THEN CONCAT('https://www.instagram.com/', handle)
                  WHEN network = 'TIKTOK' THEN CONCAT('https://www.tiktok.com/', handle)
                END AS url
         FROM electorals_mantooman_social
         WHERE ic = ?`,
        [ic],
      ),
      pool.query<RowDataPacket[]>(
        `SELECT number FROM electorals_mantooman_phone WHERE ic = ?`,
        [ic],
      ),
      pool.query<RowDataPacket[]>(
        `SELECT name, membership_no, branch_name, division_name, state_name, status
         FROM electorals_mantooman_party
         WHERE ic = ?`,
        [ic],
      ),
      pool.query<RowDataPacket[]>(
        `SELECT house_no, line1, line2, line3, line4, postcode, city, state, latitude, longitude, source
         FROM electorals_mantooman_address
         WHERE ic = ?`,
        [ic],
      ),
    ]);

  const partyPar = String(partyParRows[0]?.[0]?.parliament_party ?? "");
  const partyDun = String(partyDunRows[0]?.[0]?.dun_party ?? "");

  let incomeAmount: number | null = null;
  let incomeClass = "";
  const incomeRow = incomeRows[0]?.[0];
  if (incomeRow?.income != null && incomeRow.income !== "") {
    incomeAmount = Number(incomeRow.income);
    if (Number.isFinite(incomeAmount)) {
      const [classRows] = await pool.query<RowDataPacket[]>(
        `SELECT CONCAT(income_class, ' - ', income_subclass) AS income_class
         FROM electorals_mantooman_income_class
         WHERE income_to >= ? AND income_from <= ?
         LIMIT 1`,
        [incomeAmount, incomeAmount],
      );
      incomeClass = String(classRows?.[0]?.income_class ?? "");
    }
  }

  const education = (educationRows[0] || [])
    .filter((row) => String(row.conferment_date ?? "") !== "")
    .map((row) => ({
      confermentDate: String(row.conferment_date ?? "").slice(0, 10),
      title: String(row.title ?? ""),
      institution: String(row.institution ?? ""),
    }));

  const emails = uniqueStrings(
    (emailRows[0] || []).map((row) => String(row.email ?? "").trim()),
  );

  const phones = uniqueStrings(
    (phoneRows[0] || []).map((row) =>
      String(row.number ?? "").replace(/\D/g, ""),
    ),
  );

  const socialSeen = new Set<string>();
  const social = (socialRows[0] || [])
    .filter((row) => row.url)
    .filter((row) => {
      const url = String(row.url);
      if (socialSeen.has(url)) return false;
      socialSeen.add(url);
      return true;
    })
    .map((row) => ({
      network: String(row.network ?? ""),
      url: String(row.url ?? ""),
    }));

  const membershipSeen = new Set<string>();
  const partyMemberships = (partyRows[0] || [])
    .filter((row) => {
      const key = String(row.membership_no ?? "N/A");
      if (membershipSeen.has(key)) return false;
      membershipSeen.add(key);
      return true;
    })
    .map((row) => {
      const name = String(row.name ?? "N/A");
      return {
        name,
        membershipNo: String(row.membership_no ?? "N/A"),
        branchName: String(row.branch_name ?? "N/A"),
        divisionName: String(row.division_name ?? "N/A"),
        stateName: String(row.state_name ?? "N/A"),
        status: String(row.status ?? "N/A"),
        partyLogo: partyLogoPath(name),
        partyLogoFallback: "parties/ind.png",
      };
    });

  const addressTracker = new Set<string>();
  const addresses: VoterAddress[] = [];
  for (const row of addressRows[0] || []) {
    const fullAddress = buildFullAddress(row);
    if (!fullAddress) continue;
    const normalized = fullAddress.toLowerCase().replace(/[^a-z0-9]/gi, "");
    if (addressTracker.has(normalized)) continue;
    addressTracker.add(normalized);

    addresses.push({
      fullAddress,
      latitude: isFinite(Number(row.latitude)) ? String(row.latitude) : "",
      longitude: isFinite(Number(row.longitude)) ? String(row.longitude) : "",
      source: String(row.source ?? ""),
    });
  }

  const registerAge = Number(main.age);
  const computedAge = computeAge(main.tarikh_lahir);

  return {
    ic: String(main.ic ?? ic),
    name: String(main.nama ?? ""),
    gender: String(main.jantina ?? ""),
    race: String(main.bangsa ?? ""),
    religion: String(main.agama ?? ""),
    birthDate: String(main.tarikh_lahir ?? "").slice(0, 10),
    birthDateDisplay: formatBirthDateDisplay(main.tarikh_lahir),
    age: computedAge ?? (Number.isFinite(registerAge) ? registerAge : null),
    birthPlace: getBirthPlaceFromIc(ic).toUpperCase(),
    addressHtml: String(main.alamat_html ?? ""),
    addresses,
    phones,
    emails,
    social,
    education,
    income: { amount: incomeAmount, class: incomeClass },
    partyMemberships,
    sikap: String(main.sikap ?? "").toUpperCase(),
    state: String(main.negeri ?? ""),
    lokaliti: String(main.lokaliti ?? ""),
    dmCode: String(main.dm_code ?? ""),
    dmName: String(main.dm ?? ""),
    dunCode: String(main.dun_code ?? ""),
    dunName: String(main.dun ?? ""),
    parliamentCode: String(main.parliament_code ?? ""),
    parliamentName: String(main.parlimen ?? ""),
    mapCode: String(main.map_code ?? ""),
    partyPar,
    partyDun,
    partyParLogo: partyLogoPath(partyPar),
    partyDunLogo: partyLogoPath(partyDun),
    partyLogoFallback: "parties/ind.png",
    ...voterPhotoPaths(ic),
  };
}
