import { Hono } from "hono";
import { z } from "zod";
import { prisma } from "../db/system.js";

const viewConfigSchema = z.object({
  election: z.string().default("GE15"),
  state: z.string().default(""),
  selectedConstituencyId: z.string().nullable().optional(),
  mapMode: z.enum(["select", "pan", "compare"]).optional(),
  compareIds: z.array(z.string()).max(4).optional(),
});

const createSchema = z.object({
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).optional().nullable(),
  config: viewConfigSchema,
});

const updateSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  description: z.string().trim().max(2000).optional().nullable(),
  config: viewConfigSchema.optional(),
});

export const libraryRoutes = new Hono();

libraryRoutes.get("/views", async (c) => {
  const user = c.get("user");
  const views = await prisma.savedView.findMany({
    where: { userId: user.sub },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      description: true,
      configJson: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return c.json({
    views: views.map(serializeView),
  });
});

libraryRoutes.get("/views/:id", async (c) => {
  const user = c.get("user");
  const view = await prisma.savedView.findFirst({
    where: { id: c.req.param("id"), userId: user.sub },
  });
  if (!view) return c.json({ error: "Not found" }, 404);
  return c.json({ view: serializeView(view) });
});

libraryRoutes.post("/views", async (c) => {
  const user = c.get("user");
  const body = createSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const view = await prisma.savedView.create({
    data: {
      name: body.data.name,
      description: body.data.description || null,
      configJson: JSON.stringify(body.data.config),
      userId: user.sub,
    },
  });

  return c.json({ view: serializeView(view) }, 201);
});

libraryRoutes.patch("/views/:id", async (c) => {
  const user = c.get("user");
  const existing = await prisma.savedView.findFirst({
    where: { id: c.req.param("id"), userId: user.sub },
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  const body = updateSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const view = await prisma.savedView.update({
    where: { id: existing.id },
    data: {
      ...(body.data.name !== undefined ? { name: body.data.name } : {}),
      ...(body.data.description !== undefined
        ? { description: body.data.description }
        : {}),
      ...(body.data.config
        ? { configJson: JSON.stringify(body.data.config) }
        : {}),
    },
  });

  return c.json({ view: serializeView(view) });
});

libraryRoutes.delete("/views/:id", async (c) => {
  const user = c.get("user");
  const existing = await prisma.savedView.findFirst({
    where: { id: c.req.param("id"), userId: user.sub },
  });
  if (!existing) return c.json({ error: "Not found" }, 404);

  await prisma.savedView.delete({ where: { id: existing.id } });
  return c.json({ ok: true });
});

function serializeView(view: {
  id: string;
  name: string;
  description: string | null;
  configJson: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  let config: z.infer<typeof viewConfigSchema> = {
    election: "GE15",
    state: "",
  };
  try {
    config = viewConfigSchema.parse(JSON.parse(view.configJson));
  } catch {
    /* keep default */
  }

  return {
    id: view.id,
    name: view.name,
    description: view.description,
    config,
    createdAt: view.createdAt.toISOString(),
    updatedAt: view.updatedAt.toISOString(),
  };
}
