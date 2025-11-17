// server.js
import express from "express";

// --- Create Express app ---
const app = express();

// --- Use Railway-assigned port ONLY ---
const PORT = process.env.PORT;
if (!PORT) throw new Error("PORT env variable not set by Railway!");
console.log("🚀 Server will listen on PORT:", PORT);

// --- Minimal health endpoint ---
app.get("/health", (req, res) => res.json({ ok: true }));

// --- Start server ---
app.listen(PORT, () => {
  console.log(`✅ Server listening on PORT ${PORT}`);
});
