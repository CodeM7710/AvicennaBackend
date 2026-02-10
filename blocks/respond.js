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
    // ---- FIX: ensure variables context is initialized ----
    if (!context.variables || typeof context.variables !== "object") {
      context.variables = {};
    }

    const flow = context.flow || {};
    const defaults = {};

    // Load query param defaults from flow
    flow.data?.queryParams?.forEach(p => {
      if (p.key) defaults[p.key] = p.default_value;
    });

    // ---- FIX: expose params + endpoint safely for interpolation ----
    context.variables.params = context.params || {};
    context.variables.endpoint = context.endpoint || {};
    context.variables.flow = flow;

    // Build JSON response from key/value rows
    const responseBody = {};

    if (Array.isArray(node.data?.jsonResponse)) {
      node.data.jsonResponse.forEach(pair => {
        if (!pair?.key) return;

        const interpolatedValue = interpolate(
          String(pair.value ?? ""),
          context,
          defaults
        );

        responseBody[pair.key] = interpolatedValue;
      });
    }

    // Existing message interpolation (kept for compatibility)
    const message = interpolate(
      node.data?.message || "",
      context,
      defaults
    );

    // Optional structured data payload (kept)
    let data = {};
    if (node.data?.data) {
      const interpolatedData = interpolate(
        JSON.stringify(node.data.data),
        context,
        defaults
      );
      try {
        data = JSON.parse(interpolatedData);
      } catch {
        console.warn(
          "⚠️ Respond block data is not valid JSON:",
          interpolatedData
        );
      }
    }

    const statusCode = node.data?.status
      ? Number(node.data.status)
      : 200;

    const output = {
      success: true,
      status: statusCode,
      message,
      metadata: {
        timestamp: new Date().toISOString(),
      },
    };

    if (!res.headersSent) res.json(output);

    return {
      output,
      sent: true,
    };
  },
};