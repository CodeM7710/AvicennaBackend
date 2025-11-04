import { interpolate } from "../lib/vars.js";

export default {
  name: "sendError",
  description: "Sends an error response back to the client",

  schema: {
    inputs: ["code", "message"],
    outputs: ["output"],
    category: "output",
  },

  async run(node, req, res, context) {
    const flow = context.flow || {};
    const defaults = {};

    // Load query param defaults from flow
    flow.data?.queryParams?.forEach((p) => {
      if (p.key) defaults[p.key] = p.default_value;
    });

    // Interpolate error message
    const message = interpolate(node.data?.message || "", context, defaults);

    // Determine error code (default 400)
    const code = node.data?.code ? Number(node.data.code) : 400;

    // Standardized error response
    const output = {
      success: false,
      status: code,
      error: {
        code,
        message,
      },
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    // Send error JSON if not already sent
    if (!res.headersSent) res.status(code).json(output);

    // Return for flow chaining (if needed)
    return {
      output,
      sent: true,
    };
  },
};