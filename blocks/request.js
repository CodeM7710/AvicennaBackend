import fetch from "node-fetch";
import { interpolate } from "../lib/vars.js";

export default {
  name: "request",
  description: "Performs an HTTP request with dynamic variables",
  schema: {
    inputs: ["url", "method", "headers", "bodyParams"],
    outputs: ["response"],
    category: "network",
  },

  async run(node, req, res, context = {}) {
    const data = node.data || {};
    if (!data.url) throw new Error("Request URL is required");

    const method = (data.method || "GET").toUpperCase();

    // Interpolate URL
    const url = interpolate(data.url, context || {});

    // Build headers object
    const headers = {};
    (data.headers || []).forEach(h => {
      if (h.key) headers[h.key] = interpolate(h.value, context || {});
    });

    // Build body
    let body = null;
    if (method !== "GET" && method !== "HEAD" && data.bodyParams?.length) {
      body = {};
      data.bodyParams.forEach(p => {
        if (p.key) body[p.key] = interpolate(p.value, context || {});
      });
      if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
    }

    // Perform request
    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      const contentType = response.headers.get("content-type");
      let parsedBody;
      if (contentType?.includes("application/json")) {
        parsedBody = await response.json();
      } else {
        parsedBody = await response.text();
      }

      const result = {
        status: response.status,
        ok: response.ok,
        body: parsedBody,
      };

      // Store results in context for later blocks
      const key = data.request_name || node.id;
      context.variables[key] = result;
      context.variables[`${key}.body`] = result.body;

      return { output: result };
    } catch (err) {
      const errorResult = {
        status: 500,
        ok: false,
        body: { error: err.message },
      };
      console.error("Request block error:", err);
      return { output: errorResult };
    }
  },
};
