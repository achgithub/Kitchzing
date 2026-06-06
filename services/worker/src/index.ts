import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { orderRoutes } from "./routes/orders";
import { menuRoutes } from "./routes/menu";
import { configRoutes } from "./routes/config";
import { runDailyReset } from "./lib/cron";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
app.route("/orders", orderRoutes);
app.route("/menu", menuRoutes);
app.route("/config", configRoutes);

app.notFound((c) => c.json({ error: "Not found" }, 404));

export default {
  fetch: app.fetch,
  async scheduled(_controller: ScheduledController, env: Env) {
    await runDailyReset(env);
  },
} satisfies ExportedHandler<Env>;
