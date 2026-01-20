import crypto from "crypto";
import { supabase } from "../lib/supabase-client.js";

const ENCRYPTION_KEY = Buffer.from(process.env.INTEGRATION_SECRET, "hex");

/* --- Decrypt helper --- */
function decrypt(enc) {
  const decipher = crypto.createDecipheriv(
    "aes-256-gcm",
    ENCRYPTION_KEY,
    Buffer.from(enc.iv, "hex")
  );
  decipher.setAuthTag(Buffer.from(enc.tag, "hex"));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(enc.content, "hex")),
    decipher.final(),
  ]);
  return decrypted.toString("utf8");
}

/* --- Normalize OpenAI errors --- */
function normalizeOpenAIError(err, responseJson) {
  return {
    source: "openai",
    type: responseJson?.error?.type || "api_error",
    code: responseJson?.error?.code || null,
    message: responseJson?.error?.message || err.message || "Unknown OpenAI error",
    status: err.status || null,
  };
}

export default {
    name: "generateText",
    description: "Generate text using OpenAI Responses API",
    schema: {
      inputs: ["prompt", "model", "temperature", "referenceVar"],
      outputs: ["next"],
      category: "ai",
    },
  
    async run(node, req, res, context = {}) {
      const d = node.data || {};
      const { interpolate } = await import("../lib/vars.js");
  
      const prompt = interpolate(d.prompt || "", context);
      const model = d.model || "gpt-5-nano";
      const temperature = parseFloat(d.temperature) || 0.7;
      const name = (d.referenceVar || "").trim();
  
      if (!prompt) return { output: null };
  
      const userId = context.flow?.user_id;
      if (!userId) throw new Error("Unauthorized");
  
      const { data, error } = await supabase
        .from("user_settings")
        .select("integrations")
        .eq("user_id", userId)
        .single();
  
      if (error) throw error;
  
      const chatgpt = data.integrations?.chatgpt;
      if (!chatgpt?.enabled) throw new Error("ChatGPT integration not enabled");
  
      const OPENAI_API_KEY = decrypt(chatgpt.api_key);
      let result = "";
  
      try {
        const response = await fetch("https://api.openai.com/v1/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model,
            input: prompt,
            temperature,
            store: false,
          }),
        });
  
        const json = await response.json();
  
        if (!response.ok) {
          const error = normalizeOpenAIError({ status: response.status }, json);
  
          // --- LOGGING ---
          console.error("❌ OpenAI request failed");
          console.error("Status:", response.status);
          console.error("Error code:", json?.error?.code);
          console.error("Error type:", json?.error?.type);
          console.error("Full response JSON:", JSON.stringify(json, null, 2));
  
          context.error = error;
          context._lastError = error;
  
          if (name) {
            context.local ??= {};
            context.result ??= {};
            context.local[name] = error.message;
            context.result[name] = error.message;
          }
  
          return {
            output: { [name || "result"]: error.message },
            next: false,
          };
        }
  
        // Flatten assistant text
        result = (json.output || [])
          .filter(item => item.type === "message" && item.role === "assistant")
          .flatMap(item =>
            (item.content || [])
              .filter(c => c.type === "output_text" && typeof c.text === "string")
              .map(c => c.text)
          )
          .join("\n");
  
        if (name) {
          context.local ??= {};
          context.result ??= {};
          context.local[name] = result;
          context.result[name] = result;
        }
  
        return {
          output: { [name || "result"]: result },
          next: true,
        };
  
      } catch (err) {
        const error = normalizeOpenAIError(err);
  
        // --- LOGGING ---
        console.error("❌ Exception during OpenAI call");
        console.error(error);
  
        context.error = error;
        context._lastError = error;
  
        if (name) {
          context.local ??= {};
          context.result ??= {};
          context.local[name] = error.message;
          context.result[name] = error.message;
        }
  
        return {
          output: { [name || "result"]: error.message },
          next: false,
        };
      }
    },
  };
  