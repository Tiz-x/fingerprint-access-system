import "dotenv/config";
import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import cors from "@fastify/cors";
import helmet from "@fastify/helmet";
import { bridge } from "./bridge/index.js";
import { authRoutes } from "./routes/auth.js";
import { userRoutes } from "./routes/users.js";
import { accessRoutes } from "./routes/access.js";
import { logRoutes } from "./routes/logs.js";
import { initRealtime } from "./realtime.js";
import { requireAdmin } from "./auth.js";

const app = Fastify({ logger: true });

app.addContentTypeParser(
  "application/json",
  { parseAs: "string" },
  (_req, body, done) => {
    if (!body || body === "") return done(null, {});
    try {
      done(null, JSON.parse(body as string));
    } catch (err) {
      done(err as Error, undefined);
    }
  }
);

await app.register(rateLimit, { global: false });

await app.register(cors, {
  origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  credentials: false,
});

await app.register(helmet, {
  contentSecurityPolicy: false,
});

app.get("/health", async () => ({ ok: true }));
app.get("/bridge/health", async () => bridge.health());
app.post("/bridge/capture", { preHandler: requireAdmin }, async () => bridge.capture());

await app.register(authRoutes);
await app.register(userRoutes);
await app.register(accessRoutes);
await app.register(logRoutes);

await app.ready();

initRealtime(app.server);

app.listen({ port: 3000, host: "127.0.0.1" }).then(() => {
  console.log("API + WebSocket listening on http://127.0.0.1:3000");
});