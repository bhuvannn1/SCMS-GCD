const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const axios = require('axios');

async function testJoinQuery() {
  console.log("--- Fetching Supabase OpenAPI Schema for warehouses ---");
  try {
    const res = await axios.get(`${process.env.SUPABASE_URL}/rest/v1/?apikey=${process.env.SUPABASE_SERVICE_ROLE_KEY}`);
    const schema = res.data;
    console.log("warehouses definition:", JSON.stringify(schema.definitions.warehouses, null, 2));
  } catch (err) {
    console.error("Error fetching schema:", err.message);
  }
}

testJoinQuery();
