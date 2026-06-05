import { Hono } from "hono";
import { authRoutes } from "./routes/auth";
import { orderRoutes } from "./routes/orders";

export interface Env {
  DB: D1Database;
  KV: KVNamespace;
  JWT_SECRET: string;
}

const app = new Hono<{ Bindings: Env }>();

app.get("/health", (c) => c.json({ ok: true }));

app.route("/auth", authRoutes);
app.route("/orders", orderRoutes);


app.notFound((c) => c.json({ error: "Not found" }, 404));

export default app;
