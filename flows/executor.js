import respond from "../blocks/respond.js";
import condition from "../blocks/condition.js";
import { runRequestBlock } from "../blocks/request.js";

const blockHandlers = {
  respond,
  condition,
  request: async (node, req, res, context) => {
    const result = await runRequestBlock(node.data, context);

    // Use block name if available, fallback to node ID
    const key = node.data.request_name || node.id;

    context[key] = result;                  // full result
    context[`${key}.body`] = result.body;   // shortcut for body

    return result;
  }
};

export async function runFlow(node, req, res, context = {}) {
  let outputs = [];
  if (!node) return outputs;

  // merge query params into shared context
  Object.assign(context, req.query);

  const handler = blockHandlers[node.type];
  if (handler) {
    await handler(node, req, res, context);

    if (node.type === "respond") {
      outputs.push(node.data.message);
    }
  }

  if (node.children?.length) {
    for (const child of node.children) {
      if (node.type === "condition") {
        if (context._lastCondition === true && child.data.path === "condition") {
          outputs = outputs.concat(await runFlow(child, req, res, context));
        } else if (context._lastCondition === false && child.data.path === "else") {
          outputs = outputs.concat(await runFlow(child, req, res, context));
        }
      } else {
        outputs = outputs.concat(await runFlow(child, req, res, context));
      }
    }
  }

  return outputs;
}