import { Hono } from "hono";
import type { Env } from "../index";
import { verifyJwt, type DeviceTokenPayload, type SessionTokenPayload } from "../lib/jwt";
import { newId, now } from "../lib/id";
import { getCounters, incrementPlaced, incrementCollected, getPause, isMaintenanceOrders, isMaintenancePolls } from "../lib/kv";
import type { CreateOrderRequest, Order } from "@kitchzing/core";

const orders = new Hono<{ Bindings: Env }>();

// POST /orders
orders.post("/", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifyJwt<SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!session || session.type !== "session") return c.json({ error: "Invalid session token" }, 401);
  if (session.role !== "waiter" && session.role !== "manager") {
    return c.json({ error: "Only waiters can create orders" }, 403);
  }

  if (await isMaintenanceOrders(c.env.KV, session.restaurant_id)) {
    return c.json({ error: "Service temporarily unavailable" }, 503);
  }

  const pause = await getPause(c.env.KV, session.restaurant_id);

  const body = await c.req.json<CreateOrderRequest>();
  if (!body.table_ref || !Array.isArray(body.items) || body.items.length === 0) {
    return c.json({ error: "table_ref and at least one item are required" }, 400);
  }

  const orderId = newId();
  const ts = now();

  await c.env.DB.prepare(
    `INSERT INTO orders (id, restaurant_id, created_by, table_ref, delivery_mode, status, created_at)
     VALUES (?, ?, ?, ?, ?, 'open', ?)`
  )
    .bind(orderId, session.restaurant_id, session.staff_id, body.table_ref, body.delivery_mode ?? "together", ts)
    .run();

  const itemStmts = body.items.flatMap((item) => {
    const itemId = newId();
    const insertItem = c.env.DB.prepare(
      `INSERT INTO order_items (id, order_id, menu_item_id, name, quantity, notes, allergy_note, state, state_updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'new', ?)`
    ).bind(itemId, orderId, item.menu_item_id ?? null, item.name, item.quantity, item.notes ?? "", item.allergy_note ?? "", ts);

    const insertChoices = (item.choices ?? []).map((choice) =>
      c.env.DB.prepare(
        `INSERT INTO order_item_choices (id, order_item_id, choice_id, name, price_delta)
         VALUES (?, ?, ?, ?, ?)`
      ).bind(newId(), itemId, choice.choice_id, choice.name, choice.price_delta)
    );

    return [insertItem, ...insertChoices];
  });

  await c.env.DB.batch(itemStmts);
  await incrementPlaced(c.env.KV, session.restaurant_id);

  return c.json(
    {
      order_id: orderId,
      ...(pause.paused && {
        warning: "kitchen_paused",
        pause_reason: pause.reason,
        pause_reason_text: pause.reason_text,
      }),
    },
    201
  );
});

