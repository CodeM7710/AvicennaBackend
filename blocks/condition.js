import { interpolate } from "../lib/vars.js";

export default {
  name: "condition",
  description: "Evaluates a logical expression and chooses a path",
  schema: {
    inputs: ["expression1", "comparison", "expression2"],
    outputs: ["condition", "else"],
    category: "logic",
  },

  async run(node, req, res, context = {}) {
    const d = node.data || {};

    // --- Helper: auto-detect strings/numbers ---
    const smartValue = (val) => {
      if (val === null || val === undefined) return '""';
      val = val.toString().trim();
      if (!isNaN(val)) return Number(val);
      if (/^["'].*["']$/.test(val)) return val;
      return `"${val}"`;
    };

    // --- Helper: null check (matches frontend semantics) ---
    const isNullish = (val) =>
      val === null || val === undefined || val === "";

    // --- Unary operators: is null / is not null ---
    if (
      d.expression1 &&
      (d.comparison === "is_null" || d.comparison === "is_not_null")
    ) {
      const raw = interpolate(d.expression1, context);

      const result =
        d.comparison === "is_null"
          ? isNullish(raw)
          : !isNullish(raw);

      context._lastCondition = result;

      return {
        branch: result ? "condition" : "else",
        result,
      };
    }

    // --- Build binary expression ---
    let expr = "";
    if (d.expression1 && d.comparison && d.expression2) {
      const left = smartValue(interpolate(d.expression1, context));
      const right = smartValue(interpolate(d.expression2, context));
      expr = `${left} ${d.comparison} ${right}`;
    } else if (d.condition) {
      expr = interpolate(d.condition, context)?.trim();
    } else {
      console.warn("⚠️ No condition specified in node", node.id);
      context._lastCondition = false;
      return { branch: "else", result: false };
    }

    // --- Validate expression ---
    if (!expr || /^\W+$/.test(expr)) {
      console.warn("⚠️ Invalid condition expression:", expr);
      context._lastCondition = false;
      return { branch: "else", result: false };
    }

    // --- Safely evaluate ---
    let result = false;
    try {
      result = Boolean(Function(`"use strict"; return (${expr});`)());
    } catch (err) {
      console.error(
        "❌ Error evaluating condition:",
        err.message,
        "Expression:",
        expr
      );
      result = false;
    }

    // --- Store result for downstream logic ---
    context._lastCondition = result;

    return {
      branch: result ? "condition" : "else",
      result,
    };
  },
};
