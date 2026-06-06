import type { Env } from "../index";

export type KVContext = Pick<Env, "KV">;

// Poll counter helpers
export async function getCounters(kv: KVNamespace, restaurantId: string) {
  const [placed, collected] = await Promise.all([
    kv.get(`restaurant-${restaurantId}-orders_placed`),
    kv.get(`restaurant-${restaurantId}-orders_collected`),
  ]);
  return {
    placed: parseInt(placed ?? "0", 10),
    collected: parseInt(collected ?? "0", 10),
  };
}

export async function incrementPlaced(kv: KVNamespace, restaurantId: string) {
  const key = `restaurant-${restaurantId}-orders_placed`;
  const current = parseInt((await kv.get(key)) ?? "0", 10);
  await kv.put(key, String(current + 1));
}

export async function incrementCollected(kv: KVNamespace, restaurantId: string) {
  const key = `restaurant-${restaurantId}-orders_collected`;
  const current = parseInt((await kv.get(key)) ?? "0", 10);
  await kv.put(key, String(current + 1));
}

// Restaurant config
export interface RestaurantConfig {
  open_time: string;
  close_time: string;
  timezone: string;
  delivery_mode: "together" | "as_when";
  order_states: string[];
}

const DEFAULT_CONFIG: RestaurantConfig = {
  open_time: "08:00",
  close_time: "23:00",
  timezone: "Europe/London",
  delivery_mode: "together",
  order_states: ["new", "preparing", "ready", "delivered"],
};

export async function getConfig(kv: KVNamespace, restaurantId: string): Promise<RestaurantConfig> {
  const raw = await kv.get(`restaurant-${restaurantId}-config`);
  if (!raw) return DEFAULT_CONFIG;
  return { ...DEFAULT_CONFIG, ...JSON.parse(raw) } as RestaurantConfig;
}

export async function setConfig(kv: KVNamespace, restaurantId: string, config: Partial<RestaurantConfig>) {
  const current = await getConfig(kv, restaurantId);
  await kv.put(`restaurant-${restaurantId}-config`, JSON.stringify({ ...current, ...config }));
}

// Kitchen pause
export interface PauseState {
  paused: boolean;
  reason: string | null;
  reason_text: string | null;
  paused_by: string | null;
  paused_at: number | null;
  resume_at: number | null;
}

export async function getPause(kv: KVNamespace, restaurantId: string): Promise<PauseState> {
  const raw = await kv.get(`restaurant-${restaurantId}-pause`);
  if (!raw) return { paused: false, reason: null, reason_text: null, paused_by: null, paused_at: null, resume_at: null };
  return JSON.parse(raw) as PauseState;
}

export async function setPause(kv: KVNamespace, restaurantId: string, state: PauseState) {
  await kv.put(`restaurant-${restaurantId}-pause`, JSON.stringify(state));
}

// Maintenance flags
export async function isMaintenanceOrders(kv: KVNamespace, restaurantId: string) {
  return (await kv.get(`restaurant-${restaurantId}-maintenance_orders`)) === "true";
}

export async function isMaintenancePolls(kv: KVNamespace, restaurantId: string) {
  return (await kv.get(`restaurant-${restaurantId}-maintenance_polls`)) === "true";
}
