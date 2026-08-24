import { Hono } from "hono";
import type { RowDataPacket } from "mysql2";
import { z } from "zod";
import { prisma } from "../db/system.js";
import { getKnowledgePool } from "../db/knowledge.js";
import {
  loadCandidateRows,
  loadPartyColors,
  loadPartyChangesForMaps,
  buildBatchInitResult,
  runBatchSimulation,
  computePartyTotals,
  batchInitSchema,
  batchRunSchema,
  individualInitSchema,
  individualRunSchema,
  individualMatchesSchema,
  individualFromBatchSchema,
  simulationSaveSchema,
  aiAnalyzeSchema,
  partyConfigOverrideSchema,
} from "../lib/simulation/index.js";
import type { SimulationAreaType, SimulationScopeArea } from "../lib/simulation/types.js";

export const simulationRoutes = new Hono();

function scopeTitle(area: SimulationScopeArea, areaName?: string | null): string {
  if (area === "NEGERI" && areaName) {
    return `SELURUH NEGERI ${areaName.toUpperCase()}`;
  }
  if (area === "PARLIMEN" && areaName) return areaName.toUpperCase();
  if (area === "DUN" && areaName) return areaName.toUpperCase();
  return "SELURUH MALAYSIA";
}

function applyTovToGainloss(
  gainloss: Array<{ group: string; pct: number }>,
  tovPct: number,
): Array<{ group: string; pct: number }> {
  if (!gainloss.length || tovPct === 0) return gainloss;
  return gainloss.map((g) => ({
    ...g,
    pct: Number(g.pct) + tovPct,
  }));
}

async function runIndividualSimulation(body: {
  areaType: SimulationAreaType;
  mapCode: string;
  tovPct?: number;
  gainloss?: Array<{ group: string; pct: number }>;
  transfer?: Array<{ from: string; to: string; pct: number }>;
  grouping?: { label: string; members: string[] } | null;
}) {
  const pool = getKnowledgePool();
  const rows = await loadCandidateRows(pool, {
    areaType: body.areaType,
    scopeArea: body.areaType === "dun" ? "DUN" : "PARLIMEN",
    seatCodes: [body.mapCode],
  });

  const filtered =
    body.areaType === "dun"
      ? rows.filter((r) => r.map_code === body.mapCode)
      : rows.filter((r) => r.parliament_code === body.mapCode);

  const partyChangesRaw = await loadPartyChangesForMaps(pool, [body.mapCode]);
  const partyChangesByMap: Record<
    string,
    import("../lib/simulation/types.js").PartyChangeByGroup
  > = {};
  for (const [code, val] of Object.entries(partyChangesRaw)) {
    partyChangesByMap[code] = val.by_group;
  }

  const colorLookup = await loadPartyColors(pool);
  const gainloss = applyTovToGainloss(
    body.gainloss ?? [],
    body.tovPct ?? 0,
  );

  const result = runBatchSimulation({
    areaType: body.areaType,
    rows: filtered,
    seatCodes: [body.mapCode],
    gainloss,
    transfer: body.transfer ?? [],
    grouping: body.grouping ?? null,
    partyChangesByMap,
    colorLookup,
  });

  const totals = computePartyTotals(result.parliament);
  return {
    ...result,
    mapCode: body.mapCode,
    meta: {
      ...result.meta,
      partyTotals: totals,
      all_parties: result.meta.all_parties,
      scopeTitle: body.mapCode,
    },
  };
}

async function initIndividualSimulation(body: {
  areaType: SimulationAreaType;
  mapCode: string;
}) {
  const pool = getKnowledgePool();
  const rows = await loadCandidateRows(pool, {
    areaType: body.areaType,
    scopeArea: body.areaType === "dun" ? "DUN" : "PARLIMEN",
    seatCodes: [body.mapCode],
  });

  const filtered =
    body.areaType === "dun"
      ? rows.filter((r) => r.map_code === body.mapCode)
      : rows.filter((r) => r.parliament_code === body.mapCode);

  const colorLookup = await loadPartyColors(pool);
  const result = buildBatchInitResult(body.areaType, filtered, colorLookup);
  const totals = computePartyTotals(result.parliament);
  const seat = result.parliament[0];
  const scopeTitleLabel = seat
    ? `${seat.parliament_code} ${seat.parliament_name}`
    : body.mapCode;

  return {
    ...result,
    mapCode: body.mapCode,
    meta: {
      ...result.meta,
      partyTotals: totals,
      scopeTitle: scopeTitleLabel,
    },
  };
}

