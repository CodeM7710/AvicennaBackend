import LZString from "lz-string";
import { supabase } from "../lib/supabase-client.js";
import { runFlow } from "./executor.js";

const CACHE_TTL = 60_000; // 1 minute
const flowCache = new Map(); // subdomain → { timestamp, flows }

async function getFlowsForSubdomain(subdomain) {
  const cached = flowCache.get(subdomain);
  const now = Date.now();

  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.flows;
  }

  const { data: flows, error } = await supabase
    .from("flows")
    .select("*")
    .eq("subdomain", subdomain);

  if (error) throw error;

  flowCache.set(subdomain, { timestamp: now, flows });
  return flows;
}

export async function registerFlowRoutes(app) {
  // Instead of pre-registering every route for all flows,
  // we register a *catch-all* that looks up subdomain + slug dynamically.
  app.all("/api/:endpoint_slug", async (req, res) => {
    try {
      const host = req.headers.host.split(":")[0];
      const subdomain = host.split(".")[0];

      if (!subdomain || subdomain === 'www') {
        return res.status(400).send("Missing or invalid subdomain");
      }

      const endpoint_slug = req.params.endpoint_slug;

      const flows = await getFlowsForSubdomain(subdomain);
      const row = flows.find(f => f.endpoint_slug === endpoint_slug);

      if (!row) return res.status(404).send("Endpoint not found");

      const decompressed = LZString.decompressFromBase64(
        row.published_tree || row.saved_tree
      );
      if (!decompressed) throw new Error("Failed to decompress flow");

      const flow = JSON.parse(decompressed);
      const context = { variables: {}, flow };

      flow?.data?.queryParams?.forEach(p => {
        context.variables[p.key] = p.default_value ?? "";
      });
      Object.assign(context.variables, req.query);

      await runFlow(flow, req, res, context);
    } catch (err) {
      console.error("Error running flow:", err);
      if (!res.headersSent) res.status(500).send("Flow execution error");
    }
  });

  console.log("✅ Dynamic /api/:endpoint_slug route registered");
}