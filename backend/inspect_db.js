const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function inspectDb() {
  console.log("=== Testing Driver Status Update ===");
  try {
    const { data: drivers, error: err1 } = await supabase
      .from('driver')
      .select('id, status')
      .limit(1);
    if (err1) throw err1;
    if (drivers.length > 0) {
      const driverId = drivers[0].id;
      const originalStatus = drivers[0].status;
      console.log(`Original status for driver ${driverId}: ${originalStatus}`);
      
      const { data: updated, error: err2 } = await supabase
        .from('driver')
        .update({ status: 'Active' })
        .eq('id', driverId)
        .select('*');
      if (err2) {
        console.error("Update failed:", err2.message);
      } else {
        console.log("Update success! New status:", updated[0].status);
        // Reset it back
        await supabase.from('driver').update({ status: originalStatus }).eq('id', driverId);
      }
    }
  } catch (err) {
    console.error("Error:", err.message);
  }
}

inspectDb();

