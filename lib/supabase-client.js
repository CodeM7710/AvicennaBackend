import pkg from "@supabase/supabase-js";
const { createClient } = pkg;

export const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);