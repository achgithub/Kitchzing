import { Hono } from "hono";
import type { Env } from "../index";
import { signJwt } from "../lib/jwt";
import { newId, now } from "../lib/id";

const auth = new Hono<{ Bindings: Env }>();

// POST /auth/register — device registration with restaurant code
auth.post("/register", async (c) => {
  const body = await c.req.json<{
    restaurant_code: string;
    device_name: string;
    one_time_token?: string;
  }>();

  if (!body.restaurant_code || !body.device_name) {
    return c.json({ error: "restaurant_code and device_name are required" }, 400);
  }

  const code = body.restaurant_code.trim().toUpperCase();

  const restaurant = await c.env.DB.prepare(
    "SELECT id, name, active FROM restaurants WHERE code = ?"
  )
    .bind(code)
    .first<{ id: string; name: string; active: number }>();

  if (!restaurant || !restaurant.active) {
    return c.json({ error: "Restaurant not found" }, 404);
  }

  // Validate one-time token if provided (NFC / manual staff onboarding)
  if (body.one_time_token) {
    const token = await c.env.KV.get(`restaurant-${restaurant.id}-ott-${body.one_time_token}`);
    if (!token) {
      return c.json({ error: "Invalid or expired onboarding token" }, 401);
    }
    await c.env.KV.delete(`restaurant-${restaurant.id}-ott-${body.one_time_token}`);
  }

  const deviceId = newId();
  const ts = now();

  await c.env.DB.prepare(
    "INSERT INTO devices (id, restaurant_id, name, last_seen, registered_at, active) VALUES (?, ?, ?, ?, ?, 1)"
  )
    .bind(deviceId, restaurant.id, body.device_name.trim(), ts, ts)
    .run();

  const device_token = await signJwt(
    { type: "device", device_id: deviceId, restaurant_id: restaurant.id },
    c.env.JWT_SECRET
  );

  return c.json({
    device_token,
    restaurant_id: restaurant.id,
    restaurant_name: restaurant.name,
  });
});

// POST /auth/login — PIN validation, returns session token
auth.post("/login", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) {
    return c.json({ error: "device_token required" }, 401);
  }

  const body = await c.req.json<{ pin: string; role?: string }>();
  if (!body.pin) {
    return c.json({ error: "pin is required" }, 400);
  }

  // Resolve device from token (lightweight — no DB read needed yet)
  const { verifyJwt } = await import("../lib/jwt");
  const device = await verifyJwt(auth.slice(7), c.env.JWT_SECRET);
  if (!device || device.type !== "device") {
    return c.json({ error: "Invalid device token" }, 401);
  }

  // Hash the submitted PIN then compare
  const pinHash = await hashPin(body.pin);

  const staff = await c.env.DB.prepare(
    "SELECT id, name, default_role, active FROM staff WHERE restaurant_id = ? AND pin_hash = ?"
  )
    .bind(device.restaurant_id, pinHash)
    .first<{ id: string; name: string; default_role: string; active: number }>();

  if (!staff || !staff.active) {
    return c.json({ error: "Invalid PIN" }, 401);
  }

  const role = body.role ?? staff.default_role;

  // Update device last_seen
  await c.env.DB.prepare("UPDATE devices SET last_seen = ? WHERE id = ?")
    .bind(now(), device.device_id)
    .run();

  const session_token = await signJwt(
    {
      type: "session",
      device_id: device.device_id,
      restaurant_id: device.restaurant_id,
      staff_id: staff.id,
      role,
    },
    c.env.JWT_SECRET
  );

  return c.json({
    session_token,
    staff_id: staff.id,
    name: staff.name,
    role,
  });
});

async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export { auth as authRoutes };
