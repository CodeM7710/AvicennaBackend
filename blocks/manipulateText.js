export default {
    name: "manipulateText",
    description: "Performs text transformations like uppercase, replace, split, etc.",
  
    schema: {
      inputs: ["text", "operation", "find", "replace", "delimiter", "additional", "referenceVar"],
      outputs: ["next"],
      category: "text",
    },
  
    async run(node, req, res, context = {}) {
      const d = node.data || {};
      const { interpolate } = await import("../lib/vars.js");
  
      // Resolve text and parameters with variable interpolation
      const rawText = interpolate(d.text || "", context);
      const operation = (d.operation || "uppercase").trim();
      const name = (d.referenceVar || "").trim();
  
      if (!rawText) {
        console.warn("⚠️ No input text provided for manipulateText block");
        return { output: null };
      }
  
      let result = rawText;
  
      try {
        switch (operation) {
          case "uppercase":
            result = rawText.toUpperCase();
            break;
  
          case "lowercase":
            result = rawText.toLowerCase();
            break;
  
          case "trim":
            result = rawText.trim();
            break;
  
          case "replace": {
            const find = interpolate(d.find || "", context);
            const repl = interpolate(d.replace || "", context);
            if (find) result = rawText.split(find).join(repl);
            break;
          }
  
          case "split": {
            const delimiter = interpolate(d.delimiter || "", context);
            result = delimiter ? rawText.split(delimiter) : [rawText];
            break;
          }
  
          case "concat": {
            const add = interpolate(d.additional || "", context);
            result = rawText + add;
            break;
          }
  
          default:
            console.warn(`⚠️ Unknown text operation: ${operation}`);
            break;
        }
      } catch (err) {
        console.error("❌ Error in manipulateText block:", err);
      }
  
      // Store result in context.local if a name is provided
      if (name) {
        if (!context.local) context.local = {};
        if (!context.result) context.result = {};
        context.local[name] = result;
        context.result[name] = result;
        console.log(`🟢 Text result saved as: result.${name} =`, result);
      }
  
      return {
        output: { [name || "result"]: result },
        next: true,
      };
    },
  };
  