import { Hono } from "hono";
import { prisma } from "../db/system.js";
import {
  knowledgeDatabaseName,
  knowledgeHealth,
} from "../db/knowledge.js";

export const healthRoutes = new Hono();

/** Server + DB poll for header network-speed badge (bdcat poll_speed). */
healthRoutes.get("/speed", async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1 AS ok`;
    return c.json({ status: "success" as const, ts: Date.now() });
  } catch {
    return c.json({ status: "failed" as const, ts: Date.now() }, 503);
  }
});

healthRoutes.get("/", async (c) => {
  let systemOk = false;
  let knowledgeOk = false;
  let knowledgeDb: string | null = null;

  try {
    await prisma.$queryRaw`SELECT 1`;
    systemOk = true;
  } catch {
    systemOk = false;
  }

  try {
    knowledgeOk = await knowledgeHealth();
    knowledgeDb = await knowledgeDatabaseName();
  } catch {
    knowledgeOk = false;
  }

  const ok = systemOk && knowledgeOk;
  return c.json(
    {
      ok,
      systemDb: { ok: systemOk, name: "bdcat_system" },
      knowledgeDb: {
        ok: knowledgeOk,
        name: knowledgeDb,
        mode: "read-only",
      },
    },
    ok ? 200 : 503,
  );
});
