import { interpolate } from "../lib/vars.js";

export default async function condition(node, req, res, context = {}) {
  const { condition: condExpr } = node.data || {};

  if (!condExpr) {
    console.warn("No condition specified in node", node.id);
    return null;
  }

  // Use our helper to replace all {vars} in the expression
  const replacedExpr = interpolate(condExpr, context);

  let result = false;
  try {
    // Use Function constructor for safer evaluation
    // Wrap in Boolean() to ensure a true/false result
    result = Boolean(Function(`return (${replacedExpr})`)());
  } catch (err) {
    console.error("Error evaluating condition:", err, "Expression:", replacedExpr);
  }

  // Store decision in context for downstream blocks
  context._lastCondition = result;

  return null;
}