// server.js
import express from "express";
import "dotenv/config";
import { registerFlowRoutes } from "./flows/routes.js";

// --- Railway-ready Express server ---
const app = express();

// Railway sets the PORT environment variable dynamically
const PORT = process.env.PORT || 3001;
if (!PORT) {
  throw new Error("process.env.PORT is not set. Railway sets this automatically.");
}

// --- Basic in-memory rate limiter ---
const rateLimitMap = new Map();
const LIMIT = 30; // max requests
const WINDOW_MS = 60_000; // 1 minute

// Health check endpoint for Railway
app.get("/health", (req, res) => res.json({ ok: true }));

app.use((req, res, next) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket.remoteAddress ||
    "unknown";

  const now = Date.now();
  const record = rateLimitMap.get(ip) || { count: 0, start: now };

  // Reset window
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

// --- Register dynamic flow routes ---
(async () => {
  await registerFlowRoutes(app);

  // Start server
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
})();
