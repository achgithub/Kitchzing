import type { Context, Next } from "hono";
import type { Env } from "../index";
import { verifyJwt, type DeviceTokenPayload, type SessionTokenPayload } from "./jwt";

export async function requireDevice(c: Context<{ Bindings: Env }>, next: Next) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyJwt<DeviceTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!payload || payload.type !== "device") {
    return c.json({ error: "Invalid device token" }, 401);
  }
  c.set("device" as never, payload);
  await next();
}

export async function requireSession(c: Context<{ Bindings: Env }>, next: Next) {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized" }, 401);
  }
  const payload = await verifyJwt<SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!payload || payload.type !== "session") {
    return c.json({ error: "Invalid session token" }, 401);
  }
  c.set("session" as never, payload);
  await next();
}
