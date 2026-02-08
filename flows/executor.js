import { interpolate } from "../lib/vars.js";
import startBlock from "../blocks/start.js";
import respondBlock from "../blocks/respond.js";
import requestBlock from "../blocks/request.js";
import conditionBlock from "../blocks/condition.js";
import setVarBlock from "../blocks/setVar.js";
import manipulateTextBlock from "../blocks/manipulateText.js";
import manipulateImageBlock from "../blocks/manipulateImage.js";
import sendErrorBlock from "../blocks/error.js";
import encodeTextBlock from "../blocks/encodeText.js";
import decodeTextBlock from "../blocks/decodeText.js";
import generateTextBlock from "../blocks/generateText.js";
import sendEmailBlock from "../blocks/sendEmail.js";

/* -------------------------
   1️⃣  Centralized block registry
------------------------- */
const BLOCKS = {
  start: startBlock,
  respond: respondBlock,
  condition: conditionBlock,
  request: requestBlock,
  setVar: setVarBlock,
  manipulateText: manipulateTextBlock,
  manipulateImage: manipulateImageBlock,
  error: sendErrorBlock,
  encodeText: encodeTextBlock,
  decodeText: decodeTextBlock,
  generateText: generateTextBlock,
  sendEmail: sendEmailBlock,
};

/* -------------------------
   2️⃣  Core flow executor
------------------------- */
export async function runFlow(node, req, res, context = {}) {
  if (!node) return [];

  if (!context.variables) context.variables = {};

  // Initialize once
  if (!context._varsInitialized) {
    context._varsInitialized = true;

    const reqData = {
      query: req.query || {},
      body: req.body || {},
      headers: req.headers || {},
      method: req.method,
      url: req.originalUrl || req.url,
    };

    context.variables = {
      ...context.variables,      // keep old variables
      params: context.params || {},
      flow: context.flow,
      endpoint: context.endpoint,
      req: reqData,
      local: context.local || context.variables.local || {},
    };

    if (!context.params) context.params = {};

    const startNode = context.flow || node;
    const defaults = startNode.data?.queryParams || [];
    for (const p of defaults) {
      if (p.key && p.default_value !== undefined) {
        context.params[p.key] = p.default_value;
      }
    }
    Object.assign(context.params, req.query);
  }

  let outputs = [];
  const block = BLOCKS[node.type];

  if (block && typeof block.run === "function") {
    const result = await block.run(node, req, res, context);

    // Collect outputs for chaining/logging
    if (result?.response !== undefined) outputs.push(result.response);
    else if (result?.output !== undefined) outputs.push(result.output);

    // ---- Store request block results under its own name only ----
    if (node.type === "request") {
      const key = node.data?.request_name || node.id;
      const resp = result.response || result.output || {};

      context.variables[key] = resp;               // full request result
      context.variables[`${key}.body`] = resp.body;
      context.variables[`${key}.response`] = resp; // for {blockName.response.body...}
    }
  } else {
    console.warn(`⚠️ No handler found for block type "${node.type}"`);
  }

  // Run children recursively
  if (node.children?.length) {
    for (const child of node.children) {
      let shouldRun = true;
      if (typeof block?.shouldRunChild === "function") {
        shouldRun = block.shouldRunChild(child, context);
      } else if (node.type === "condition") {
        const truePath = child.branch === "condition";
        const falsePath = child.branch === "else";
        shouldRun = (context._lastCondition && truePath) || (!context._lastCondition && falsePath);
      }

      if (shouldRun) {
        const childOutputs = await runFlow(child, req, res, context);
        outputs = outputs.concat(childOutputs);
      }
    }
  }

  return outputs;
}
