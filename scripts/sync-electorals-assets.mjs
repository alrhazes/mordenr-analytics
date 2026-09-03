#!/usr/bin/env node
/**
 * Sync electoral static assets from the sibling dashboard checkout into this repo.
 * Source: ../bdcat/dashboard/electorals/img
 * Target: assets/electorals/img
 */
import { cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.resolve(root, "../bdcat/dashboard/electorals/img");
const target = path.resolve(root, "assets/electorals/img");

if (!existsSync(source)) {
  console.error(`Source not found: ${source}`);
  console.error("Expected a sibling dashboard repo at ../bdcat");
  process.exit(1);
}

mkdirSync(path.dirname(target), { recursive: true });
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });

console.log(`Synced electoral assets → ${target}`);
