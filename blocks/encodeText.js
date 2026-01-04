export default {
    name: "encodeText",
    description: "Encodes text into common encoding formats (Base64, Hex, Binary, etc.)",
  
    schema: {
      inputs: ["text", "encoding", "referenceVar"],
      outputs: ["next"],
      category: "text",
    },
  
    async run(node, req, res, context = {}) {
      const d = node.data || {};
      const { interpolate } = await import("../lib/vars.js");
  
      // Resolve inputs
      const rawText = interpolate(d.text || "", context);
      const encoding = (d.encoding || "base64").trim();
      const name = (d.referenceVar || "").trim();
  
      if (!rawText) {
        console.warn("⚠️ No input text provided for encodeText block");
        return { output: null };
      }
  
      let result = rawText;
  
      try {
        switch (encoding) {
          case "base64":
            result = Buffer.from(rawText, "utf8").toString("base64");
            break;
  
          case "base64url":
            result = Buffer.from(rawText, "utf8")
              .toString("base64")
              .replace(/\+/g, "-")
              .replace(/\//g, "_")
              .replace(/=+$/, "");
            break;
  
          case "hex":
            result = Buffer.from(rawText, "utf8").toString("hex");
            break;
  
          case "utf8":
            result = Buffer.from(rawText, "utf8").toString("utf8");
            break;
  
          case "ascii":
            result = Buffer.from(rawText, "utf8").toString("ascii");
            break;
  
          case "binary":
            result = Buffer.from(rawText, "utf8")
              .toString("binary")
              .split("")
              .map((c) => c.charCodeAt(0).toString(2).padStart(8, "0"))
              .join(" ");
            break;
  
          default:
            console.warn(`⚠️ Unknown encoding method: ${encoding}`);
            break;
        }
      } catch (err) {
        console.error("❌ Error in encodeText block:", err);
      }
  
      // Store result
      if (name) {
        if (!context.local) context.local = {};
        if (!context.result) context.result = {};
        context.local[name] = result;
        context.result[name] = result;
        console.log(`🟢 Encoded result saved as: result.${name} =`, result);
      }
  
      return {
        output: { [name || "result"]: result },
        next: true,
      };
    },
  };
  