simulationRoutes.get("/seats", async (c) => {
  const areaType = (c.req.query("areaType") || "parlimen") as SimulationAreaType;
  const scopeArea = (c.req.query("scopeArea") || "NEGARA") as SimulationScopeArea;
  const scopeName = c.req.query("scopeName")?.trim() || "";
  const pool = getKnowledgePool();

  if (areaType === "parlimen") {
    const where: string[] = ["parliament_election = 'GE15'"];
    const params: string[] = [];
    if (scopeArea === "NEGERI" && scopeName) {
      where.push("LOWER(parliament_statename) = ?");
      params.push(scopeName.toLowerCase());
    }
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT parliament_code AS code, parliament_name AS name, parliament_statename AS state
       FROM electorals_parliament
       WHERE ${where.join(" AND ")}
       ORDER BY parliament_statename, parliament_code`,
      params,
    );
    return c.json({
      areaType,
      scopeArea,
      scopeName: scopeName || null,
      scopeTitle: scopeTitle(scopeArea, scopeName),
      seats: (rows || []).map((r) => ({
        code: String(r.code),
        name: String(r.name),
        state: String(r.state || "").toUpperCase(),
        label: `${r.code} ${r.name}`,
      })),
    });
  }

  const where: string[] = ["1=1"];
  const params: string[] = [];
  if (scopeArea === "NEGERI" && scopeName) {
    where.push("LOWER(dun_statename) = ?");
    params.push(scopeName.toLowerCase());
  }
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT dun_mapcode AS code, dun_name AS name, dun_statename AS state, parliament_code
     FROM electorals_dun
     WHERE ${where.join(" AND ")}
     ORDER BY dun_statename, dun_mapcode`,
    params,
  );
  return c.json({
    areaType,
    scopeArea,
    scopeName: scopeName || null,
    scopeTitle: scopeTitle(scopeArea, scopeName),
    seats: (rows || []).map((r) => {
      const code = String(r.code);
      const dunShort = code.slice(-3);
      return {
        code,
        name: String(r.name),
        state: String(r.state || "").toUpperCase(),
        parliamentCode: String(r.parliament_code || ""),
        label: `${dunShort} ${r.name}`,
      };
    }),
  });
});

async function handleBatchInit(body: z.infer<typeof batchInitSchema>) {
  const pool = getKnowledgePool();
  const seatCodes = body.seatCodes.length ? body.seatCodes : undefined;
  const rows = await loadCandidateRows(pool, {
    areaType: body.areaType,
    scopeArea: body.scopeArea,
    scopeName: body.scopeName,
    seatCodes,
  });
  const colorLookup = await loadPartyColors(pool);
  const result = buildBatchInitResult(body.areaType, rows, colorLookup);
  const totals = computePartyTotals(result.parliament);

  return {
    ...result,
    meta: {
      ...result.meta,
      partyTotals: totals,
      scopeTitle: scopeTitle(body.scopeArea, body.scopeName),
    },
  };
}

simulationRoutes.post("/batch/init", async (c) => {
  const body = batchInitSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }
  const data = await handleBatchInit(body.data);
  return c.json(data);
});

simulationRoutes.post("/batch/run", async (c) => {
  const body = batchRunSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const pool = getKnowledgePool();
  const seatCodes = body.data.seatCodes;
  if (!seatCodes.length) {
    return c.json({ error: "No seats selected" }, 400);
  }

  const rows = await loadCandidateRows(pool, {
    areaType: body.data.areaType,
    scopeArea: body.data.scopeArea,
    scopeName: body.data.scopeName,
    seatCodes,
  });

  const partyChangesRaw = await loadPartyChangesForMaps(pool, seatCodes);
  const partyChangesByMap: Record<string, import("../lib/simulation/types.js").PartyChangeByGroup> =
    {};
  for (const [code, val] of Object.entries(partyChangesRaw)) {
    partyChangesByMap[code] = val.by_group;
  }

  if (body.data.partyChanges?.length) {
    const { partyChangesToByGroup } = await import("../lib/simulation/party-change.js");
    for (const change of body.data.partyChanges) {
      const code = change.mapCode;
      const existing = partyChangesByMap[code] ?? {};
      partyChangesByMap[code] = partyChangesToByGroup([
        ...(partyChangesRaw[code]?.rows ?? []),
        {
          candidate_id: 0,
          candidate_group: change.candidateGroup,
          historical_party: change.historicalParty,
          simulation_party: change.simulationParty,
        },
      ]);
      Object.assign(partyChangesByMap[code], existing, partyChangesByMap[code]);
    }
  }

  const colorLookup = await loadPartyColors(pool);
  const result = runBatchSimulation({
    areaType: body.data.areaType,
    rows,
    seatCodes,
    gainloss: body.data.gainloss,
    transfer: body.data.transfer,
    grouping: body.data.grouping ?? null,
    individualOverrides: body.data.individualOverrides?.map((o) => ({
      mapCode: o.mapCode,
      gainloss: o.gainloss,
      transfer: o.transfer,
      grouping: o.grouping ?? null,
      simName: o.simName,
    })),
    partyChangesByMap,
    colorLookup,
  });

  return c.json({
    ...result,
    meta: {
      ...result.meta,
      scopeTitle: scopeTitle(body.data.scopeArea, body.data.scopeName),
    },
  });
});

