import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db/system.js";
import { COOKIE_NAME, signToken } from "../lib/auth.js";

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(120),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const profileRoutes = new Hono();

profileRoutes.get("/", async (c) => {
  const claims = c.get("user");
  const user = await prisma.user.findUnique({
    where: { id: claims.sub },
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
  if (!user) return c.json({ error: "Not found" }, 404);

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

profileRoutes.patch("/", async (c) => {
  const claims = c.get("user");
  const body = updateProfileSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const user = await prisma.user.update({
    where: { id: claims.sub },
    data: { name: body.data.name },
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

  // Refresh cookie claims so shell shows new name
  const token = await signToken({
    sub: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
  });
  const isProd = process.env.NODE_ENV === "production";
  c.header(
    "Set-Cookie",
    `${COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}${isProd ? "; Secure" : ""}`,
  );

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

profileRoutes.post("/password", async (c) => {
  const claims = c.get("user");
  const body = changePasswordSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid payload", details: body.error.flatten() }, 400);
  }

  const user = await prisma.user.findUnique({ where: { id: claims.sub } });
  if (!user) return c.json({ error: "Not found" }, 404);

  const ok = await bcrypt.compare(body.data.currentPassword, user.passwordHash);
  if (!ok) {
    return c.json({ error: "Current password is incorrect" }, 400);
  }

  const passwordHash = await bcrypt.hash(body.data.newPassword, 12);
  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash },
  });

  return c.json({ ok: true });
});
