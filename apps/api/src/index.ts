import "dotenv/config";
import Fastify from "fastify";
import { bridge } from "./bridge/index.js";
import { authRoutes } from "./routes/auth.js";

const app = Fastify({ logger: true });

// Accept empty POST bodies as {} instead of failing with 415.
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

// Health checks
app.get("/health", async () => ({ ok: true }));
app.get("/bridge/health", async () => bridge.health());

// Temporary GET for browser testing. Remove before Phase 5.
app.get("/bridge/capture", async () => bridge.capture());
app.post("/bridge/capture", async () => bridge.capture());

// Auth routes
await app.register(authRoutes);

app.listen({ port: 3000, host: "127.0.0.1" }).then(() => {
  console.log("API listening on http://127.0.0.1:3000");
});