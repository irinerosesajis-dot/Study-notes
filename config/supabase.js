const { createClient } = require("@supabase/supabase-js");

const supabaseUrl = process.env.SUPABASE_URL || "";
const supabaseKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_KEY || "";

let supabase = null;

if (!supabaseUrl || !supabaseKey) {
  console.warn("\n⚠️ WARNING: Supabase environment variables are missing in your .env file.");
  console.warn("Uploads and downloads of Notes & Question Banks to/from Supabase Storage will not function until they are set.\n");
} else {
  try {
    supabase = createClient(supabaseUrl, supabaseKey);
  } catch (err) {
    console.error("❌ ERROR: Failed to initialize Supabase client:", err.message);
  }
}

module.exports = { supabase };
