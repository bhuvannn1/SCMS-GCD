const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testRole(role, fullName) {
  const email = `test_${role}_${Date.now()}@ignis.com`;
  const password = "Password123!";
  
  console.log(`\n--- Testing user creation for role: ${role} ---`);

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: fullName }
  });

  if (authError) {
    console.error(`AUTH CREATE ERROR for ${role}:`, authError.message);
    return;
  }

  const userId = authData.user.id;
  console.log(`Auth user created. ID: ${userId}`);

  // 2. Upsert profile record
  console.log(`Attempting to upsert profile...`);
  const { error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email,
      role,
      full_name: fullName
    });

  if (profileError) {
    console.error(`PROFILE UPSERT ERROR for ${role}:`, profileError);
    await supabase.auth.admin.deleteUser(userId);
    return;
  }
  console.log("Profile upserted successfully.");

  // 3. Driver table insert if driver
  if (role === "driver") {
    console.log("Attempting to insert driver details...");
    const { error: driverError } = await supabase
      .from("driver")
      .insert({
        id: userId,
        license_number: "LIC12345",
        status: "Active",
        driver_name: fullName
      });

    if (driverError) {
      console.error(`DRIVER DETAILS INSERT ERROR:`, driverError);
      await supabase.from("profiles").delete().eq("id", userId);
      await supabase.auth.admin.deleteUser(userId);
      return;
    }
    console.log("Driver details inserted successfully.");
  }

  // Cleanup
  console.log(`Cleaning up test user for ${role}...`);
  if (role === "driver") {
    await supabase.from("driver").delete().eq("id", userId);
  }
  await supabase.from("profiles").delete().eq("id", userId);
  await supabase.auth.admin.deleteUser(userId);
  console.log(`Cleanup finished for ${role}.`);
}

async function run() {
  await testRole("buyer", "Test Buyer");
  await testRole("owner", "Test Owner (Seller)");
  await testRole("driver", "Test Driver");
}

run();
