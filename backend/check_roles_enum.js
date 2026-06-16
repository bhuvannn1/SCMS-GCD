const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEnum() {
  console.log("Querying database schema...");
  
  // Query pg_enum to get enum values
  const { data: enumData, error: enumError } = await supabase
    .rpc("get_enum_values"); // If get_enum_values RPC exists

  if (enumError) {
    console.log("get_enum_values RPC not found or failed, trying raw query via custom select...");
  } else {
    console.log("Enum values from RPC:", enumData);
  }

  // We can select the column definition from information_schema
  // We can query pg_type/pg_enum tables by mapping them or doing a select on pg_catalog if exposed.
  // Wait, let's try a direct RPC run or select from info schema:
  try {
    const { data: cols, error: colErr } = await supabase
      .from("profiles")
      .select("role")
      .limit(1);
    console.log("Profiles role column exists. Example select:", cols, colErr);
  } catch (e) {
    console.error("Profiles query failed:", e);
  }
}

async function testVariousMetadataRoles() {
  const roles = ["seller", "owner", "admin", "buyer", "driver"];
  for (const role of roles) {
    const email = `test_meta_${role}_${Date.now()}@ignis.com`;
    const password = "Password123!";
    console.log(`\nTesting auth.admin.createUser with role: '${role}'...`);
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name: `Test ${role}` }
    });
    if (error) {
      console.log(`❌ Failed for '${role}':`, error.message);
    } else {
      console.log(`✅ Succeeded for '${role}'!`);
      // clean up
      await supabase.auth.admin.deleteUser(data.user.id);
    }
  }
}

async function run() {
  await testVariousMetadataRoles();
}

run();
