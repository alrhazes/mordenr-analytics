import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { Role } from "@prisma/client";
import { prisma } from "../db/system.js";

const roleSchema = z.enum(["ADMIN", "ANALYST", "VIEWER"]);

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().trim().min(1).max(120),
  password: z.string().min(8).max(128),
  role: roleSchema.default("ANALYST"),
});

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: roleSchema.optional(),
  password: z.string().min(8).max(128).optional(),
});

export const adminRoutes = new Hono();

adminRoutes.get("/users", async (c) => {
  const users = await prisma.user.findMany({
    orderBy: [{ role: "asc" }, { name: "asc" }],
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { savedViews: true } },
    },
  });

  return c.json({
    users: users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      savedViewCount: u._count.savedViews,
      createdAt: u.createdAt.toISOString(),
      updatedAt: u.updatedAt.toISOString(),
    })),
  });
});

adminRoutes.post("/users", async (c) => {
  const body = createUserSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const email = body.data.email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return c.json({ error: "Email already in use" }, 409);
  }

  const passwordHash = await bcrypt.hash(body.data.password, 12);
  const user = await prisma.user.create({
    data: {
      email,
      name: body.data.name,
      passwordHash,
      role: body.data.role as Role,
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return c.json(
    {
      user: {
        ...user,
        savedViewCount: 0,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
    },
    201,
  );
});

adminRoutes.patch("/users/:id", async (c) => {
  const id = c.req.param("id");
  const actor = c.get("user");
  const body = updateUserSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "Not found" }, 404);

  // Prevent demoting/removing the last admin
  if (
    existing.role === "ADMIN" &&
    body.data.role &&
    body.data.role !== "ADMIN"
  ) {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return c.json({ error: "Cannot demote the last admin" }, 400);
    }
  }

  if (existing.id === actor.sub && body.data.role && body.data.role !== "ADMIN") {
    return c.json({ error: "Cannot demote your own admin role" }, 400);
  }

  const passwordHash = body.data.password
    ? await bcrypt.hash(body.data.password, 12)
    : undefined;

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(body.data.name !== undefined ? { name: body.data.name } : {}),
      ...(body.data.role !== undefined ? { role: body.data.role as Role } : {}),
      ...(passwordHash ? { passwordHash } : {}),
    },
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      createdAt: true,
      updatedAt: true,
      _count: { select: { savedViews: true } },
    },
  });

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      savedViewCount: user._count.savedViews,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
    },
  });
});

adminRoutes.delete("/users/:id", async (c) => {
  const id = c.req.param("id");
  const actor = c.get("user");

  if (id === actor.sub) {
    return c.json({ error: "Cannot delete your own account" }, 400);
  }

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) return c.json({ error: "Not found" }, 404);

  if (existing.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      return c.json({ error: "Cannot delete the last admin" }, 400);
    }
  }

  await prisma.user.delete({ where: { id } });
  return c.json({ ok: true });
});
