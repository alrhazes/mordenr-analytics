import { z } from "zod";

export const areaTypeSchema = z.enum(["parlimen", "dun"]);
export const scopeAreaSchema = z.enum(["NEGARA", "NEGERI", "PARLIMEN", "DUN"]);

export const gainLossSchema = z.object({
  group: z.string(),
  pct: z.coerce.number(),
});

export const transferSchema = z.object({
  from: z.string(),
  to: z.string(),
  pct: z.coerce.number(),
});

export const groupingSchema = z.object({
  label: z.string(),
  members: z.array(z.string()),
});

export const batchInitSchema = z.object({
  areaType: areaTypeSchema,
  scopeArea: scopeAreaSchema.default("NEGARA"),
  scopeName: z.string().optional(),
  seatCodes: z.array(z.string()).default([]),
});

export const batchRunSchema = batchInitSchema.extend({
  gainloss: z.array(gainLossSchema).default([]),
  transfer: z.array(transferSchema).default([]),
  grouping: groupingSchema.nullable().optional(),
  individualOverrides: z
    .array(
      z.object({
        mapCode: z.string(),
        gainloss: z.array(gainLossSchema).default([]),
        transfer: z.array(transferSchema).default([]),
        grouping: groupingSchema.nullable().optional(),
        simName: z.string().optional(),
      }),
    )
    .optional(),
  partyChanges: z
    .array(
      z.object({
        mapCode: z.string(),
        candidateGroup: z.string(),
        historicalParty: z.string(),
        simulationParty: z.string(),
      }),
    )
    .optional(),
});

/** Single-seat individual (legacy "Auto") init/run */
export const individualInitSchema = z.object({
  areaType: areaTypeSchema,
  mapCode: z.string().min(1),
});

export const individualRunSchema = individualInitSchema.extend({
  tovPct: z.coerce.number().default(0),
  gainloss: z.array(gainLossSchema).default([]),
  transfer: z.array(transferSchema).default([]),
  grouping: groupingSchema.nullable().optional(),
});

/** @deprecated use individualInitSchema */
export const autoInitSchema = individualInitSchema;
/** @deprecated use individualRunSchema */
export const autoRunSchema = individualRunSchema;

export const individualMatchesSchema = z.object({
  areaType: areaTypeSchema,
  seatCodes: z.array(z.string()).min(1),
});

export const individualFromBatchSchema = z.object({
  areaType: areaTypeSchema,
  seats: z.array(
    z.object({
      mapCode: z.string(),
      simName: z.string().optional(),
    }),
  ),
  gainloss: z.array(gainLossSchema).default([]),
  transfer: z.array(transferSchema).default([]),
  grouping: groupingSchema.nullable().optional(),
});

export const partyConfigOverrideSchema = z.record(
  z.string(),
  z.object({ party_gov: z.boolean() }),
);

export const simulationSaveSchema = z
  .object({
    name: z.string().trim().min(1).max(120),
    mode: z.enum(["BATCH", "INDIVIDUAL"]).default("BATCH"),
    area: scopeAreaSchema.default("NEGARA"),
    areaName: z.string().nullable().optional(),
    areaType: areaTypeSchema,
    mapCode: z.string().nullable().optional(),
    selectedCodes: z.array(z.string()).default([]),
    gainloss: z.array(gainLossSchema).default([]),
    transfer: z.array(transferSchema).default([]),
    grouping: groupingSchema.nullable().optional(),
    partyConfig: partyConfigOverrideSchema.optional(),
    partyChanges: z.array(z.unknown()).optional(),
    resultMeta: z.record(z.string(), z.unknown()).optional(),
    chart: z
      .object({
        labels: z.array(z.string()),
        values: z.array(z.number()),
        colors: z.array(z.string()),
      })
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (data.mode === "INDIVIDUAL" && !data.mapCode?.trim()) {
      ctx.addIssue({
        code: "custom",
        message: "mapCode required for INDIVIDUAL saves",
        path: ["mapCode"],
      });
    }
    if (data.mode === "BATCH" && (!data.selectedCodes || data.selectedCodes.length === 0)) {
      ctx.addIssue({
        code: "custom",
        message: "selectedCodes required for BATCH saves",
        path: ["selectedCodes"],
      });
    }
  });

export const aiAnalyzeSchema = z.object({
  question: z.string().trim().min(1),
  simulationContext: z.record(z.string(), z.unknown()).optional(),
});
