const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspect() {
  console.log("Supabase URL:", process.env.SUPABASE_URL);

  console.log("\n=== Checking auth.users ===");
  const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
  if (authError) {
    console.error("Error listing auth users:", authError.message);
  } else {
    console.log(`Found ${users.length} auth users:`);
    users.forEach(u => console.log(`- ID: ${u.id}, Email: ${u.email}, Role: ${u.user_metadata?.role}`));
  }

  console.log("\n=== Checking profiles ===");
  const { data: profiles, error: profileError } = await supabase.from("profiles").select("*");
  if (profileError) {
    console.error("Error listing profiles:", profileError.message);
  } else {
    console.log(`Found ${profiles.length} profiles:`);
    profiles.forEach(p => console.log(`- ID: ${p.id}, Email: ${p.email}, Role: ${p.role}, Name: ${p.full_name}`));
  }

  console.log("\n=== Checking drivers ===");
  const { data: drivers, error: driverError } = await supabase.from("driver").select("*");
  if (driverError) {
    console.error("Error listing drivers:", driverError.message);
  } else {
    console.log(`Found ${drivers.length} drivers:`);
    drivers.forEach(d => console.log(`- ID: ${d.id}, License: ${d.license_number}, Name: ${d.driver_name}`));
  }
}

inspect();
