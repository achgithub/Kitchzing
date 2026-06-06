import { Hono } from "hono";
import type { Env } from "../index";
import { verifyJwt, type DeviceTokenPayload, type SessionTokenPayload } from "../lib/jwt";

const menu = new Hono<{ Bindings: Env }>();

// GET /menu — full menu with categories, items, allergens, options
menu.get("/", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const token = await verifyJwt<DeviceTokenPayload | SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!token) return c.json({ error: "Invalid token" }, 401);

  const restaurantId = token.restaurant_id;

  const [categories, items, itemAllergens, groups, choices, choiceAllergens] = await Promise.all([
    c.env.DB.prepare(
      `SELECT id, name, display_order FROM menu_categories WHERE restaurant_id = ? AND active = 1 ORDER BY display_order ASC`
    ).bind(restaurantId).all<{ id: string; name: string; display_order: number }>(),

    c.env.DB.prepare(
      `SELECT id, category_id, name, description, price, in_stock, display_order FROM menu_items WHERE restaurant_id = ? AND active = 1 ORDER BY display_order ASC`
    ).bind(restaurantId).all<{ id: string; category_id: string; name: string; description: string; price: number; in_stock: number; display_order: number }>(),

    c.env.DB.prepare(
      `SELECT mia.item_id, mia.allergen FROM menu_item_allergens mia
       JOIN menu_items mi ON mi.id = mia.item_id WHERE mi.restaurant_id = ?`
    ).bind(restaurantId).all<{ item_id: string; allergen: string }>(),

    c.env.DB.prepare(
      `SELECT og.id, og.item_id, og.name, og.type, og.required, og.display_order FROM option_groups og
       JOIN menu_items mi ON mi.id = og.item_id WHERE mi.restaurant_id = ? ORDER BY og.display_order ASC`
    ).bind(restaurantId).all<{ id: string; item_id: string; name: string; type: string; required: number; display_order: number }>(),

    c.env.DB.prepare(
      `SELECT oc.id, oc.group_id, oc.name, oc.price_delta, oc.in_stock FROM option_choices oc
       JOIN option_groups og ON og.id = oc.group_id
       JOIN menu_items mi ON mi.id = og.item_id WHERE mi.restaurant_id = ?`
    ).bind(restaurantId).all<{ id: string; group_id: string; name: string; price_delta: number; in_stock: number }>(),

    c.env.DB.prepare(
      `SELECT oca.choice_id, oca.allergen FROM option_choice_allergens oca
       JOIN option_choices oc ON oc.id = oca.choice_id
       JOIN option_groups og ON og.id = oc.group_id
       JOIN menu_items mi ON mi.id = og.item_id WHERE mi.restaurant_id = ?`
    ).bind(restaurantId).all<{ choice_id: string; allergen: string }>(),
  ]);

  // Group allergens by item
  const allergensByItem = new Map<string, string[]>();
  for (const a of itemAllergens.results) {
    const list = allergensByItem.get(a.item_id) ?? [];
    list.push(a.allergen);
    allergensByItem.set(a.item_id, list);
  }

  // Group choice allergens
  const allergensByChoice = new Map<string, string[]>();
  for (const a of choiceAllergens.results) {
    const list = allergensByChoice.get(a.choice_id) ?? [];
    list.push(a.allergen);
    allergensByChoice.set(a.choice_id, list);
  }

  // Group choices by group
  const choicesByGroup = new Map<string, typeof choices.results>();
  for (const ch of choices.results) {
    const list = choicesByGroup.get(ch.group_id) ?? [];
    list.push(ch);
    choicesByGroup.set(ch.group_id, list);
  }

  // Group groups by item
  const groupsByItem = new Map<string, typeof groups.results>();
  for (const g of groups.results) {
    const list = groupsByItem.get(g.item_id) ?? [];
    list.push(g);
    groupsByItem.set(g.item_id, list);
  }

  // Group items by category
  const itemsByCategory = new Map<string, typeof items.results>();
  for (const item of items.results) {
    const list = itemsByCategory.get(item.category_id) ?? [];
    list.push(item);
    itemsByCategory.set(item.category_id, list);
  }

  const result = categories.results.map((cat) => ({
    id: cat.id,
    name: cat.name,
    display_order: cat.display_order,
    items: (itemsByCategory.get(cat.id) ?? []).map((item) => ({
      id: item.id,
      name: item.name,
      description: item.description,
      price: item.price,
      in_stock: item.in_stock === 1,
      display_order: item.display_order,
      allergens: allergensByItem.get(item.id) ?? [],
      option_groups: (groupsByItem.get(item.id) ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        type: g.type,
        required: g.required === 1,
        display_order: g.display_order,
        choices: (choicesByGroup.get(g.id) ?? []).map((ch) => ({
          id: ch.id,
          name: ch.name,
          price_delta: ch.price_delta,
          in_stock: ch.in_stock === 1,
          allergens: allergensByChoice.get(ch.id) ?? [],
        })),
      })),
    })),
  }));

  return c.json({ categories: result });
});

// PATCH /menu/items/:id — toggle in_stock
menu.patch("/items/:id", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifyJwt<SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!session || session.type !== "session") return c.json({ error: "Invalid session token" }, 401);
  if (session.role !== "kitchen" && session.role !== "manager") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ in_stock: boolean }>();
  if (typeof body.in_stock !== "boolean") return c.json({ error: "in_stock (boolean) required" }, 400);

  const item = await c.env.DB.prepare(
    "SELECT id FROM menu_items WHERE id = ? AND restaurant_id = ?"
  ).bind(c.req.param("id"), session.restaurant_id).first<{ id: string }>();

  if (!item) return c.json({ error: "Item not found" }, 404);

  await c.env.DB.prepare("UPDATE menu_items SET in_stock = ? WHERE id = ?")
    .bind(body.in_stock ? 1 : 0, item.id).run();

  return c.json({ ok: true });
});

// PATCH /menu/options/:id — toggle in_stock on an option choice
menu.patch("/options/:id", async (c) => {
  const auth = c.req.header("Authorization");
  if (!auth?.startsWith("Bearer ")) return c.json({ error: "Unauthorized" }, 401);

  const session = await verifyJwt<SessionTokenPayload>(auth.slice(7), c.env.JWT_SECRET);
  if (!session || session.type !== "session") return c.json({ error: "Invalid session token" }, 401);
  if (session.role !== "kitchen" && session.role !== "manager") {
    return c.json({ error: "Forbidden" }, 403);
  }

  const body = await c.req.json<{ in_stock: boolean }>();
  if (typeof body.in_stock !== "boolean") return c.json({ error: "in_stock (boolean) required" }, 400);

  const choice = await c.env.DB.prepare(
    `SELECT oc.id FROM option_choices oc
     JOIN option_groups og ON og.id = oc.group_id
     JOIN menu_items mi ON mi.id = og.item_id
     WHERE oc.id = ? AND mi.restaurant_id = ?`
  ).bind(c.req.param("id"), session.restaurant_id).first<{ id: string }>();

  if (!choice) return c.json({ error: "Option not found" }, 404);

  await c.env.DB.prepare("UPDATE option_choices SET in_stock = ? WHERE id = ?")
    .bind(body.in_stock ? 1 : 0, choice.id).run();

  return c.json({ ok: true });
});

export { menu as menuRoutes };
