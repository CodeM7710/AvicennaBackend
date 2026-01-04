export default {
    name: "decodeText",
    description: "Decodes text from common encoding formats (Base64, Hex, Binary, etc.)",
  
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
        console.warn("⚠️ No input text provided for decodeText block");
        return { output: null };
      }
  
      let result = rawText;
  
      try {
        switch (encoding) {
          case "base64":
            result = Buffer.from(rawText, "base64").toString("utf8");
            break;
  
          case "base64url":
            // convert Base64URL to standard Base64 first
            const base64 = rawText.replace(/-/g, "+").replace(/_/g, "/");
            const padded = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
            result = Buffer.from(padded, "base64").toString("utf8");
            break;
  
          case "hex":
            result = Buffer.from(rawText, "hex").toString("utf8");
            break;
  
          case "utf8":
            result = Buffer.from(rawText, "utf8").toString("utf8");
            break;
  
          case "ascii":
            result = Buffer.from(rawText, "ascii").toString("utf8");
            break;
  
          case "binary":
            result = rawText
              .split(" ")
              .map((b) => String.fromCharCode(parseInt(b, 2)))
              .join("");
            break;
  
          default:
            console.warn(`⚠️ Unknown decoding method: ${encoding}`);
            break;
        }
      } catch (err) {
        console.error("❌ Error in decodeText block:", err);
      }
  
      // Store result
      if (name) {
        if (!context.local) context.local = {};
        if (!context.result) context.result = {};
        context.local[name] = result;
        context.result[name] = result;
        console.log(`🟢 Decoded result saved as: result.${name} =`, result);
      }
  
      return {
        output: { [name || "result"]: result },
        next: true,
      };
    },
  };
  