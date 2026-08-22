import type { Context, Next } from "hono";
import { COOKIE_NAME, verifyToken, type AuthClaims } from "./auth.js";

declare module "hono" {
  interface ContextVariableMap {
    user: AuthClaims;
  }
}

export async function requireAuth(c: Context, next: Next) {
  const cookie = c.req.header("Cookie") || "";
  const match = cookie.match(new RegExp(`${COOKIE_NAME}=([^;]+)`));
  const bearer = c.req.header("Authorization")?.replace(/^Bearer\s+/i, "");
  const token = match?.[1] || bearer;
  if (!token) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  try {
    const claims = await verifyToken(token);
    c.set("user", claims);
    await next();
  } catch {
    return c.json({ error: "Unauthorized" }, 401);
  }
}

export async function requireAdmin(c: Context, next: Next) {
  const user = c.get("user");
  if (!user || user.role !== "ADMIN") {
    return c.json({ error: "Forbidden" }, 403);
  }
  await next();
}
