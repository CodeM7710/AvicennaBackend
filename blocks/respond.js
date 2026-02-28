import { interpolate } from "../lib/vars.js";

export default {
  name: "respond",
  description: "Sends a JSON response back to the client",

  schema: {
    inputs: ["jsonResponse"],
    outputs: ["output"],
    category: "output",
  },

  async run(node, req, res, context) {
    if (!context.variables || typeof context.variables !== "object") {
      context.variables = {};
    }

    const flow = context.flow || {};
    const defaults = {};

    flow.data?.queryParams?.forEach(p => {
      if (p.key) defaults[p.key] = p.default_value;
    });

    context.variables.params = context.params || {};
    context.variables.endpoint = context.endpoint || {};
    context.variables.flow = flow;

    // ---- Backwards compatibility ----
    let jsonResponse = node.data?.jsonResponse;

    if (
      (!Array.isArray(jsonResponse) || jsonResponse.length === 0) &&
      node.data?.message
    ) {
      jsonResponse = [
        {
          key: "message",
          value: node.data.message,
        },
      ];
    }

    const responseBody = {};

    if (Array.isArray(jsonResponse)) {
      for (const pair of jsonResponse) {
        if (!pair?.key) continue;

        const interpolatedValue = interpolate(
          String(pair.value ?? ""),
          context,
          defaults
        );

        let finalValue = interpolatedValue;

        if (interpolatedValue === "true") finalValue = true;
        else if (interpolatedValue === "false") finalValue = false;
        else if (!isNaN(interpolatedValue) && interpolatedValue.trim() !== "")
          finalValue = Number(interpolatedValue);
        else {
          try {
            finalValue = JSON.parse(interpolatedValue);
          } catch {
            finalValue = interpolatedValue;
          }
        }

        responseBody[pair.key] = finalValue;
      }
    }

    const statusCode = node.data?.status
      ? Number(node.data.status)
      : 200;

    if (!res.headersSent) {
      res.status(statusCode).json(responseBody);
    }

    return {
      output: responseBody,
      sent: true,
    };
  },
};