export default {
    name: "manipulateImage",
    description:
      "Applies filters to an image using Sharp and uploads result to Vercel Blob.",
  
    schema: {
      inputs: ["imageUrl", "operation", "amount", "level", "blur", "referenceVar"],
      outputs: ["next"],
      category: "image",
    },
  
    async run(node, req, res, context = {}) {
      const d = node.data || {};
      const { interpolate } = await import("../lib/vars.js");
      const sharp = (await import("sharp")).default;
  
      const imageUrl = interpolate(d.imageUrl || "", context);
      const op = (d.operation || "").trim();
      const name = (d.referenceVar || "").trim();
  
      const amount = d.amount ? interpolate(d.amount, context) : null;
      const level = d.level ? interpolate(d.level, context) : null;
      const blurAmount = d.blur ? interpolate(d.blur, context) : null;
  
      if (!imageUrl) {
        console.warn("⚠️ manipulateImage: No imageUrl provided");
        return { output: null };
      }
  
      // === Fetch remote image ===
      let inputBuffer;
      try {
        const r = await fetch(imageUrl);
  
        if (!r.ok) {
          throw new Error(`Fetch failed with status ${r.status}`);
        }
  
        inputBuffer = Buffer.from(await r.arrayBuffer());
      } catch (err) {
        console.error("❌ Failed to fetch image:", err);
        return { output: null };
      }
  
      let img = sharp(inputBuffer);
  
      // === Apply operation ===
      try {
        switch (op) {
          case "brightness": {
            const val = parseFloat(amount) / 100 || 1;
            console.log("→ brightness val:", val);
            img = img.modulate({ brightness: val });
            break;
          }
  
          case "contrast": {
            const val = parseFloat(amount) / 100 || 1;
            console.log("→ contrast val:", val);
            img = img.linear(val, -(128 * (val - 1)));
            break;
          }
  
          case "saturation": {
            const val = parseFloat(amount) / 100 || 1;
            console.log("→ saturation val:", val);
            img = img.modulate({ saturation: val });
            break;
          }
  
          case "grayscale": {
            console.log("→ grayscale");
            img = img.grayscale();
            if (level) {
              const pct = parseFloat(level) / 100 || 1;
              console.log("→ grayscale level:", pct);
              if (pct < 1) img = img.modulate({ saturation: 1 - pct });
            }
            break;
          }
  
          case "invert": {
            console.log("→ invert");
            img = img.negate();
            if (level) {
              const pct = parseFloat(level) / 100 || 1;
              console.log("→ invert level:", pct);
              if (pct < 1) img = img.linear(pct, 0);
            }
            break;
          }
  
          case "blur": {
            const px = parseFloat(blurAmount) || 0;
            console.log("→ blur px:", px);
            img = img.blur(px);
            break;
          }
  
          case "hue": {
            const deg = parseFloat(amount) || 0;
            console.log("→ hue deg:", deg);
            img = img.modulate({ hue: deg });
            break;
          }
  
          default:
            console.warn("⚠️ Unknown image operation:", op);
        }
      } catch (err) {
        console.error("❌ Sharp processing error:", err);
      }
  
    // === Export final buffer (with metadata detection) ===
    let buffer;
    try {
    const metadata = await img.metadata();

    if (metadata.format === "svg") {
        buffer = await img.webp().toBuffer();
    } else if (metadata.pages && metadata.pages > 1) {
        buffer = await img.webp().toBuffer();
    } else {
        buffer = await img.png().toBuffer();
    }
    } catch (err) {
    console.error("❌ Failed to export image:", err);
    return { output: null };
    }

  
      // === Upload to Vercel Blob ===
      const { put } = await import("@vercel/blob");
  
      console.log("📡 Uploading to Vercel Blob...");
      console.log("📡 Using token:", process.env.MANIP_IMAGES_READ_WRITE_TOKEN ? "(present)" : "(MISSING!)");
  
      let uploaded;
      try {
        uploaded = await put(
          `manipulated/${Date.now()}.png`,
          buffer,
          {
            access: "public",
            token: process.env.MANIP_IMAGES_READ_WRITE_TOKEN
          }
        );
  
        console.log("🟢 Blob upload response:", uploaded);
      } catch (err) {
        console.error("❌ Vercel Blob upload failed:", err);
        return { output: null };
      }
  
      const finalUrl = uploaded.url;
      console.log("📎 Final image URL:", finalUrl);
  
      // === Save result variable ===
      if (name) {
        console.log("💾 Saving result variable:", `result.${name}`);
  
        if (!context.local) context.local = {};
        if (!context.result) context.result = {};
  
        context.local[name] = finalUrl;
        context.result[name] = finalUrl;
      }
  
      console.log("=== 🟩 manipulateImage END ===");
  
      return {
        output: { [name || "imageUrl"]: finalUrl },
        next: true,
      };
    },
  };