// GET /orders/active
orders.get("/active", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const token = await verifyJwt<DeviceTokenPayload | SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!token) return c.json({ error: "Invalid token" }, 401);

  const restaurantId = token.restaurant_id;

  if (await isMaintenancePolls(c.env.KV, restaurantId)) {
    return c.json({ error: "Service temporarily unavailable" }, 503);
  }

  // KV counter check — skip D1 entirely if nothing has changed
  const { placed, collected } = await getCounters(c.env.KV, restaurantId);
  if (placed === collected && placed > 0) {
    return new Response(null, { status: 304 });
  }

  const role = token.type === "session" ? token.role : "kitchen";

  let orderRows: { id: string; created_by: string; table_ref: string; delivery_mode: string; status: string; created_at: number }[];

  if (role === "waiter" && token.type === "session") {
    const result = await c.env.DB.prepare(
      `SELECT id, created_by, table_ref, delivery_mode, status, created_at
       FROM orders WHERE restaurant_id = ? AND status = 'open' AND created_by = ?
       ORDER BY created_at ASC`
    ).bind(restaurantId, token.staff_id).all<{ id: string; created_by: string; table_ref: string; delivery_mode: string; status: string; created_at: number }>();
    orderRows = result.results;
  } else if (role === "deliverer") {
    const result = await c.env.DB.prepare(
      `SELECT DISTINCT o.id, o.created_by, o.table_ref, o.delivery_mode, o.status, o.created_at
       FROM orders o JOIN order_items oi ON oi.order_id = o.id
       WHERE o.restaurant_id = ? AND o.status = 'open' AND oi.state = 'ready'
       ORDER BY o.created_at ASC`
    ).bind(restaurantId).all<{ id: string; created_by: string; table_ref: string; delivery_mode: string; status: string; created_at: number }>();
    orderRows = result.results;
  } else {
    const result = await c.env.DB.prepare(
      `SELECT id, created_by, table_ref, delivery_mode, status, created_at
       FROM orders WHERE restaurant_id = ? AND status = 'open'
       ORDER BY created_at ASC`
    ).bind(restaurantId).all<{ id: string; created_by: string; table_ref: string; delivery_mode: string; status: string; created_at: number }>();
    orderRows = result.results;
  }

  if (orderRows.length > 0) {
    await incrementCollected(c.env.KV, restaurantId);
  }

  if (orderRows.length === 0) return c.json({ orders: [] });

  const orderIds = orderRows.map((o) => o.id);
  const placeholders = orderIds.map(() => "?").join(",");

  const itemRows = await c.env.DB.prepare(
    `SELECT id, order_id, menu_item_id, name, quantity, notes, allergy_note, state, state_updated_by, state_updated_at
     FROM order_items WHERE order_id IN (${placeholders}) ORDER BY rowid ASC`
  ).bind(...orderIds).all<{ id: string; order_id: string; menu_item_id: string | null; name: string; quantity: number; notes: string; allergy_note: string; state: string; state_updated_by: string | null; state_updated_at: number | null }>();

  const choiceRows = await c.env.DB.prepare(
    `SELECT oc.id, oc.order_item_id, oc.choice_id, oc.name, oc.price_delta
     FROM order_item_choices oc JOIN order_items oi ON oi.id = oc.order_item_id
     WHERE oi.order_id IN (${placeholders})`
  ).bind(...orderIds).all<{ id: string; order_item_id: string; choice_id: string; name: string; price_delta: number }>();

  const choicesByItem = new Map<string, typeof choiceRows.results>();
  for (const choice of choiceRows.results) {
    const list = choicesByItem.get(choice.order_item_id) ?? [];
    list.push(choice);
    choicesByItem.set(choice.order_item_id, list);
  }

  const itemsByOrder = new Map<string, typeof itemRows.results>();
  for (const item of itemRows.results) {
    const list = itemsByOrder.get(item.order_id) ?? [];
    list.push(item);
    itemsByOrder.set(item.order_id, list);
  }

  const result = orderRows.map((order) => ({
    ...order,
    items: (itemsByOrder.get(order.id) ?? []).map((item) => ({
      ...item,
      choices: choicesByItem.get(item.id) ?? [],
    })),
  }));

  return c.json({ orders: result });
});

// PATCH /orders/items/:id/state
orders.patch("/items/:id/state", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifyJwt<SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!session || session.type !== "session") return c.json({ error: "Invalid session token" }, 401);

  const itemId = c.req.param("id");
  const body = await c.req.json<{ state: string }>();
  if (!body.state) return c.json({ error: "state is required" }, 400);

  const item = await c.env.DB.prepare(
    `SELECT oi.id FROM order_items oi
     JOIN orders o ON o.id = oi.order_id
     WHERE oi.id = ? AND o.restaurant_id = ?`
  ).bind(itemId, session.restaurant_id).first<{ id: string }>();

  if (!item) return c.json({ error: "Item not found" }, 404);

  await c.env.DB.prepare(
    `UPDATE order_items SET state = ?, state_updated_by = ?, state_updated_at = ? WHERE id = ?`
  ).bind(body.state, session.staff_id, now(), itemId).run();

  await incrementPlaced(c.env.KV, session.restaurant_id);

  return c.json({ ok: true });
});

export { orders as orderRoutes };
