import { Hono } from "hono";
import type { Env } from "../index";
import { verifyJwt, type DeviceTokenPayload, type SessionTokenPayload } from "../lib/jwt";
import { getConfig, setConfig, getPause, setPause } from "../lib/kv";
import { now } from "../lib/id";

const config = new Hono<{ Bindings: Env }>();

// GET /config — restaurant config from KV
config.get("/", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const token = await verifyJwt<DeviceTokenPayload | SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!token) return c.json({ error: "Invalid token" }, 401);

  const [cfg, pause] = await Promise.all([
    getConfig(c.env.KV, token.restaurant_id),
    getPause(c.env.KV, token.restaurant_id),
  ]);

  return c.json({ config: cfg, pause });
});

// PATCH /config — update restaurant config (manager only)
config.patch("/", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifyJwt<SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!session || session.type !== "session" || session.role !== "manager") {
    return c.json({ error: "Manager access required" }, 403);
  }

  const body = await c.req.json();
  await setConfig(c.env.KV, session.restaurant_id, body);
  return c.json({ ok: true });
});

// POST /config/pause — kitchen pause
config.post("/pause", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifyJwt<SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!session || session.type !== "session") return c.json({ error: "Invalid session token" }, 401);
  if (session.role !== "kitchen" && session.role !== "manager") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{
    reason: "too_busy" | "closed_early" | "other";
    reason_text?: string;
    resume_in_minutes?: number;
  }>();

  const ts = now();
  const state = {
    paused: true,
    reason: body.reason,
    reason_text: body.reason_text ?? null,
    paused_by: session.staff_id,
    paused_at: ts,
    resume_at: body.resume_in_minutes ? ts + body.resume_in_minutes * 60 : null,
  };

  await setPause(c.env.KV, session.restaurant_id, state);
  return c.json({ ok: true, pause: state });
});

// DELETE /config/pause — resume kitchen
config.delete("/pause", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifyJwt<SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!session || session.type !== "session") return c.json({ error: "Invalid session token" }, 401);
  if (session.role !== "kitchen" && session.role !== "manager") {
    return c.json({ error: "Forbidden" }, 403);
  }

  await setPause(c.env.KV, session.restaurant_id, {
    paused: false, reason: null, reason_text: null, paused_by: null, paused_at: null, resume_at: null,
  });

  return c.json({ ok: true });
});

export { config as configRoutes };
