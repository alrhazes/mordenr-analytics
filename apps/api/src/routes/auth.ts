import { Hono } from "hono";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../db/system.js";
import { COOKIE_NAME, signToken, verifyToken } from "../lib/auth.js";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const authRoutes = new Hono();

authRoutes.post("/login", async (c) => {
  const body = loginSchema.safeParse(await c.req.json());
  if (!body.success) {
    return c.json({ error: "Invalid credentials payload" }, 400);
  }

  const user = await prisma.user.findUnique({
    where: { email: body.data.email.toLowerCase() },
  });

  if (!user || !(await bcrypt.compare(body.data.password, user.passwordHash))) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

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
    },
  });
});

authRoutes.post("/logout", (c) => {
  c.header(
    "Set-Cookie",
    `${COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  );
  return c.json({ ok: true });
});

authRoutes.get("/me", async (c) => {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const bearer = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  const token = match?.[1] || bearer;

  if (!token) {
    return c.json({ user: null }, 401);
  }

  try {
    const claims = await verifyToken(token);
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user) {
      return c.json({ user: null }, 401);
    }
    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    });
  } catch {
    return c.json({ user: null }, 401);
  }
});
