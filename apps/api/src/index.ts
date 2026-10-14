import Fastify from "fastify";
import { bridge } from "./bridge/index.js";

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

app.get("/health", async () => ({ ok: true }));

app.get("/bridge/health", async () => {
  return await bridge.health();
});

// TEMPORARY: GET for browser testing. Remove before Phase 5.
app.get("/bridge/capture", async () => {
  return await bridge.capture();
});

app.post("/bridge/capture", async () => {
  return await bridge.capture();
});

app.listen({ port: 3000, host: "127.0.0.1" }).then(() => {
  console.log("API listening on http://127.0.0.1:3000");
});