simulationRoutes.post("/individual/init", async (c) => {
  const body = individualInitSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }
  return c.json(await initIndividualSimulation(body.data));
});

simulationRoutes.post("/individual/run", async (c) => {
  const body = individualRunSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }
  return c.json(await runIndividualSimulation(body.data));
});

/** Legacy aliases — Auto UI is individual */
simulationRoutes.post("/auto/init", async (c) => {
  const body = individualInitSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }
  return c.json(await initIndividualSimulation(body.data));
});

simulationRoutes.post("/auto/run", async (c) => {
  const body = individualRunSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }
  return c.json(await runIndividualSimulation(body.data));
});

simulationRoutes.post("/individual/matches", async (c) => {
  const body = individualMatchesSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const user = c.get("user");
  const codes = [...new Set(body.data.seatCodes.map((c) => c.trim()).filter(Boolean))];
  if (!codes.length) return c.json({ matches: [] });

  const saves = await prisma.simulation.findMany({
    where: {
      userId: user.sub,
      mode: "INDIVIDUAL",
      areaType: body.data.areaType,
      mapCode: { in: codes },
    },
    orderBy: { lastActivity: "desc" },
  });

  // Latest save per mapCode
  const byCode = new Map<string, (typeof saves)[0]>();
  for (const save of saves) {
    if (!save.mapCode || byCode.has(save.mapCode)) continue;
    byCode.set(save.mapCode, save);
  }

  return c.json({
    matches: [...byCode.values()].map((save) => ({
      ...serializeSimulation(save),
      mapCode: save.mapCode,
    })),
  });
});

simulationRoutes.post("/individual/from-batch", async (c) => {
  const body = individualFromBatchSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const user = c.get("user");
  const created = [];

  for (const seat of body.data.seats) {
    const mapCode = seat.mapCode.trim();
    if (!mapCode) continue;
    const save = await prisma.simulation.create({
      data: {
        userId: user.sub,
        name: seat.simName?.trim() || `Individu ${mapCode}`,
        mode: "INDIVIDUAL",
        area: body.data.areaType === "dun" ? "DUN" : "PARLIMEN",
        areaName: null,
        areaType: body.data.areaType,
        mapCode,
        selectedCodes: JSON.stringify([mapCode]),
        gainlossJson: JSON.stringify(body.data.gainloss),
        transferJson: JSON.stringify(body.data.transfer),
        groupingJson: body.data.grouping
          ? JSON.stringify(body.data.grouping)
          : null,
      },
    });
    created.push(serializeSimulation(save));
  }

  return c.json({ saves: created }, 201);
});

