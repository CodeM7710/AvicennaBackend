import "dotenv/config";
import { supabase } from "./lib/supabase-client.js";

(async () => {
  try {
    const { data, error } = await supabase.from("flows").select("*");
    console.log("Supabase data:", data);
    console.log("Supabase error:", error);
  } catch (err) {
    console.error("Supabase fetch failed:", err);
  }
})();
