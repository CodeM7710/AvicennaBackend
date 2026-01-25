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

/* --- Normalize Resend errors --- */
function normalizeResendError(err, responseJson) {
  return {
    source: "resend",
    type: responseJson?.name || "api_error",
    code: responseJson?.code || null,
    message:
      responseJson?.message ||
      err.message ||
      "Unknown Resend error",
    status: err.status || null,
  };
}

export default {
  name: "sendEmail",
  description: "Send an email using Resend",
  schema: {
    inputs: ["to", "from", "subject", "body"],
    outputs: ["next"],
    category: "email",
  },

  async run(node, req, res, context = {}) {
    const d = node.data || {};
    const { interpolate } = await import("../lib/vars.js");

    const to = interpolate(d.to || "", context);
    const from = interpolate(d.from || "", context);
    const subject = interpolate(d.subject || "", context);
    const body = interpolate(d.body || "", context);

    if (!to || !from || !subject || !body) {
      return { output: null };
    }

    const userId = context.flow?.user_id;
    if (!userId) throw new Error("Unauthorized");

    const { data, error } = await supabase
      .from("user_settings")
      .select("integrations")
      .eq("user_id", userId)
      .single();

    if (error) throw error;

    const resend = data.integrations?.resend;
    if (!resend?.api_key) {
      throw new Error("Resend integration not enabled");
    }

    const RESEND_API_KEY = decrypt(resend.api_key);

    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          to,
          from,
          subject,
          html: body,
        }),
      });

      const json = await response.json();

      if (!response.ok) {
        const error = normalizeResendError(
          { status: response.status },
          json
        );

        // --- LOGGING ---
        console.error("❌ Resend request failed");
        console.error("Status:", response.status);
        console.error("Response:", JSON.stringify(json, null, 2));

        context.error = error;
        context._lastError = error;

        return {
          output: error.message,
          next: false,
        };
      }

      const result = {
        id: json.id,
        to,
        subject,
        status: "sent",
      };

      return {
        output: result,
        next: true,
      };

    } catch (err) {
      const error = normalizeResendError(err);

      // --- LOGGING ---
      console.error("❌ Exception during Resend call");
      console.error(error);

      context.error = error;
      context._lastError = error;

      return {
        output: error.message,
        next: false,
      };
    }
  },
};
