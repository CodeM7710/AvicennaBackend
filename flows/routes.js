import LZString from "lz-string";
import { supabase } from "../lib/supabase-client.js";
import { runFlow } from "./executor.js";
import cors from "cors";

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

// INVALID ROUTE - CUSTOM HTML BRANDED PAGE

export async function registerFlowRoutes(app) {
  app.use(cors({
    origin: "*",
    methods: ["GET","POST","PUT","DELETE","OPTIONS"],
    allowedHeaders: ["Content-Type"]
  }));

  app.get("/api/ping", (req, res) => {
    res.status(200).json({ 
        success: true,
        status: 200,
        message: "🏓 Pong!",
        metadata: {
          timestamp: new Date().toISOString(),
        }
      });
  });

  // Instead of pre-registering every route for all flows,
  // we register a *catch-all* that looks up subdomain + slug dynamically.
  app.all("/api/:endpoint_slug", async (req, res) => {
    const { endpoint_slug } = req.params;
    if (endpoint_slug === "ping") return;

    try {
      const host = req.headers.host.split(":")[0];
      const subdomain = host.split(".")[0];

      if (!subdomain || subdomain === 'www') {
        return res.status(400).send("Missing or invalid subdomain");
      }

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

  app.use((req, res, next) => {
    // If the request starts with /api, skip
    if (req.path.startsWith("/api")) return next();
  
    // Otherwise return your custom HTML
    res.status(200).send(`
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>Invalid Route | Powered by Avicenna</title>
        <style>
          @import url('https://fonts.googleapis.com/css2?family=Faculty+Glyphic&family=Lato:ital,wght@0,100;0,300;0,400;0,700;0,900;1,100;1,300;1,400;1,700;1,900&family=League+Spartan:wght@100..900&family=Newsreader:ital,opsz,wght@0,6..72,200..800;1,6..72,200..800&display=swap');

          .bg {
            background: radial-gradient(
              70% 80% at center 0%,
              rgba(74, 244, 170, 0.15) 3%, 
              rgba(74, 244, 170, 0) 70%,   
              rgba(74, 244, 170, 0) 100%
            );
            color: #fff;
            font-family: sans-serif;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            margin: 0;
            flex-direction: column;
            padding: 10px 35%;
          }

          @media (max-width: 1000px) {
            .bg {
              padding: 0 18%;
            }
          }

          h1 {
            font-family: Lato, sans;
            font-weight: 700;
            font-size: 1.5em;
            background-image: linear-gradient(to right bottom, #eeeeee, #bebdbd); /* Whitish to grayish */
            -webkit-background-clip: text; /* For Webkit browsers */
            background-clip: text; /* Standard property */
            -webkit-text-fill-color: transparent; /* For Webkit browsers */
            color: transparent; /* Standard property for fallback */;
            margin: 0;
            text-align: center;
          }

          p {
            color: #c7c7c7;
            font-family: Lato, sans;
            margin: 0;
            text-align: center;
            font-weight: 400;
          }

          kbd {
            background-color: rgba(255, 255, 255, 0.1);
            border: 1px solid rgba(255, 255, 255, 0.074);
            border-radius: 5px;
            padding: 2.5px;
          }

          body {
            background-color: #060606;
            margin: 0;
            font-family: Lato, sans;
          }

          a {
            margin: 0;
            padding: 0;
          }

          .lucide {
            color: white;
            background-image: linear-gradient(to left bottom, oklab(1 0 5.9604645e-8 / 0.1) 0px, rgba(0, 0, 0, 0) 100%);
            padding: 13px;
            margin: 5px;
            border: 2px solid rgba(255, 255, 255, 0.074);
            border-radius: 15px;
            display: inline-block;
            vertical-align: middle;
            margin-bottom: 10px;
          }

          .lucide img {
            height: 30px;
            width: 30px;
            object-fit: contain;
            display: block;
          }
          
          .branding {
            font-family: Lato, sans;
            display: flex;
            gap: 2.5px;
            color: white;
            opacity: 0.7;
            position: relative;
            top: 300px;
            text-decoration: none;
            padding: 7.5px 15px;
            border: 1px solid rgba(255, 255, 255, 0.074);
            border-radius: 10px;
          }

          .branding:hover {
            opacity: 0.5;
          }

          .branding img {
            width: 1.5em;
            height: auto;
            display: inline-block;
            vertical-align: text-top;
          }
        </style>
      </head>
      <body>
          <div class="bg">
            <div class="lucide">
              <img src="data:image/svg+xml;base64,PHN2ZyBmaWxsPSJub25lIiBzdHJva2U9IndoaXRlIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBzdHJva2Utd2lkdGg9IjIiIHN0cm9rZS1saW5lY2FwPSJyb3VuZCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCI+PHBhdGggZD0iTTEyIDE2aC4wMSIvPjxwYXRoIGQ9Ik0xMiA4djQiLz48cGF0aCBkPSJNMTUuMzEyIDJhMiAyIDAgMCAxIDEuNDE0LjU4Nmw0LjY4OCA0LjY4OEEyIDIgMCAwIDEgMjIgOC42ODh2Ni42MjRhMiAyIDAgMCAxLS41ODYgMS40MTRsLTQuNjg4IDQuNjg4YTIgMiAwIDAgMS0xLjQxNC41ODZIOC42ODhhMiAyIDAgMCAxLTEuNDE0LS41ODZsLTQuNjg4LTQuNjg4QTIgMiAwIDAgMSAyIDE1LjMxMlY4LjY4OGEyIDIgMCAwIDEgLjU4Ni0xLjQxNGw0LjY4OC00LjY4OEEyIDIgMCAwIDEgOC42ODggMnoiLz48L3N2Zz4="></img>
            </div>
            <h1>Whoops, this is an invalid route!</h1>
            <p>You've reached an invalid route on this API. Try double-checking your URL contains <kbd>/api</kbd> and reload the page.</p>


            <a href="https://www.avicenna.dev/?utm_source=invalid_route_api_page" class="branding">
                Powered by <img src="https://i.ibb.co/27hDV9wc/avicenna-api-white-logo-solo.png"></img> Avicenna
            </a>
          </div>
      </body>
      </html>
    `);
  });

  console.log("✅ Dynamic /api/:endpoint_slug route registered");
}