simulationRoutes.get("/party-config", async (c) => {
  const overridesRaw = c.req.query("overrides");
  let overrides: z.infer<typeof partyConfigOverrideSchema> = {};
  if (overridesRaw) {
    try {
      overrides = partyConfigOverrideSchema.parse(JSON.parse(overridesRaw));
    } catch {
      overrides = {};
    }
  }

  const areaType = (c.req.query("areaType") || "parlimen") as SimulationAreaType;
  const pool = getKnowledgePool();
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT party_name, party_gov, party_gov_dun, party_color
     FROM electorals_party
     WHERE TRIM(party_name) <> ''
     ORDER BY party_name`,
  );

  const parties = (rows || []).map((r) => {
    const name = String(r.party_name);
    const baseGov =
      areaType === "dun" ? Boolean(r.party_gov_dun) : Boolean(r.party_gov);
    const override = overrides[name];
    const effectiveGov = override ? override.party_gov : baseGov;
    return {
      party_name: name,
      party_gov: Boolean(r.party_gov),
      party_gov_dun: Boolean(r.party_gov_dun),
      party_color: String(r.party_color || "#999999"),
      effective_gov: effectiveGov,
      overridden: Boolean(override),
    };
  });

  return c.json({ areaType, parties });
});

const saveUpdateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  mode: z.enum(["BATCH", "INDIVIDUAL"]).optional(),
  area: z.enum(["NEGARA", "NEGERI", "PARLIMEN", "DUN"]).optional(),
  areaName: z.string().nullable().optional(),
  areaType: z.enum(["parlimen", "dun"]).optional(),
  mapCode: z.string().nullable().optional(),
  selectedCodes: z.array(z.string()).optional(),
  gainloss: z.array(z.object({ group: z.string(), pct: z.coerce.number() })).optional(),
  transfer: z
    .array(z.object({ from: z.string(), to: z.string(), pct: z.coerce.number() }))
    .optional(),
  grouping: z
    .object({ label: z.string(), members: z.array(z.string()) })
    .nullable()
    .optional(),
  partyConfig: partyConfigOverrideSchema.optional(),
  partyChanges: z.array(z.unknown()).optional(),
  resultMeta: z.record(z.string(), z.unknown()).optional(),
  chart: z
    .object({
      labels: z.array(z.string()),
      values: z.array(z.number()),
      colors: z.array(z.string()),
    })
    .nullable()
    .optional(),
});

function serializeSimulation(record: {
  id: string;
  name: string;
  mode: string;
  area: string;
  areaName: string | null;
  areaType: string;
  mapCode: string | null;
  selectedCodes: string;
  gainlossJson: string;
  transferJson: string;
  groupingJson: string | null;
  partyConfigJson: string | null;
  partyChangeJson: string | null;
  resultJson: string | null;
  chartJson: string | null;
  lastActivity: Date;
  createdAt: Date;
  updatedAt: Date;
}) {
  const parseJson = <T>(raw: string | null, fallback: T): T => {
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  return {
    id: record.id,
    name: record.name,
    mode: record.mode,
    area: record.area,
    areaName: record.areaName,
    areaType: record.areaType,
    mapCode: record.mapCode,
    selectedCodes: parseJson<string[]>(record.selectedCodes, []),
    gainloss: parseJson(record.gainlossJson, []),
    transfer: parseJson(record.transferJson, []),
    grouping: parseJson(record.groupingJson, null),
    partyConfig: parseJson(record.partyConfigJson, {}),
    partyChanges: parseJson(record.partyChangeJson, []),
    resultMeta: parseJson(record.resultJson, {}),
    chart: parseJson(record.chartJson, null),
    lastActivity: record.lastActivity.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString(),
  };
}

simulationRoutes.get("/saves", async (c) => {
  const user = c.get("user");
  const mode = c.req.query("mode");
  const mapCode = c.req.query("mapCode")?.trim() || "";
  // Treat legacy AUTO as INDIVIDUAL when filtering
  const modeFilter =
    mode === "INDIVIDUAL"
      ? { mode: { in: ["INDIVIDUAL" as const, "AUTO" as const] } }
      : mode === "BATCH"
        ? { mode: "BATCH" as const }
        : mode
          ? { mode: mode as "BATCH" | "AUTO" | "INDIVIDUAL" }
          : {};

  const saves = await prisma.simulation.findMany({
    where: {
      userId: user.sub,
      ...modeFilter,
      ...(mapCode ? { mapCode } : {}),
    },
    orderBy: { lastActivity: "desc" },
  });
  return c.json({
    saves: saves.map((s) => {
      const serialized = serializeSimulation(s);
      // Normalize AUTO → INDIVIDUAL for clients
      if (serialized.mode === "AUTO") {
        return { ...serialized, mode: "INDIVIDUAL" as const };
      }
      return serialized;
    }),
  });
});

simulationRoutes.get("/saves/:id", async (c) => {
  const user = c.get("user");
  const save = await prisma.simulation.findFirst({
    where: { id: c.req.param("id"), userId: user.sub },
  });
  if (!save) return c.json({ error: "Not found" }, 404);
  return c.json({ save: serializeSimulation(save) });
});

simulationRoutes.post("/saves", async (c) => {
  const user = c.get("user");
  const body = simulationSaveSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const save = await prisma.simulation.create({
    data: {
      userId: user.sub,
      name: body.data.name,
      mode: body.data.mode,
      area: body.data.area,
      areaName: body.data.areaName ?? null,
      areaType: body.data.areaType,
      mapCode: body.data.mapCode ?? null,
      selectedCodes: JSON.stringify(body.data.selectedCodes),
      gainlossJson: JSON.stringify(body.data.gainloss),
      transferJson: JSON.stringify(body.data.transfer),
      groupingJson: body.data.grouping
        ? JSON.stringify(body.data.grouping)
        : null,
      partyConfigJson: body.data.partyConfig
        ? JSON.stringify(body.data.partyConfig)
        : null,
      partyChangeJson: body.data.partyChanges
        ? JSON.stringify(body.data.partyChanges)
        : null,
      resultJson: body.data.resultMeta
        ? JSON.stringify(body.data.resultMeta)
        : null,
      chartJson: body.data.chart ? JSON.stringify(body.data.chart) : null,
    },
  });

  return c.json({ save: serializeSimulation(save) }, 201);
});

simulationRoutes.patch("/saves/:id", async (c) => {
  const user = c.get("user");
  const existing = await prisma.simulation.findFirst({
    where: { id: c.req.param("id"), userId: user.sub },
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = saveUpdateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const d = body.data;
  const save = await prisma.simulation.update({
    where: { id: existing.id },
    data: {
      ...(d.name !== undefined ? { name: d.name } : {}),
      ...(d.mode !== undefined ? { mode: d.mode } : {}),
      ...(d.area !== undefined ? { area: d.area } : {}),
      ...(d.areaName !== undefined ? { areaName: d.areaName } : {}),
      ...(d.areaType !== undefined ? { areaType: d.areaType } : {}),
      ...(d.mapCode !== undefined ? { mapCode: d.mapCode } : {}),
      ...(d.selectedCodes !== undefined
        ? { selectedCodes: JSON.stringify(d.selectedCodes) }
        : {}),
      ...(d.gainloss !== undefined
        ? { gainlossJson: JSON.stringify(d.gainloss) }
        : {}),
      ...(d.transfer !== undefined
        ? { transferJson: JSON.stringify(d.transfer) }
        : {}),
      ...(d.grouping !== undefined
        ? { groupingJson: d.grouping ? JSON.stringify(d.grouping) : null }
        : {}),
      ...(d.partyConfig !== undefined
        ? { partyConfigJson: JSON.stringify(d.partyConfig) }
        : {}),
      ...(d.partyChanges !== undefined
        ? { partyChangeJson: JSON.stringify(d.partyChanges) }
        : {}),
      ...(d.resultMeta !== undefined
        ? { resultJson: JSON.stringify(d.resultMeta) }
        : {}),
      ...(d.chart !== undefined
        ? { chartJson: d.chart ? JSON.stringify(d.chart) : null }
        : {}),
      lastActivity: new Date(),
    },
  });

  return c.json({ save: serializeSimulation(save) });
});

simulationRoutes.delete("/saves/:id", async (c) => {
  const user = c.get("user");
  const existing = await prisma.simulation.findFirst({
    where: { id: c.req.param("id"), userId: user.sub },
  });
  if (!existing) return c.json({ error: "Not found" }, 404);
  await prisma.simulation.delete({ where: { id: existing.id } });
  return c.json({ ok: true });
});

simulationRoutes.post("/ai/analyze", async (c) => {
  const body = aiAnalyzeSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return c.json(
      {
        success: false,
        reply:
          "AI analysis is not configured. Set OPENAI_API_KEY on the API server.",
      },
      503,
    );
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const context = body.data.simulationContext ?? {};

  const systemPrompt = `You are an electoral analyst for Malaysian parliament and state assembly simulations. Answer in Malay unless asked otherwise. Be concise and data-driven.`;

  const userContent = [
    `Soalan: ${body.data.question}`,
    "",
    "Konteks simulasi:",
    JSON.stringify(context, null, 2),
  ].join("\n");

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userContent },
      ],
      temperature: 0.4,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    return c.json({ success: false, reply: `AI request failed: ${errText}` }, 502);
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const reply = data.choices?.[0]?.message?.content?.trim() || "Tiada jawapan.";

  return c.json({ success: true, reply });
});
