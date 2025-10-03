import LZString from "lz-string";
import { supabase } from "../lib/supabase-client.js";
import { runFlow } from "./executor.js";

export async function registerFlowRoutes(app) {
  app._registeredRoutes = app._registeredRoutes || new Set();

  const pollFlows = async () => {
    const { data, error } = await supabase.from("flows").select("*");
    if (error) return console.error("Error fetching flows:", error);

    data.forEach(row => {
      if (app._registeredRoutes.has(row.endpoint_slug)) return;

      try {
        const decompressed = LZString.decompressFromBase64(row.published_tree || row.saved_tree);
        if (!decompressed) throw new Error("Failed to decompress flow");

        const flow = JSON.parse(decompressed);

        app.all(`/api/${row.endpoint_slug}`, async (req, res) => {
          try {
            const context = { variables: {} };
        
            const rootNode = flow;
            if (rootNode?.data?.queryParams) {
              for (const param of rootNode.data.queryParams) {
                context.variables[param.key] = param.value;
              }
            }
        
            for (const [key, value] of Object.entries(req.query)) {
              context.variables[key] = value;
            }
        
            await runFlow(flow, req, res, context); // no res.send here
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

  // Poll every 1 minute
  setInterval(pollFlows, 60_000);
}