const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  const { data: profiles, error: err1 } = await supabase.from('profiles').select('email, role');
  console.log("profiles:", data = profiles);
}

inspect();
