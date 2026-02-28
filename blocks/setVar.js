export default {
  name: "setVar",
  description: "Creates or updates a variable in the context",

  schema: {
    inputs: ["referenceVar", "value"],
    outputs: ["next"],
    category: "logic",
  },

  async run(node, req, res, context = {}) {
    const d = node.data || {};
    const rawName = (d.referenceVar || "").trim();
    if (!rawName) {
      console.warn("⚠️ No variable name provided for setVar block");
      return { output: null };
    }

    // Interpolate value first
    const { interpolate } = await import("../lib/vars.js");
    const newValue = interpolate(d.value || "", context);

    // Ensure local store exists
    if (!context.local) context.local = {};

    // Save into local scope
    context.local[rawName] = newValue;

    return {
      output: { [rawName]: newValue },
      next: true,
    };
  },
};