import { interpolate } from "../lib/vars.js";
import startBlock from "../blocks/start.js";
import respondBlock from "../blocks/respond.js";
import requestBlock from "../blocks/request.js";
import conditionBlock from "../blocks/condition.js";
import setVarBlock from "../blocks/setVar.js";
import manipulateTextBlock from "../blocks/manipulateText.js";

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
};

/* -------------------------
   2️⃣  Core flow executor
------------------------- */
export async function runFlow(node, req, res, context = {}) {
  if (!node) return [];

  // Ensure context variables exist
  if (!context.variables) context.variables = {};

  // Initialize context once (root-level defaults + query params)
  if (!context._varsInitialized) {
    context._varsInitialized = true;
  
    // Ensure sections exist
    if (!context.variables) context.variables = {};
    if (!context.params) context.params = {};
  
    const startNode = context.flow || node;
    const defaults = startNode.data?.queryParams || [];
  
    // Load flow defaults into params
    for (const p of defaults) {
      if (p.key && p.default_value !== undefined) {
        context.params[p.key] = p.default_value;
      }
    }
  
    // Merge actual request query params (override defaults)
    Object.assign(context.params, req.query);
  }  

  console.log(context.local, context.params);

  let outputs = [];

  /* -------------------------
     3️⃣  Run current node
  ------------------------- */
  const block = BLOCKS[node.type];

  if (block && typeof block.run === "function") {
    const result = await block.run(node, req, res, context);

    // Collect returned output (for chaining/logging/etc.)
    if (result?.output !== undefined) outputs.push(result.output);
  } else {
    console.warn(`⚠️ No handler found for block type "${node.type}"`);
  }

  /* -------------------------
     4️⃣  Run child nodes recursively
  ------------------------- */
  if (node.children?.length) {
    for (const child of node.children) {
      let shouldRun = true;

      // Let block decide (e.g. condition chooses path)
      if (typeof block?.shouldRunChild === "function") {
        shouldRun = block.shouldRunChild(child, context);
      } 
      // Built-in condition fallback (for older condition nodes)
      else if (node.type === "condition") {
        const truePath = child.branch === "condition";
        const falsePath = child.branch === "else";
        shouldRun =
          (context._lastCondition && truePath) ||
          (!context._lastCondition && falsePath);
      }

      if (shouldRun) {
        const childOutputs = await runFlow(child, req, res, context);
        outputs = outputs.concat(childOutputs);
      }
    }
  }

  return outputs;
}
