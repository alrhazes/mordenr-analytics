import type { RowDataPacket } from "mysql2";
import { getKnowledgePool } from "../db/knowledge.js";

const CALLSTORE_AUDIO_BASE =
  process.env.CALLSTORE_AUDIO_BASE?.replace(/\/+$/, "") ||
  "https://callstore.smarttechtank.com/storage";

const XBLASTER_STORAGE_BASE =
  process.env.XBLASTER_STORAGE_BASE?.replace(/\/+$/, "") ||
  "https://xblasterz.smarttechtank.com/storage";

/** Filtered question IDs from bdcat get_voters_audio (PANDAN). */
const CALLSTORE_EXCLUDED_QUESTIONS = [288, 289, 538, 539, 542];

export type VoterCallCentreResponse = {
  questionId: number;
  questionText: string;
  answers: Array<{ answerId: number; answerText: string }>;
};

export type VoterCallCentre = {
  audioPath: string;
  attitude: string;
  attitudeLabel: string;
  campaignName: string;
  callStatusId: number | null;
  audioDate: string;
  responses: VoterCallCentreResponse[];
};

export type VoterWhatsappCampaign = {
  id: number;
  url: string;
  caption: string;
  sentiment: string;
  sentimentLabel: string;
  screenshotDate: string;
  screenshotDateDisplay: string;
  campaignName: string;
};

export type VoterWhatsappBlast = {
  name: string;
  phoneNo: string;
  campaigns: VoterWhatsappCampaign[];
};

export type VoterOrganization = {
  position: string;
  organization: string;
  type: string;
  fullPosition: string;
};

function isValidIc(ic: string): boolean {
  return /^\d{12}$/.test(ic);
}

export function sentimentLabel(code: unknown): string {
  const value = String(code ?? "").toUpperCase();
  if (value === "P") return "PUTIH";
  if (value === "K") return "KELABU";
  if (value === "H") return "HITAM";
  return value || "—";
}

function formatDisplayDate(raw: unknown): string {
  const value = String(raw ?? "").slice(0, 10);
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value.toUpperCase();
  return date
    .toLocaleDateString("en-MY", {
      day: "numeric",
      month: "short",
      year: "numeric",
    })
    .toUpperCase();
}

export async function getVoterCallCentre(
  icRaw: string,
): Promise<VoterCallCentre | null> {
  const ic = icRaw.trim();
  if (!isValidIc(ic)) return null;

  const pool = getKnowledgePool();
  const excluded = CALLSTORE_EXCLUDED_QUESTIONS.join(",");

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         T4.attitude,
         CONCAT(?, '/', T4.path) AS audio_path,
         T3.name AS campaign_name,
         T8.call_status_id,
         T5.id AS question_id,
         T5.questionaire AS question_text,
         T6.id AS answer_id,
         T6.descriptions AS answer_text,
         T4.updated_at
       FROM db_callstore.respondents T1
       JOIN db_callstore.campaign_respondent T2
         ON T1.id = T2.respondent_id
       JOIN db_callstore.campaigns T3
         ON T2.campaign_id = T3.id
       JOIN db_callstore.responses T4
         ON T2.id = T4.campaign_respondent_id
       JOIN db_callstore.questions T5
         ON T3.id = T5.campaign_id
       JOIN db_callstore.answers T6
         ON T5.id = T6.questions_id
       JOIN db_callstore.answer_responses T7
         ON T6.id = T7.answer_id AND T4.id = T7.respond_id
       JOIN db_callstore.assigns T8
         ON T2.id = T8.campaign_respondent_id
       WHERE T1.ic_no = ?
         AND T5.id NOT IN (${excluded})
       ORDER BY T5.id`,
      [CALLSTORE_AUDIO_BASE, ic],
    );

    if (!rows?.length) return null;

    const first = rows[0];
    const questionsMap = new Map<number, VoterCallCentreResponse>();

    for (const row of rows) {
      const questionId = Number(row.question_id);
      if (!questionsMap.has(questionId)) {
        questionsMap.set(questionId, {
          questionId,
          questionText: String(row.question_text ?? ""),
          answers: [],
        });
      }
      questionsMap.get(questionId)!.answers.push({
        answerId: Number(row.answer_id),
        answerText: String(row.answer_text ?? ""),
      });
    }

    return {
      audioPath: String(first.audio_path ?? ""),
      attitude: String(first.attitude ?? ""),
      attitudeLabel: sentimentLabel(first.attitude),
      campaignName: String(first.campaign_name ?? ""),
      callStatusId:
        first.call_status_id != null ? Number(first.call_status_id) : null,
      audioDate: formatDisplayDate(first.updated_at),
      responses: [...questionsMap.values()],
    };
  } catch {
    return null;
  }
}

export async function getVoterWhatsappBlast(
  icRaw: string,
): Promise<VoterWhatsappBlast | null> {
  const ic = icRaw.trim();
  if (!isValidIc(ic)) return null;

  const pool = getKnowledgePool();

  try {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT
         r.name,
         r.phone_no,
         s.id,
         CONCAT(?, '/', s.path) AS url,
         s.caption,
         s.sentiment,
         s.screenshot_date,
         c.name AS campaign_name
       FROM db_xblaster.respondents r
       JOIN db_xblaster.campaign_respondent cr
         ON r.id = cr.respondent_id
       JOIN db_xblaster.campaigns c
         ON cr.campaign_id = c.id
       JOIN db_xblaster.screenshots s
         ON cr.id = s.campaign_respondent_id
       WHERE r.no_kp = ?
       ORDER BY s.screenshot_date DESC, s.id DESC`,
      [XBLASTER_STORAGE_BASE, ic],
    );

    if (!rows?.length) return null;

    const campaigns: VoterWhatsappCampaign[] = rows.map((row) => ({
      id: Number(row.id),
      url: String(row.url ?? ""),
      caption: String(row.caption ?? ""),
      sentiment: String(row.sentiment ?? ""),
      sentimentLabel: sentimentLabel(row.sentiment),
      screenshotDate: String(row.screenshot_date ?? "").slice(0, 10),
      screenshotDateDisplay: formatDisplayDate(row.screenshot_date),
      campaignName: String(row.campaign_name ?? ""),
    }));

    return {
      name: String(rows[0].name ?? ""),
      phoneNo: String(rows[0].phone_no ?? ""),
      campaigns,
    };
  } catch {
    return null;
  }
}

/** bdcat modal shell exists; no organization table is wired in legacy backend yet. */
export async function getVoterOrganizations(
  _icRaw: string,
): Promise<VoterOrganization[]> {
  return [];
}

export async function getVoterEnrichment(icRaw: string) {
  const [callCentre, whatsappBlast, organizations] = await Promise.all([
    getVoterCallCentre(icRaw),
    getVoterWhatsappBlast(icRaw),
    getVoterOrganizations(icRaw),
  ]);

  return { callCentre, whatsappBlast, organizations };
}
