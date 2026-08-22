import mysql from "mysql2/promise";

/** Read pool for legacy bdcat_system tables (e.g. dash_globalsearch). */
let pool: mysql.Pool | null = null;

export function getSystemPool() {
  if (!pool) {
    const url = process.env.DATABASE_URL;
    if (!url) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = mysql.createPool(url);
  }
  return pool;
}
