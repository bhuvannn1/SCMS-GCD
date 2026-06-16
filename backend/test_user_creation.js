const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testUserCreation() {
  const email = `test_buyer_${Date.now()}@ignis.com`;
  const password = "Password123!";
  const role = "buyer";
  const fullName = "Test Buyer";

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

  // 2. Insert profile record
  console.log("Attempting to insert profile record...");
  const { data: profileData, error: profileError } = await supabase
    .from("profiles")
    .insert([{
      id: userId,
      email,
      role,
      full_name: fullName
    }])
    .select();

  if (profileError) {
    console.error("2. PROFILE CREATE ERROR:", profileError);
    // Cleanup auth user to avoid clutter
    await supabase.auth.admin.deleteUser(userId);
    return;
  }

  console.log("2. Profile record created successfully:", profileData);

  // 3. Clean up
  console.log("Cleaning up test user...");
  const { error: profileDeleteErr } = await supabase.from("profiles").delete().eq("id", userId);
  if (profileDeleteErr) console.error("Profile cleanup error:", profileDeleteErr.message);
  
  const { error: authDeleteErr } = await supabase.auth.admin.deleteUser(userId);
  if (authDeleteErr) console.error("Auth cleanup error:", authDeleteErr.message);
  
  console.log("Clean up finished.");
}

testUserCreation();
