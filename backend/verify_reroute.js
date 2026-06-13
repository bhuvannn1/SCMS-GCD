const { createClient } = require("@supabase/supabase-js");
const axios = require("axios");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runVerification() {
  console.log("=== Manual Override Reroute Verification ===");

  // 1. Fetch active load
  const { data: loads, error: loadErr } = await supabase
    .from("Load")
    .select("*")
    .neq("status", "Delivered")
    .limit(1);

  if (loadErr || !loads || loads.length === 0) {
    console.error("No active loads found to test with.", loadErr);
    return;
  }
  const load = loads[0];
  console.log(`Testing with Load: ${load.load_id}, current destination (drop): ${load.drop}, fleet_id: ${load.fleet_id}`);

  // 2. Fetch warehouses
  const { data: warehouses, error: whErr } = await supabase
    .from("warehouses")
    .select("id, name")
    .limit(2);

  if (whErr || !warehouses || warehouses.length < 2) {
    console.error("Need at least 2 warehouses in the db to run this test.", whErr);
    return;
  }

  const fromWh = warehouses[0];
  const toWh = warehouses[1];
  console.log(`Rerouting from '${fromWh.name}' (${fromWh.id}) to '${toWh.name}' (${toWh.id})`);

  // 3. Make HTTP request to local server
  try {
    const response = await axios.post("http://localhost:5000/api/warehouse/reroute", {
      truckId: load.load_id,
      fleetId: load.fleet_id,
      loadId: load.load_id,
      fromWarehouseId: fromWh.id,
      toWarehouseId: toWh.id,
      reason: `Automated test override reroute to ${toWh.name}`
    });

    console.log("API Response:", response.data);

    // 4. Verify DB updates
    // A. Check Load's new drop
    const { data: updatedLoad } = await supabase
      .from("Load")
      .select("drop")
      .eq("load_id", load.load_id)
      .single();

    console.log(`Updated Load destination in DB: ${updatedLoad?.drop} (Expected: ${toWh.name})`);

    // B. Check truck_reroutes log
    const { data: reroutes } = await supabase
      .from("truck_reroutes")
      .select("*")
      .eq("to_warehouse_id", toWh.id)
      .order("triggered_at", { ascending: false })
      .limit(1);

    console.log("Inserted truck_reroutes record:", reroutes);

    // C. Check warehouse_logs log
    const { data: whLogs } = await supabase
      .from("warehouse_logs")
      .select("*")
      .eq("warehouse_id", fromWh.id)
      .order("triggered_at", { ascending: false })
      .limit(1);

    console.log("Inserted warehouse_logs record:", whLogs);

    if (updatedLoad?.drop === toWh.name && reroutes.length > 0 && whLogs.length > 0) {
      console.log("\n>>> SUCCESS: All database changes verified successfully! <<<");
    } else {
      console.error("\n>>> FAILURE: Some database entries were missing or incorrect. <<<");
    }

  } catch (err) {
    console.error("API request failed:", err.response?.data || err.message);
  }
}

runVerification();
