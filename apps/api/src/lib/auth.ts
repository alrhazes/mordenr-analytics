import { SignJWT, jwtVerify } from "jose";
import type { Role } from "@prisma/client";

export type AuthClaims = {
  sub: string;
  email: string;
  name: string;
  role: Role;
};

function secretKey() {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error("JWT_SECRET must be set (min 16 chars)");
  }
  return new TextEncoder().encode(secret);
}

export async function signToken(claims: AuthClaims) {
  const expiresIn = process.env.JWT_EXPIRES_IN || "7d";
  return new SignJWT({
    email: claims.email,
    name: claims.name,
    role: claims.role,
  })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(claims.sub)
    .setIssuedAt()
    .setExpirationTime(expiresIn)
    .sign(secretKey());
}

export async function verifyToken(token: string): Promise<AuthClaims> {
  const { payload } = await jwtVerify(token, secretKey());
  if (!payload.sub || typeof payload.email !== "string") {
    throw new Error("Invalid token payload");
  }
  return {
    sub: payload.sub,
    email: payload.email,
    name: typeof payload.name === "string" ? payload.name : "",
    role: (payload.role as Role) || "VIEWER",
  };
}

export const COOKIE_NAME = "sentra_token";
