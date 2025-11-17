// server.js
import express from "express";
import "dotenv/config";
import { registerFlowRoutes } from "./flows/routes.js";
import { createClient } from "@supabase/supabase-js";

// --- Initialize Supabase client ---
export const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// --- Express app ---
const app = express();

// --- Railway PORT ONLY (no fallback) ---
const PORT = process.env.PORT;
if (!PORT) {
  throw new Error("PORT env variable is not set by Railway!");
}
console.log("🚀 Server will listen on PORT:", PORT);

// --- Basic in-memory rate limiter ---
const rateLimitMap = new Map();
const LIMIT = 30; // max requests
const WINDOW_MS = 60_000; // 1 minute

// --- Health check ---
app.get("/health", (req, res) => res.json({ ok: true }));

// --- Rate limiter middleware ---
app.use((req, res, next) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, start: now };

  if (now - record.start > WINDOW_MS) {
    record.count = 0;
    record.start = now;
  }

  record.count++;
  rateLimitMap.set(ip, record);

  if (record.count > LIMIT) {
    res.set("Retry-After", Math.ceil(WINDOW_MS / 1000));
    return res.status(429).json({
      success: false,
      status: 429,
      message: "Too many requests. Please wait 1 minute and try again.",
      metadata: { timestamp: new Date().toISOString() },
    });
  }

  next();
});

// --- Start server immediately ---
app.listen(PORT, () => {
  console.log(`🚀 Server listening on PORT ${PORT}`);
});

// --- Register dynamic flow routes asynchronously ---
(async () => {
  try {
    console.log("Registering dynamic routes...");
    // Add a timeout so it doesn’t hang forever
    await Promise.race([
      registerFlowRoutes(app),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Flow registration timed out")), 10000)
      ),
    ]);
    console.log("✅ Dynamic routes registered");
  } catch (err) {
    console.error("🔥 Failed to register dynamic routes:", err);
  }
})();
