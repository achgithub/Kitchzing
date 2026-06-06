import { Hono } from "hono";
import type { Env } from "../index";
import { signJwt, verifyJwt } from "../lib/jwt";
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

  // Rate-limit: max 10 register attempts per restaurant code per 5-minute window
  const window = Math.floor(Date.now() / 300_000);
  const rlKey = `ratelimit-register-${code}-${window}`;
  const attempts = parseInt((await c.env.KV.get(rlKey)) ?? "0", 10);
  if (attempts >= 10) {
    return c.json({ error: "Too many registration attempts. Try again in a few minutes." }, 429);
  }
  await c.env.KV.put(rlKey, String(attempts + 1), { expirationTtl: 300 });

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
// Role is always taken from staff.default_role — never from the client body
auth.post("/login", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return c.json({ error: "device_token required" }, 401);
  }

  const body = await c.req.json<{ pin: string }>();
  if (!body.pin) {
    return c.json({ error: "pin is required" }, 400);
  }

  const device = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
  if (!device || device.type !== "device") {
    return c.json({ error: "Invalid device token" }, 401);
  }

  // Load all active staff for this restaurant, then verify PIN with constant-time PBKDF2 compare.
  // We don't filter by pin_hash in SQL — that would leak timing and force a global hash space.
  const allStaff = await c.env.DB.prepare(
    "SELECT id, name, pin_hash, default_role, active FROM staff WHERE restaurant_id = ? AND active = 1"
  )
    .bind(device.restaurant_id)
    .all<{ id: string; name: string; pin_hash: string; default_role: string; active: number }>();

  let matched: { id: string; name: string; default_role: string } | null = null;
  for (const staff of allStaff.results) {
    if (await verifyPin(body.pin, staff.pin_hash)) {
      matched = staff;
      break;
    }
  }

  if (!matched) return c.json({ error: "Invalid PIN" }, 401);

  await c.env.DB.prepare("UPDATE devices SET last_seen = ? WHERE id = ?")
    .bind(now(), device.device_id)
    .run();

  const session_token = await signJwt(
    {
      type: "session",
      device_id: device.device_id,
      restaurant_id: device.restaurant_id,
      staff_id: matched.id,
      role: matched.default_role,
    },
    c.env.JWT_SECRET
  );

  return c.json({
    session_token,
    staff_id: matched.id,
    name: matched.name,
    role: matched.default_role,
  });
});

// POST /auth/staff-token — generate a one-time onboarding token (manager only)
// Returns a 6-char token stored in KV for 10 minutes
auth.post("/staff-token", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
  if (!session || session.type !== "session" || session.role !== "manager") {
    return c.json({ error: "Manager access required" }, 403);
  }

  const token = generateOTT();
  await c.env.KV.put(
    `restaurant-${session.restaurant_id}-ott-${token}`,
    "1",
    { expirationTtl: 600 } // 10 minutes
  );

  // Fetch restaurant code for the QR payload
  const restaurant = await c.env.DB.prepare(
    "SELECT code FROM restaurants WHERE id = ?"
  ).bind(session.restaurant_id).first<{ code: string }>();

  return c.json({
    token,
    restaurant_code: restaurant?.code ?? "",
    expires_in: 600,
  });
});

function generateOTT(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  // 12 chars × 5 bits = 60 bits of entropy; combined with KV rate-limiting this is brute-force infeasible
  return Array.from(crypto.getRandomValues(new Uint8Array(12)))
    .map((b) => chars[b % chars.length])
    .join("");
}

// POST /auth/role — re-issue session token with a chosen role
// Waiter/kitchen/deliverer are freely switchable. Manager requires default_role = manager.
auth.post("/role", async (c) => {
  const authHeader = c.req.header("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifyJwt(authHeader.slice(7), c.env.JWT_SECRET);
  if (!session || session.type !== "session") return c.json({ error: "Invalid session token" }, 401);

  const body = await c.req.json<{ role: string }>();
  const OPERATIONAL_ROLES = ["waiter", "kitchen", "deliverer"];
  const ALL_ROLES = [...OPERATIONAL_ROLES, "manager"];
  if (!body.role || !ALL_ROLES.includes(body.role)) {
    return c.json({ error: "Invalid role" }, 400);
  }

  // Manager role requires the staff member's default_role to be manager
  if (body.role === "manager") {
    const staff = await c.env.DB.prepare(
      "SELECT default_role FROM staff WHERE id = ? AND restaurant_id = ? AND active = 1"
    )
      .bind(session.staff_id, session.restaurant_id)
      .first<{ default_role: string }>();

    if (!staff || staff.default_role !== "manager") {
      return c.json({ error: "Manager role not permitted" }, 403);
    }
  }

  const new_token = await signJwt(
    { type: "session", device_id: session.device_id, restaurant_id: session.restaurant_id, staff_id: session.staff_id, role: body.role },
    c.env.JWT_SECRET
  );

  return c.json({ session_token: new_token, role: body.role });
});

// PBKDF2 PIN hashing — stored as base64(salt)$base64(hash)
async function hashPin(pin: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(pin, salt);
  return `${btoa(String.fromCharCode(...salt))}$${btoa(String.fromCharCode(...new Uint8Array(hash)))}`;
}

async function verifyPin(pin: string, stored: string): Promise<boolean> {
  // Support legacy SHA-256 hashes (plain hex, no $ separator) during transition
  if (!stored.includes("$")) {
    const legacy = await sha256Hex(pin);
    return legacy === stored;
  }
  const [saltB64, hashB64] = stored.split("$") as [string, string];
  const salt = Uint8Array.from(atob(saltB64), (c) => c.charCodeAt(0));
  const expectedHash = Uint8Array.from(atob(hashB64), (c) => c.charCodeAt(0));
  const actualHash = new Uint8Array(await pbkdf2(pin, salt));
  if (expectedHash.length !== actualHash.length) return false;
  // Constant-time comparison
  let diff = 0;
  for (let i = 0; i < expectedHash.length; i++) diff |= (expectedHash[i] ?? 0) ^ (actualHash[i] ?? 0);
  return diff === 0;
}

async function pbkdf2(pin: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pin), "PBKDF2", false, ["deriveBits"]);
  return crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
}

async function sha256Hex(input: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export { auth as authRoutes, hashPin };
