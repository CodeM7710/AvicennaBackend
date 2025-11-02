import LZString from "lz-string";
import { supabase } from "../lib/supabase-client.js";
import { runFlow } from "./executor.js";

export async function registerFlowRoutes(app) {
  app._registeredRoutes = app._registeredRoutes || new Set();

  const pollFlows = async () => {
    const { data: flows, error } = await supabase.from("flows").select("*");
    if (error) return console.error("Error fetching flows:", error);

    flows.forEach(row => {
      if (app._registeredRoutes.has(row.endpoint_slug)) return;

      try {
        const decompressed = LZString.decompressFromBase64(row.published_tree || row.saved_tree);
        if (!decompressed) throw new Error("Failed to decompress flow");

        const flow = JSON.parse(decompressed);

        app.all(`/api/${row.endpoint_slug}`, async (req, res) => {
          try {
            // Build context for this request
            const context = {
              variables: {}, // runtime values
              flow           // full flow JSON for defaults
            };

            // Load defaults from flow query params
            flow?.data?.queryParams?.forEach(p => {
              context.variables[p.key] = p.default_value ?? "";
            });

            // Override with actual query params from request
            Object.assign(context.variables, req.query);

            await runFlow(flow, req, res, context);

          } catch (err) {
            console.error("Error running flow:", err);
            if (!res.headersSent) {
              res.status(500).send("Flow execution error");
            }
          }
        });

        app._registeredRoutes.add(row.endpoint_slug);
        console.log(`Registered route: /api/${row.endpoint_slug}`);

      } catch (err) {
        console.error("Error decompressing/parsing flow JSON:", err);
      }
    });
  };

  // Initial fetch
  await pollFlows();

  // Poll every 1 minute to pick up new flows
  setInterval(pollFlows, 60_000);
}