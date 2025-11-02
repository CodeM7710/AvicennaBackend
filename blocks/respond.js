import { interpolate } from "../lib/vars.js";

export default {
  name: "respond",
  description: "Sends an interpolated message back to the client",

  schema: {
    inputs: ["message", "data"],
    outputs: ["output"],
    category: "output",
  },

  async run(node, req, res, context) {
    const flow = context.flow || {};
    const defaults = {};

    // Load query param defaults from flow
    flow.data?.queryParams?.forEach(p => {
      if (p.key) defaults[p.key] = p.default_value;
    });

    // Interpolate message
    const message = interpolate(
      node.data?.message || "",
      context,
      defaults
    );

    // Optional structured data payload
    let data = {};
    if (node.data?.data) {
      const interpolatedData = interpolate(JSON.stringify(node.data.data), context, defaults);
      try {
        data = JSON.parse(interpolatedData);
      } catch (err) {
        console.warn("⚠️ Respond block data is not valid JSON:", interpolatedData);
      }
    }

    // Standardized JSON response
    const statusCode = node.data?.status ? Number(node.data.status) : 200;

    const output = {
      success: true,
      status: statusCode,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    // Send response only once
    if (!res.headersSent) res.json(output);

    // Return standardized output for flow chaining
    return {
      output,
      sent: true,
    };
  },
};
