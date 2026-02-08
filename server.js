// server.js
import express from "express";
import "dotenv/config";
import cors from "cors";
import { registerFlowRoutes } from "./flows/routes.js";
import { supabase } from "./lib/supabase-client.js";
import { trackRequestStart, apiRequestLogger } from "./flows/logging.js";
import crypto from "crypto"; // <-- ADD

const app = express();
const PORT = 8080;

// === Basic in-memory rate limiter ===
const rateLimitMap = new Map();
const LIMIT = 30; // max requests
const WINDOW_MS = 60_000; // 1 minute

app.use(cors());
app.get("/health", (req, res) => res.json({ ok: true }));

/* ===========================
   ADD: API key parsing layer
   =========================== */
app.use(async (req, res, next) => {
  const authHeader = req.headers.authorization;
  req.apiAuth = null;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next();
  }

  const rawKey = authHeader.replace("Bearer ", "").trim();

  try {
    const hash = crypto
      .createHmac("sha256", process.env.API_KEY_HASH_SECRET)
      .update(rawKey)
      .digest("hex");

    req.apiAuth = {
      rawKey,
      hash
    };
  } catch (err) {
    return res.status(500).json({
      success: false,
      status: 500,
      message: "API key processing failed"
    });
  }

  next();
});
/* ===========================
   END ADD
   =========================== */

app.use((req, res, next) => {
  const ip =
    req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.connection.remoteAddress ||
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
    return res
      .status(429)
      .json({ 
          success: false,
          status: 429,
          message: "Too many requests. Please wait 1 minute and try again.",
          metadata: {
            timestamp: new Date().toISOString(),
          },
      });
  }

  next();
});

app.use(trackRequestStart);
app.use(apiRequestLogger());

// === Register your dynamic flow routes ===
(async () => {
  try {
    await registerFlowRoutes(app);

    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  } catch (err) {
    console.error("Failed to start server:", err);
  }
})();
