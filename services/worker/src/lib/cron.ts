import type { Env } from "../index";

// 3am daily counter reset — sequenced to avoid race conditions per spec
export async function runDailyReset(env: Env) {
  const restaurants = await env.DB.prepare(
    "SELECT id FROM restaurants WHERE active = 1"
  ).all<{ id: string }>();

  for (const r of restaurants.results) {
    const id = r.id;

    // 1. Block new orders
    await env.KV.put(`restaurant-${id}-maintenance_orders`, "true");
    // 2. Wait for in-flight orders
    await sleep(5000);
    // 3. Block polls
    await env.KV.put(`restaurant-${id}-maintenance_polls`, "true");
    // 4. Reset counters
    await Promise.all([
      env.KV.put(`restaurant-${id}-orders_placed`, "0"),
      env.KV.put(`restaurant-${id}-orders_collected`, "0"),
    ]);
    // 5. Unblock orders
    await env.KV.delete(`restaurant-${id}-maintenance_orders`);
    // 6. Unblock polls
    await env.KV.delete(`restaurant-${id}-maintenance_polls`);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
