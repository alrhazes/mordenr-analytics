#!/usr/bin/env node
/**
 * Creates the system database on the existing MySQL server.
 * Does NOT touch stt_electorals schema or data.
 */
import { createConnection } from "mysql2/promise";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m && !process.env[m[1].trim()]) {
      process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
    }
  }
}

const host = process.env.MYSQL_HOST || "127.0.0.1";
const port = Number(process.env.MYSQL_PORT || 3306);
const rootPassword = process.env.MYSQL_ROOT_PASSWORD || "bdcat_root";
const appUser = "bdcat";
const appPassword = "bdcat_local";

const conn = await createConnection({
  host,
  port,
  user: "root",
  password: rootPassword,
  multipleStatements: true,
});

await conn.query(`
  CREATE DATABASE IF NOT EXISTS bdcat_system
    CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  GRANT ALL PRIVILEGES ON bdcat_system.* TO '${appUser}'@'%';
  FLUSH PRIVILEGES;
`);

const [rows] = await conn.query(
  `SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME IN ('bdcat_system', 'stt_electorals')`,
);
console.log("Databases present:", rows.map((r) => r.SCHEMA_NAME).join(", "));
console.log("System database ready. stt_electorals left unchanged.");
await conn.end();
