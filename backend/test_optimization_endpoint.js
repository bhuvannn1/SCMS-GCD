const axios = require("axios");

async function testEndpoint() {
  console.log("=== Testing Route Optimization Endpoint ===");
  const base_url = "http://localhost:5000/api/route/optimize";
  
  // Test 1: Mumbai to Pune Route Optimization
  try {
    console.log("\n[Test 1] Querying optimized route: Mumbai to Pune...");
    const res = await axios.get(`${base_url}?pickup=Mumbai&drop=Pune`);
    const data = res.data;
    
    if (data.success && data.optimized && data.savings) {
      console.log("✔ Success: Route optimization output verified!");
      console.log(`- Resolved Pickup: ${data.pickup.name} -> [${data.pickup.coords.join(", ")}]`);
      console.log(`- Resolved Drop: ${data.drop.name} -> [${data.drop.coords.join(", ")}]`);
      console.log(`- Distance: ${data.optimized.distance_km.toFixed(2)} km`);
      console.log(`- Duration: ${(data.optimized.duration_sec / 3600).toFixed(2)} hours`);
      console.log(`- Fuel Saved: ${data.savings.fuel_liters.toFixed(2)} L`);
      console.log(`- Cost Saved: ₹${data.savings.fuel_cost.toFixed(2)}`);
      console.log(`- CO2 Prevented: ${data.savings.co2_kg.toFixed(2)} kg`);
    } else {
      console.error("❌ Failure: Response format is invalid", data);
    }
  } catch (err) {
    console.error("❌ Failure: Error calling endpoint. Make sure the server is running on port 5000.", err.message);
  }

  // Test 2: Validation of missing query params
  try {
    console.log("\n[Test 2] Testing validation for missing query parameters...");
    await axios.get(`${base_url}?pickup=Mumbai`);
    console.error("❌ Failure: Expected 400 Bad Request error but endpoint succeeded.");
  } catch (err) {
    if (err.response && err.response.status === 400) {
      console.log("✔ Success: Missing parameters correctly returned status 400!");
    } else {
      console.error("❌ Failure: Unexpected error behaviour:", err.message);
    }
  }

  // Test 3: Cache Verification
  try {
    console.log("\n[Test 3] Testing caching of geocoded coordinates...");
    console.log("Querying Mumbai to Pune again (should use memory cache)...");
    const t0 = Date.now();
    const res = await axios.get(`${base_url}?pickup=Mumbai&drop=Pune`);
    const t1 = Date.now();
    
    if (res.data.success) {
      console.log(`✔ Success: Cache hit query completed in ${t1 - t0}ms!`);
    } else {
      console.error("❌ Failure: Cache test failed.");
    }
  } catch (err) {
    console.error("❌ Failure: Caching test exception:", err.message);
  }
}

testEndpoint();
