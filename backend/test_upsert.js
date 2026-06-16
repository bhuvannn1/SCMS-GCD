const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUpsert() {
  const email = `test_buyer_upsert_${Date.now()}@ignis.com`;
  const password = "Password123!";
  const role = "buyer";
  const fullName = "Test Buyer Upsert";

  console.log(`Attempting to create test user: ${email}...`);

  // 1. Create auth user
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { role, full_name: fullName }
  });

  if (authError) {
    console.error("1. AUTH CREATE ERROR:", authError);
    return;
  }

  const userId = authData.user.id;
  console.log("1. Auth user created successfully. ID:", userId);

  // Check if profile was already inserted by a trigger
  const { data: existingProfile } = await supabase.from("profiles").select("*").eq("id", userId).maybeSingle();
  if (existingProfile) {
    console.log("Found profile already inserted (likely by database trigger):", existingProfile);
  } else {
    console.log("No profile found yet.");
  }

  // 2. Upsert profile record
  console.log("Attempting to upsert profile record...");
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .upsert({
      id: userId,
      email,
      role,
      full_name: fullName
    })
    .select();

  if (profileError) {
    console.error("2. PROFILE UPSERT ERROR:", profileError);
    await supabase.auth.admin.deleteUser(userId);
    return;
  }

  console.log("2. Profile record upserted successfully:", profileData);

  // 3. Clean up
  console.log("Cleaning up test user...");
  await supabase.from("profiles").delete().eq("id", userId);
  await supabase.auth.admin.deleteUser(userId);
  console.log("Clean up finished.");
}

testUpsert();
