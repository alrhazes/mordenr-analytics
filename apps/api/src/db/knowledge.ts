import mysql from "mysql2/promise";

/**
 * Read-only pool for stt_electorals.
 * Never run migrations or writes against this database.
 */
let pool: mysql.Pool | null = null;

export function getKnowledgePool() {
  if (!pool) {
    const url = process.env.KNOWLEDGE_DATABASE_URL;
    if (!url) {
      throw new Error("KNOWLEDGE_DATABASE_URL is not set");
    }
    pool = mysql.createPool(url);
  }
  return pool;
}

export async function knowledgeHealth() {
  const p = getKnowledgePool();
  const [rows] = await p.query("SELECT 1 AS ok FROM DUAL");
  return Array.isArray(rows) && rows.length > 0;
}

export async function knowledgeDatabaseName() {
  const p = getKnowledgePool();
  const [rows] = await p.query("SELECT DATABASE() AS db");
  if (!Array.isArray(rows) || !rows[0]) return null;
  const row = rows[0] as { db?: string };
  return row.db ?? null;
}
