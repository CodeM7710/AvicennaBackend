import fetch from "node-fetch";
import { interpolate } from "../lib/vars.js";

/**
 * Executes a RequestNode
 * Supports dynamic variables in URL, headers, and bodyParams using {var} syntax
 */
export async function runRequestBlock(nodeData, context = {}) {
  if (!nodeData.url) throw new Error("Request URL is required");

  const method = (nodeData.method || "GET").toUpperCase();

  // Interpolate URL with context
  const url = interpolate(nodeData.url, context);

  // Convert headers from array to object + interpolate
  const headers = {};
  (nodeData.headers || []).forEach(h => {
    if (h.key) headers[h.key] = interpolate(h.value, context);
  });

  // Convert bodyParams array to object + interpolate
  let body = null;
  if (method !== "GET" && method !== "HEAD" && nodeData.bodyParams?.length) {
    body = {};
    nodeData.bodyParams.forEach(p => {
      if (p.key) body[p.key] = interpolate(p.value, context);
    });

    // default to JSON if no explicit content-type
    if (!headers["Content-Type"]) headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get("content-type");
    let parsedBody;
    if (contentType?.includes("application/json")) {
      parsedBody = await res.json();
    } else {
      parsedBody = await res.text();
    }

    return { status: res.status, ok: res.ok, body: parsedBody };
  } catch (err) {
    return { status: 500, ok: false, body: { error: err.message } };
  }
}