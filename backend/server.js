const dotenv = require("dotenv");
dotenv.config();

const express = require("express");
const Razorpay = require("razorpay");
const cors = require("cors");
const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "https://scms-gcd.vercel.app",
  ...(process.env.FRONTEND_URL
    ? process.env.FRONTEND_URL.split(",").map((u) => u.trim())
    : [])
];

const corsOptions = {
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    const isAllowed = allowedOrigins.includes(origin) || origin.endsWith(".vercel.app");
    if (isAllowed) {
      callback(null, true);
    } else {
      callback(new Error(`CORS policy blockage for origin: ${origin}`));
    }
  },
  credentials: true
};

app.use(cors(corsOptions));
app.use(express.json());

// ── Razorpay instance ────────────────────────────────────────────────────────
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ── Helper: generate invoice number ─────────────────────────────────────────
const generateInvoiceNumber = () => {
  const now = new Date();
  const year = now.getFullYear();
  const ms   = Date.now().toString().slice(-6); // last 6 digits of timestamp
  return `INV-${year}-${ms}`;
};

// ────────────────────────────────────────────────────────────────────────────
// POST /api/payment/assign-amount
// Seller assigns a payment amount to an order.
// Body: { load_id: string, amount: number }
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/payment/assign-amount", async (req, res) => {
  try {
    const { load_id, amount } = req.body;

    if (!load_id || amount === undefined || amount === null) {
      return res.status(400).json({ error: "load_id and amount are required" });
    }

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      return res.status(400).json({ error: "Amount must be a positive number" });
    }

    if (parsedAmount > 1000000) {
      return res.status(400).json({ error: "Amount cannot exceed Razorpay transaction limit of ₹10,00,000" });
    }

    const { error } = await supabase
      .from("Load")
      .update({ buyer_amount: parsedAmount })
      .eq("load_id", load_id);

    if (error) {
      console.error("ASSIGN AMOUNT ERROR:", error);
      return res.status(500).json({ error: error.message });
    }

    res.json({ success: true, load_id, buyer_amount: parsedAmount });
  } catch (err) {
    console.error("ASSIGN AMOUNT EXCEPTION:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/payment/create-order
// Creates a Razorpay order for the given amount (in INR).
// Body: { amount: number, user_id: string, order_id?: string }
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/payment/create-order", async (req, res) => {
  try {
    const { amount } = req.body;

    if (!amount || isNaN(parseFloat(amount)) || parseFloat(amount) <= 0) {
      return res.status(400).json({ error: "Valid amount is required" });
    }

    const order = await razorpay.orders.create({
      amount: Math.round(parseFloat(amount) * 100), // convert INR → paise
      currency: "INR",
      receipt: "receipt_" + Date.now(),
    });

    res.json(order);
  } catch (err) {
    console.error("CREATE ORDER ERROR:", err);
    res.status(500).json({ error: err.message || "Error creating order" });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/payment/verify
// Verifies Razorpay signature, saves payment + invoice, updates Load status.
// Body: { razorpay_order_id, razorpay_payment_id, razorpay_signature,
//          user_id, amount, order_id? }
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/payment/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      user_id,
      amount,
      order_id
    } = req.body;

    // ── Step 1: Verify HMAC signature ───────────────────────────────────────
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(razorpay_order_id + "|" + razorpay_payment_id)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: "Invalid payment signature" });
    }

    // ── Step 2: Save to payments table ──────────────────────────────────────
    const isUUID = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
    const isOrderUuid = order_id && isUUID(order_id);

    const { error: payError } = await supabase.from("payments").insert([{
      order_id: isOrderUuid ? order_id : null,
      user_id,
      razorpay_order_id,
      razorpay_payment_id,
      amount,
      status: "success"
    }]);

    if (payError) {
      console.error("PAYMENTS INSERT ERROR:", payError);
      return res.status(500).json({ error: payError.message });
    }

    // ── Step 3: Generate invoice number and save to invoices table ──────────
    const invoiceNumber = generateInvoiceNumber();

    const { error: invError } = await supabase.from("invoices").insert([{
      load_id:              order_id || null,
      buyer_id:             user_id  || null,
      razorpay_order_id,
      razorpay_payment_id,
      amount,
      invoice_number:       invoiceNumber,
    }]);

    if (invError) {
      // Non-fatal: log but don't fail — payment is already verified
      console.warn("INVOICES INSERT WARNING:", invError.message);
    }

    // ── Step 4: Update Load row status (non-fatal if it fails) ──────────────
    if (order_id) {
      const updatePayload = {
        status:          "Confirmed",
        payment_status:  "paid"
      };

      const { error: loadError } = await supabase
        .from("Load")
        .update(updatePayload)
        .eq("load_id", order_id);

      if (loadError) {
        console.warn("LOAD UPDATE WARNING:", loadError.message);
      }
    }

    res.json({ success: true, invoice_number: invoiceNumber });

  } catch (err) {
    console.error("VERIFY EXCEPTION:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/warehouse/reroute
// Reroutes a truck from one warehouse to another.
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/warehouse/reroute", async (req, res) => {
  try {
    const { truckId, fleetId, loadId, fromWarehouseId, toWarehouseId, reason } = req.body;

    if (!truckId || !fromWarehouseId || !toWarehouseId) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }

    // 1. Update truck's destination (bypass if table doesn't exist)
    try {
      const { error: truckError } = await supabase
        .from("trucks")
        .update({ warehouse_id: toWarehouseId })
        .eq("id", truckId);
      if (truckError && truckError.code !== "PGRST205") {
        throw truckError;
      }
    } catch (e) {
      console.warn("Bypassed trucks table update:", e.message);
    }

    // 1.5 Update Load destination if loadId / truckId (as load_id) is provided
    const finalLoadId = loadId || (truckId && truckId.startsWith("ORD-") ? truckId : null);
    if (finalLoadId) {
      const { data: whData } = await supabase
        .from("warehouses")
        .select("name")
        .eq("id", toWarehouseId)
        .single();
      
      if (whData?.name) {
        const { error: loadError } = await supabase
          .from("Load")
          .update({ drop: whData.name })
          .eq("load_id", finalLoadId);
        if (loadError) {
          console.error("LOAD UPDATE ERROR during reroute:", loadError.message);
        } else {
          console.log(`Successfully updated load ${finalLoadId} destination drop to ${whData.name}`);
        }
      }
    }

    // 2. Log in truck_reroutes
    const isUUID = (str) => /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/.test(str);
    const validFleetId = fleetId && isUUID(fleetId) ? fleetId : null;

    const { error: rerouteError } = await supabase
      .from("truck_reroutes")
      .insert([{
        fleet_id:          validFleetId,
        from_warehouse_id: fromWarehouseId,
        to_warehouse_id:   toWarehouseId,
        reason,
      }]);

    if (rerouteError) throw rerouteError;

    // 3. Log in warehouse_logs
    const { error: logError } = await supabase
      .from("warehouse_logs")
      .insert([{
        warehouse_id: fromWarehouseId,
        event_type:   "reroute",
        message:      `Truck ${truckId} rerouted to ${toWarehouseId}. Reason: ${reason}`,
      }]);

    if (logError) throw logError;

    res.json({ success: true, message: `Truck ${truckId} successfully rerouted.` });

  } catch (err) {
    console.error("REROUTE ERROR:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/admin/create-user
// Creates an auth user + profile + driver record using admin service role.
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/admin/create-user", async (req, res) => {
  try {
    const { email, password, full_name, display_name, phone, role, license_number, status } = req.body;
    const resolvedName = full_name || display_name;

    if (!email || !password || !role || !resolvedName) {
      return res.status(400).json({ error: "Email, password, role, and name/full_name are required." });
    }

    // 1. Create auth user
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { role, full_name: resolvedName, display_name: resolvedName }
    });

    if (authError) {
      console.error("AUTH CREATE ERROR:", authError);
      return res.status(500).json({ error: authError.message });
    }

    const userId = authData.user.id;

    // 2. Upsert profile record
    const { error: profileError } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        email,
        role,
        full_name: resolvedName,
        phone: phone || null
      });

    if (profileError) {
      console.error("PROFILE CREATE ERROR:", profileError);
      return res.status(500).json({ error: profileError.message });
    }

    // 3. Insert driver metadata if role is driver
    if (role === "driver") {
      const { error: driverError } = await supabase
        .from("driver")
        .insert({
          id: userId,
          license_number: license_number || null,
          status: status || "Active",
          driver_name: full_name
        });

      if (driverError) {
        console.error("DRIVER DETAILS CREATE ERROR:", driverError);
        return res.status(500).json({ error: driverError.message });
      }
    }

    res.json({ success: true, user_id: userId });
  } catch (err) {
    console.error("CREATE USER EXCEPTION:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/driver/onboard
// Onboards/updates a driver's profiles, driver metadata, and Fleet details.
// Bypasses RLS using the backend service role client.
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/driver/onboard", async (req, res) => {
  try {
    const { userId, fullName, phone, licenseNumber, vehicleNumber, location, status, driverStatus, verificationStatus } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    // 1. Update profiles table
    if (fullName !== undefined || phone !== undefined) {
      const updateObj = {};
      if (fullName !== undefined) updateObj.full_name = fullName;
      if (phone !== undefined) updateObj.phone = phone;

      const { error: profError } = await supabase
        .from("profiles")
        .update(updateObj)
        .eq("id", userId);

      if (profError) {
        console.error("ONBOARD PROFILE ERROR:", profError);
        return res.status(500).json({ error: profError.message });
      }
    }

    // 2. Upsert driver table
    if (licenseNumber !== undefined || verificationStatus !== undefined || fullName !== undefined || status !== undefined) {
      // First check if driver already exists to preserve fields
      const { data: existingDriver } = await supabase
        .from("driver")
        .select("license_number, status, driver_name, verified")
        .eq("id", userId)
        .maybeSingle();

      const finalLicense = licenseNumber !== undefined ? licenseNumber : (existingDriver?.license_number || "N/A");
      const finalDriverName = fullName !== undefined ? fullName : (existingDriver?.driver_name || "N/A");

      // Status column in database only accepts 'Active' or 'Inactive'
      let currentStatus = existingDriver?.status || "Active";
      if (status !== undefined) {
        currentStatus = status; // 'Active' or 'Inactive'
      }

      // Determine verification boolean
      let isVerified = existingDriver?.verified || false;
      if (verificationStatus === "Verified") {
        isVerified = true;
      }

      const { error: driverError } = await supabase
        .from("driver")
        .upsert({
          id: userId,
          license_number: finalLicense,
          status: currentStatus,
          driver_name: finalDriverName,
          verified: isVerified
        });

      if (driverError) {
        console.error("ONBOARD DRIVER ERROR:", driverError);
        return res.status(500).json({ error: driverError.message });
      }
    }

    // 3. Upsert Fleet table
    if (vehicleNumber !== undefined || location !== undefined || status !== undefined) {
      // Check if vehicle exists for driver_id to reuse or insert
      const { data: existingByDriver } = await supabase
        .from("Fleet")
        .select("id, vehicle_number, location, status")
        .eq("driver_id", userId)
        .maybeSingle();

      // Check if vehicle exists with this vehicleNumber
      let existingByNumber = null;
      if (vehicleNumber) {
        const { data: fleetNumRow } = await supabase
          .from("Fleet")
          .select("id, vehicle_number, location, status")
          .eq("vehicle_number", vehicleNumber)
          .maybeSingle();
        existingByNumber = fleetNumRow;
      }

      const activeExisting = existingByDriver || existingByNumber;

      // Map Active/Inactive status from frontend to Running/Stopped in Fleet DB table
      let mappedFleetStatus = "Stopped";
      if (status === "Active" || status === "Running") {
        mappedFleetStatus = "Running";
      } else if (status === "Inactive" || status === "Stopped") {
        mappedFleetStatus = "Stopped";
      } else if (status !== undefined) {
        mappedFleetStatus = status; // Keep other statuses like Maintenance if passed
      } else {
        mappedFleetStatus = activeExisting?.status || "Running";
      }

      const fleetPayload = {
        vehicle_number: vehicleNumber !== undefined ? vehicleNumber : (activeExisting?.vehicle_number || "N/A"),
        driver_id: userId,
        location: location !== undefined ? location : (activeExisting?.location || "N/A"),
        status: mappedFleetStatus
      };

      if (activeExisting?.id) {
        fleetPayload.id = activeExisting.id;
      }

      const { error: fleetError } = await supabase
        .from("Fleet")
        .upsert(fleetPayload);

      if (fleetError) {
        console.error("ONBOARD FLEET ERROR:", fleetError);
        return res.status(500).json({ error: fleetError.message });
      }
    }

    res.json({ success: true });
  } catch (err) {
    console.error("ONBOARD EXCEPTION:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/buyer-warehouses
// Fetch all destination warehouses for a given buyer.
// Query: buyer_id
// ────────────────────────────────────────────────────────────────────────────
app.get("/api/buyer-warehouses", async (req, res) => {
  try {
    const { buyer_id } = req.query;
    if (!buyer_id) return res.status(400).json({ error: "buyer_id is required" });

    const { data, error } = await supabase
      .from("buyer_warehouses")
      .select("*")
      .eq("buyer_id", buyer_id)
      .order("is_default", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ warehouses: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/buyer-warehouses/all
// Fetch all buyer destination warehouses (for sellers to see when assigning drops).
// ────────────────────────────────────────────────────────────────────────────
app.get("/api/buyer-warehouses/all", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("buyer_warehouses")
      .select(`
        *,
        buyer:profiles!buyer_id(full_name, email)
      `)
      .order("created_at", { ascending: false });

    if (error) return res.status(500).json({ error: error.message });
    res.json({ warehouses: data || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/buyer-warehouses
// Create a new buyer destination warehouse.
// Body: { buyer_id, name, address, city, state, pincode, contact_name, contact_phone, notes, is_default }
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/buyer-warehouses", async (req, res) => {
  try {
    const { buyer_id, name, address, city, state, pincode, contact_name, contact_phone, notes, is_default } = req.body;

    if (!buyer_id || !name || !address || !city) {
      return res.status(400).json({ error: "buyer_id, name, address, and city are required" });
    }

    // If setting as default, unset all existing defaults first
    if (is_default) {
      await supabase
        .from("buyer_warehouses")
        .update({ is_default: false })
        .eq("buyer_id", buyer_id);
    }

    const { data, error } = await supabase
      .from("buyer_warehouses")
      .insert({
        buyer_id,
        name,
        address,
        city,
        state: state || null,
        pincode: pincode || null,
        contact_name: contact_name || null,
        contact_phone: contact_phone || null,
        notes: notes || null,
        is_default: is_default || false
      })
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, warehouse: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// PUT /api/buyer-warehouses/:id
// Update a buyer destination warehouse.
// ────────────────────────────────────────────────────────────────────────────
app.put("/api/buyer-warehouses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { buyer_id, name, address, city, state, pincode, contact_name, contact_phone, notes, is_default } = req.body;

    if (!id) return res.status(400).json({ error: "id is required" });

    // If setting as default, unset all existing defaults first
    if (is_default && buyer_id) {
      await supabase
        .from("buyer_warehouses")
        .update({ is_default: false })
        .eq("buyer_id", buyer_id);
    }

    const updatePayload = {};
    if (name !== undefined) updatePayload.name = name;
    if (address !== undefined) updatePayload.address = address;
    if (city !== undefined) updatePayload.city = city;
    if (state !== undefined) updatePayload.state = state;
    if (pincode !== undefined) updatePayload.pincode = pincode;
    if (contact_name !== undefined) updatePayload.contact_name = contact_name;
    if (contact_phone !== undefined) updatePayload.contact_phone = contact_phone;
    if (notes !== undefined) updatePayload.notes = notes;
    if (is_default !== undefined) updatePayload.is_default = is_default;

    const { data, error } = await supabase
      .from("buyer_warehouses")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single();

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true, warehouse: data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// DELETE /api/buyer-warehouses/:id
// Delete a buyer destination warehouse.
// ────────────────────────────────────────────────────────────────────────────
app.delete("/api/buyer-warehouses/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) return res.status(400).json({ error: "id is required" });

    const { error } = await supabase
      .from("buyer_warehouses")
      .delete()
      .eq("id", id);

    if (error) return res.status(500).json({ error: error.message });
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Cache for geocoded locations
const geocodeCache = new Map();

// Helper to resolve coordinates
async function getCoords(locationStr) {
  if (!locationStr) return null;
  const cleanedStr = locationStr.trim();
  const lowerStr = cleanedStr.toLowerCase();
  
  // 1. Parse coordinate strings like "12.9716, 77.5946" or "12.9716 77.5946"
  const coordRegex = /^\s*(-?\d+(?:\.\d+)?)\s*[\s,]\s*(-?\d+(?:\.\d+)?)\s*$/;
  const match = cleanedStr.match(coordRegex);
  if (match) {
    return [parseFloat(match[1]), parseFloat(match[2])];
  }
  
  // 2. Check cache
  const cached = geocodeCache.get(lowerStr);
  if (cached) return cached;
  
  // 3. Database lookup for warehouse names
  // Extract main name in case of "Central Warehouse – Bangalore"
  const cleanName = cleanedStr.split(/[–-]/)[0].trim();
  try {
    const { data: wh } = await supabase
      .from("warehouses")
      .select("lat, lng")
      .ilike("name", cleanName)
      .maybeSingle();
    if (wh && wh.lat && wh.lng) {
      const coords = [parseFloat(wh.lat), parseFloat(wh.lng)];
      geocodeCache.set(lowerStr, coords);
      return coords;
    }
  } catch (e) {
    console.warn("DB warehouse check bypassed or failed:", e.message);
  }
  
  // 4. Geocode using Nominatim API
  const query = cleanedStr.toLowerCase().includes("india") ? cleanedStr : `${cleanedStr}, India`;
  const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(query)}`;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "SCMS-GCD-Route-Optimizer/1.0 (antigravity@gemini.google)"
      }
    });
    const data = await res.json();
    if (data && data.length > 0) {
      const coords = [parseFloat(data[0].lat), parseFloat(data[0].lon)];
      geocodeCache.set(lowerStr, coords);
      return coords;
    }
  } catch (err) {
    console.error("Nominatim geocoding error:", err.message);
  }
  
  // 5. Fallback dictionary for major hubs
  if (lowerStr.includes("mumbai")) return [19.0760, 72.8777];
  if (lowerStr.includes("pune")) return [18.5204, 73.8567];
  if (lowerStr.includes("bangalore") || lowerStr.includes("bengaluru")) return [12.9716, 77.5946];
  if (lowerStr.includes("delhi") || lowerStr.includes("noida") || lowerStr.includes("gurgaon")) return [28.7041, 77.1025];
  if (lowerStr.includes("chennai")) return [13.0827, 80.2707];
  if (lowerStr.includes("hyderabad")) return [17.3850, 78.4867];
  if (lowerStr.includes("kolkata")) return [22.5726, 88.3639];
  if (lowerStr.includes("ahmedabad")) return [23.0225, 72.5714];
  if (lowerStr.includes("jaipur")) return [26.9124, 75.7873];
  
  return null;
}

// GET /api/route/optimize
app.get("/api/route/optimize", async (req, res) => {
  try {
    const { pickup, drop } = req.query;
    if (!pickup || !drop) {
      return res.status(400).json({ error: "pickup and drop query parameters are required" });
    }
    
    const pickupCoords = await getCoords(pickup);
    const dropCoords = await getCoords(drop);
    
    if (!pickupCoords || !dropCoords) {
      return res.status(404).json({ error: "Failed to resolve coordinates for pickup or drop location." });
    }
    
    // OSRM expects coordinates as lon,lat;lon,lat
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson`;
    
    const osrmRes = await fetch(osrmUrl);
    const osrmData = await osrmRes.json();
    
    if (osrmData.code !== 'Ok' || !osrmData.routes || osrmData.routes.length === 0) {
      return res.status(502).json({ error: "Failed to calculate road route from routing engine." });
    }
    
    const route = osrmData.routes[0];
    const distanceKm = route.distance / 1000;

    // ─────────────────────────────────────────────────────────────────────────
    // INDIA PRACTICAL LOGISTICS FORMULA — Single Driver, Dedicated FTL Truck
    // Sources: Motor Vehicles Act, OSRM road distance, industry standard rates
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Terrain classifier: hilly routes add significant driving time.
     * We approximate ghat/hill % by geography (lat/lng bounding boxes).
     * Known hilly corridors: Western Ghats (BLR-MUM, BLR-GOA),
     *   Northeast (any route east of ~91°E), J&K (routes above ~32°N lat).
     */
    function classifyTerrain(p, d) {
      const [pLat, pLng] = p;
      const [dLat, dLng] = d;
      // Northeast India corridor (Guwahati, Shillong, Agartala, etc.)
      if (pLng > 91 || dLng > 91) return { plainFraction: 0.30, hillyFraction: 0.70 };
      // Jammu & Kashmir corridor
      if ((pLat > 32 || dLat > 32) && (pLng < 78 || dLng < 78)) return { plainFraction: 0.40, hillyFraction: 0.60 };
      // Western Ghat corridor: Bangalore ↔ Mumbai, Bangalore ↔ Goa, Hyderabad ↔ Goa
      const blrLat = [12.5, 13.5]; const blrLng = [77.3, 78.0];
      const mumLat = [18.8, 19.4]; const mumLng = [72.6, 73.2];
      const isBlr = pLat >= blrLat[0] && pLat <= blrLat[1] && pLng >= blrLng[0] && pLng <= blrLng[1];
      const isDestBlr = dLat >= blrLat[0] && dLat <= blrLat[1] && dLng >= blrLng[0] && dLng <= blrLng[1];
      const isMum = (pLat >= mumLat[0] && pLat <= mumLat[1] && pLng >= mumLng[0] && pLng <= mumLng[1]);
      const isDestMum = (dLat >= mumLat[0] && dLat <= mumLat[1] && dLng >= mumLng[0] && dLng <= mumLng[1]);
      if ((isBlr && isDestMum) || (isMum && isDestBlr)) return { plainFraction: 0.60, hillyFraction: 0.40 };
      // Default: plain highway (NH-44, NH-48, etc.)
      return { plainFraction: 1.00, hillyFraction: 0.00 };
    }

    const terrain = classifyTerrain(pickupCoords, dropCoords);

    // Speed by terrain (loaded heavy truck averages)
    const SPEED_PLAIN_KMH  = 45; // NH national highways, flat terrain
    const SPEED_HILLY_KMH  = 25; // Ghat sections, mountain passes

    // Fuel efficiency by terrain (loaded 10–16 wheeler)
    const MILEAGE_PLAIN_KMPL = 4.0; // km per liter, plain highway
    const MILEAGE_HILLY_KMPL = 2.5; // km per liter, ghat/mountain terrain

    // Cost & emission constants
    const FUEL_PRICE       = 98.0; // INR per liter (all-India avg Jun 2025)
    const CO2_COEFFICIENT  = 2.68; // kg CO₂ per liter diesel (IPCC standard)

    // ── Step 1: Pure Driving Time (by terrain split) ──────────────────────────
    const plainKm = distanceKm * terrain.plainFraction;
    const hillyKm = distanceKm * terrain.hillyFraction;
    const pureDriverHours = (plainKm / SPEED_PLAIN_KMH) + (hillyKm / SPEED_HILLY_KMH);

    // ── Step 2: Short Breaks — 30 min every 200 km (tea/tyre cooldown) ────────
    const shortBreaks = Math.floor(distanceKm / 200);
    const shortBreakHours = shortBreaks * 0.5;

    // ── Step 3: Meal Breaks — 1 hour every 400 km (dhaba stop + vehicle check) -
    const mealBreaks = Math.floor(distanceKm / 400);
    const mealBreakHours = mealBreaks * 1.0;

    // ── Step 4: Mandatory Overnight Rest — 8 hours per every 8h of driving ────
    // Legal limit: Motor Vehicles Act — max 8h drive/day, single driver
    const overnightRestStops = Math.floor(pureDriverHours / 8);
    const overnightRestHours = overnightRestStops * 8;

    // ── Step 5: Checkpoint / Border / City No-Entry Delays ────────────────────
    // 1.5h per every 500km: state borders, RTO weighbridges, city no-entry hours
    const checkpointStops = Math.floor(distanceKm / 500);
    const checkpointHours = checkpointStops * 1.5;

    // ── Total Logistical Transit Time (Strict Formula) ────────────────────────
    const totalDistance = distanceKm;
    const breakHours = shortBreakHours + mealBreakHours + overnightRestHours;
    const checkpointDelays = checkpointHours;
    
    // Total Transit Time (Hours) = (Total Distance / Average Speed by Terrain) + Break Hours + Checkpoint Delays
    const totalTransitTimeHours = pureDriverHours + breakHours + checkpointDelays;
    
    // Total Days = Total Transit Time (Hours) / 24 Hours
    const totalDays = totalTransitTimeHours / 24;

    const durationSec = totalTransitTimeHours * 3600;

    // ── Fuel & CO₂ (terrain-weighted) ────────────────────────────────────────
    const optFuelLiters = (plainKm / MILEAGE_PLAIN_KMPL) + (hillyKm / MILEAGE_HILLY_KMPL);
    const optFuelCost   = optFuelLiters * FUEL_PRICE;
    const optCO2        = optFuelLiters * CO2_COEFFICIENT;

    // ── Logistical Breakdown (returned for UI display) ────────────────────────
    const breakdown = {
      pure_driving_hours:    parseFloat(pureDriverHours.toFixed(2)),
      break_hours:           parseFloat(breakHours.toFixed(2)),
      checkpoint_delays:     parseFloat(checkpointDelays.toFixed(2)),
      total_hours:           parseFloat(totalTransitTimeHours.toFixed(2)),
      total_days:            parseFloat(totalDays.toFixed(2)),
      terrain_type:          terrain.hillyFraction > 0.3 ? (terrain.hillyFraction > 0.5 ? "Mountainous" : "Mixed") : "Plain",
      plain_km:              parseFloat(plainKm.toFixed(1)),
      hilly_km:              parseFloat(hillyKm.toFixed(1)),
      legal_note:            "Calculations comply with Motor Vehicles Act: ≤8h driving/day, 30-min break every 5h, mandatory 8h overnight rest."
    };

    // ── Naive Baseline: unoptimized route (shared load, no GPS, extra stops) ──
    // Shared/unoptimized trucks cover only 300 km/day vs optimized 375 km/day
    const naiveDistance       = distanceKm * 1.20;   // 20% longer due to detours
    const naivePlainKm        = naiveDistance * terrain.plainFraction;
    const naiveHillyKm        = naiveDistance * terrain.hillyFraction;
    const naivePureDrive      = (naivePlainKm / SPEED_PLAIN_KMH) + (naiveHillyKm / SPEED_HILLY_KMH);
    const naiveShortBreaks    = Math.floor(naiveDistance / 200) * 0.5;
    const naiveMealBreaks     = Math.floor(naiveDistance / 400) * 1.0;
    const naiveOvernightRest  = Math.floor(naivePureDrive / 8) * 8;
    const naiveCheckpoints    = Math.floor(naiveDistance / 500) * 1.5;
    const naiveTotalHours     = naivePureDrive + naiveShortBreaks + naiveMealBreaks + naiveOvernightRest + naiveCheckpoints;
    const naiveDuration       = naiveTotalHours * 3600;
    const naiveFuelLiters     = (naivePlainKm / MILEAGE_PLAIN_KMPL) + (naiveHillyKm / MILEAGE_HILLY_KMPL);
    const naiveFuelCost       = naiveFuelLiters * FUEL_PRICE;
    const naiveCO2            = naiveFuelLiters * CO2_COEFFICIENT;

    // ── Savings ───────────────────────────────────────────────────────────────
    const savingsDistance = naiveDistance - distanceKm;
    const savingsDuration = naiveDuration - durationSec;
    const savingsFuel     = naiveFuelLiters - optFuelLiters;
    const savingsCost     = naiveFuelCost - optFuelCost;
    const savingsCO2      = naiveCO2 - optCO2;

    res.json({
      success: true,
      pickup: { name: pickup, coords: pickupCoords },
      drop:   { name: drop,   coords: dropCoords   },
      optimized: {
        distance_km:  distanceKm,
        duration_sec: durationSec,
        fuel_liters:  optFuelLiters,
        fuel_cost:    optFuelCost,
        co2_kg:       optCO2,
        geometry:     route.geometry,
        breakdown
      },
      naive: {
        distance_km:  naiveDistance,
        duration_sec: naiveDuration,
        fuel_liters:  naiveFuelLiters,
        fuel_cost:    naiveFuelCost,
        co2_kg:       naiveCO2
      },
      savings: {
        distance_km:  savingsDistance,
        duration_sec: savingsDuration,
        fuel_liters:  savingsFuel,
        fuel_cost:    savingsCost,
        co2_kg:       savingsCO2
      }
    });

  } catch (err) {
    console.error("Route optimization endpoint exception:", err);
    res.status(500).json({ error: err.message });
  }
});

// ════════════════════════════════════════════════════════════════════════════
// DRIVER FATIGUE & DUTY-TIME ENFORCEMENT ENDPOINTS
// ════════════════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────────────────
// POST /api/driver/start-journey
// Driver starts a trip. Creates a duty session and auto-generates checkpoints
// along the route every ~160 km (4h @ 40 km/h).
// Body: { driver_id, load_id, pickup, drop }
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/driver/start-journey", async (req, res) => {
  try {
    const { driver_id, load_id, pickup, drop } = req.body;
    if (!driver_id || !load_id) {
      return res.status(400).json({ error: "driver_id and load_id are required" });
    }

    // 1. Check for an existing active session today to avoid duplicates
    const today = new Date().toISOString().slice(0, 10);
    const { data: existing } = await supabase
      .from("driver_duty_sessions")
      .select("id, status")
      .eq("driver_id", driver_id)
      .eq("load_id", load_id)
      .eq("session_date", today)
      .maybeSingle();

    let sessionId;
    if (existing) {
      if (existing.status === "active" || existing.status === "resting") {
        // Return existing session
        sessionId = existing.id;
      } else {
        // Reset a completed/breached session for new day
        const { data: reset, error: resetErr } = await supabase
          .from("driver_duty_sessions")
          .update({ status: "active", started_at: new Date().toISOString(), total_drive_minutes: 0 })
          .eq("id", existing.id)
          .select("id")
          .single();
        if (resetErr) throw resetErr;
        sessionId = reset.id;
      }
    } else {
      // 2. Create new duty session
      const { data: session, error: sessErr } = await supabase
        .from("driver_duty_sessions")
        .insert({
          driver_id,
          load_id,
          session_date: today,
          started_at: new Date().toISOString(),
          total_drive_minutes: 0,
          status: "active"
        })
        .select("id")
        .single();
      if (sessErr) throw sessErr;
      sessionId = session.id;
    }

    // 3. Clean up and generate checkpoints if pickup/drop provided
    if (pickup && drop) {
      // Always delete existing checkpoints for this load and driver to avoid duplicates or stale data
      await supabase
        .from("driver_checkpoints")
        .delete()
        .eq("load_id", load_id)
        .eq("driver_id", driver_id);

      // Fetch route geometry from OSRM via existing route endpoint logic
      const pickupCoords = await getCoords(pickup);
      const dropCoords = await getCoords(drop);

      if (pickupCoords && dropCoords) {
        const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pickupCoords[1]},${pickupCoords[0]};${dropCoords[1]},${dropCoords[0]}?overview=full&geometries=geojson&steps=false`;
        let routeGeometry = null;
        let totalDistanceKm = 0;
        try {
          const osrmRes = await fetch(osrmUrl);
          const osrmData = await osrmRes.json();
          if (osrmData.code === "Ok" && osrmData.routes?.length > 0) {
            routeGeometry = osrmData.routes[0].geometry.coordinates; // [[lon,lat], ...]
            totalDistanceKm = osrmData.routes[0].distance / 1000;
          }
        } catch (e) {
          console.warn("OSRM checkpoint generation failed:", e.message);
        }

        // Place checkpoints every 160 km (4h driving), skip if route < 100km
        const CHECKPOINT_INTERVAL_KM = 160;
        const checkpointsToInsert = [];
        if (totalDistanceKm >= 100) {
          const numCheckpoints = Math.floor(totalDistanceKm / CHECKPOINT_INTERVAL_KM);
          for (let i = 1; i <= numCheckpoints; i++) {
            const fraction = (i * CHECKPOINT_INTERVAL_KM) / totalDistanceKm;
            let cpLat = null, cpLng = null;
            if (routeGeometry && routeGeometry.length > 0) {
              const idx = Math.min(Math.floor(fraction * routeGeometry.length), routeGeometry.length - 1);
              cpLng = routeGeometry[idx][0];
              cpLat = routeGeometry[idx][1];
            }
            checkpointsToInsert.push({
              load_id,
              driver_id,
              checkpoint_index: i,
              label: `Rest Stop #${i}`,
              approx_km: Math.round(i * CHECKPOINT_INTERVAL_KM),
              approx_lat: cpLat,
              approx_lng: cpLng,
            });
          }

          if (checkpointsToInsert.length > 0) {
            const { error: cpErr } = await supabase
              .from("driver_checkpoints")
              .insert(checkpointsToInsert);
            if (cpErr) console.warn("Checkpoint insert warn:", cpErr.message);
          }
        }
      }
    }

    // 4. Fetch checkpoints to return
    const { data: checkpoints } = await supabase
      .from("driver_checkpoints")
      .select("*")
      .eq("load_id", load_id)
      .eq("driver_id", driver_id)
      .order("checkpoint_index", { ascending: true });

    // 5. Mark load as running
    await supabase.from("Load").update({ status: "Running" }).eq("load_id", load_id);

    res.json({ success: true, session_id: sessionId, checkpoints: checkpoints || [] });
  } catch (err) {
    console.error("START JOURNEY ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/driver/duty-status
// Returns today's duty session and checkpoints for a driver.
// Query: driver_id, load_id (optional)
// ────────────────────────────────────────────────────────────────────────────
app.get("/api/driver/duty-status", async (req, res) => {
  try {
    const { driver_id, load_id } = req.query;
    if (!driver_id) return res.status(400).json({ error: "driver_id is required" });

    const today = new Date().toISOString().slice(0, 10);
    let sessionQuery = supabase
      .from("driver_duty_sessions")
      .select("*")
      .eq("driver_id", driver_id)
      .eq("session_date", today)
      .order("created_at", { ascending: false })
      .limit(1);

    if (load_id) sessionQuery = sessionQuery.eq("load_id", load_id);

    const { data: sessions } = await sessionQuery;
    const session = sessions?.[0] || null;

    let checkpoints = [];
    if (session?.load_id || load_id) {
      const targetLoadId = load_id || session?.load_id;
      const { data: cps } = await supabase
        .from("driver_checkpoints")
        .select("*")
        .eq("load_id", targetLoadId)
        .eq("driver_id", driver_id)
        .order("checkpoint_index", { ascending: true });
      checkpoints = cps || [];
    }

    res.json({ session, checkpoints });
  } catch (err) {
    console.error("DUTY STATUS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/driver/update-drive-time
// Sync drive minutes from frontend timer. Flags status to 'resting' at 480m.
// Body: { driver_id, load_id, total_drive_minutes }
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/driver/update-drive-time", async (req, res) => {
  try {
    const { driver_id, load_id, total_drive_minutes } = req.body;
    if (!driver_id || total_drive_minutes === undefined) {
      return res.status(400).json({ error: "driver_id and total_drive_minutes are required" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const newStatus = total_drive_minutes >= 480 ? "resting" : "active";

    let query = supabase
      .from("driver_duty_sessions")
      .update({ total_drive_minutes, status: newStatus })
      .eq("driver_id", driver_id)
      .eq("session_date", today);

    if (load_id) query = query.eq("load_id", load_id);

    const { error } = await query;
    if (error) throw error;

    res.json({ success: true, status: newStatus });
  } catch (err) {
    console.error("UPDATE DRIVE TIME ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/driver/checkin-checkpoint
// Driver checks in at a checkpoint (marks reached_at = now).
// Body: { checkpoint_id }
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/driver/checkin-checkpoint", async (req, res) => {
  try {
    const { checkpoint_id } = req.body;
    if (!checkpoint_id) return res.status(400).json({ error: "checkpoint_id is required" });

    const { error } = await supabase
      .from("driver_checkpoints")
      .update({ reached_at: new Date().toISOString() })
      .eq("id", checkpoint_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("CHECKIN CHECKPOINT ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/driver/report-breach
// Logs a fatigue rule violation. Also marks session as 'breached'.
// Body: { driver_id, load_id, seller_id, drive_minutes_at_breach, gps_lat?, gps_lng? }
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/driver/report-breach", async (req, res) => {
  try {
    let { driver_id, load_id, seller_id, drive_minutes_at_breach, gps_lat, gps_lng } = req.body;
    if (!driver_id) return res.status(400).json({ error: "driver_id is required" });

    // Lookup seller_id if missing
    if (!seller_id && load_id) {
      const { data: loadData } = await supabase.from('Load').select('seller_id').eq('load_id', load_id).single();
      if (loadData && loadData.seller_id) {
        seller_id = loadData.seller_id;
      }
    }

    // 1. Insert breach log
    const { error: breachErr } = await supabase
      .from("driver_breach_logs")
      .insert({
        driver_id,
        load_id: load_id || null,
        seller_id: seller_id || null,
        drive_minutes_at_breach: drive_minutes_at_breach || 0,
        gps_lat: gps_lat || null,
        gps_lng: gps_lng || null,
        penalty_amount: 500
      });
    if (breachErr) throw breachErr;

    // 2. Mark session as breached
    const today = new Date().toISOString().slice(0, 10);
    await supabase
      .from("driver_duty_sessions")
      .update({ status: "breached" })
      .eq("driver_id", driver_id)
      .eq("session_date", today);

    res.json({ success: true });
  } catch (err) {
    console.error("REPORT BREACH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// GET /api/seller/breach-alerts
// Returns unacknowledged breach alerts for loads owned by seller.
// Query: seller_id
// ────────────────────────────────────────────────────────────────────────────
app.get("/api/seller/breach-alerts", async (req, res) => {
  try {
    const { seller_id } = req.query;
    if (!seller_id) return res.status(400).json({ error: "seller_id is required" });

    const { data, error } = await supabase
      .from("driver_breach_logs")
      .select(`
        id,
        breach_at,
        drive_minutes_at_breach,
        gps_lat,
        gps_lng,
        penalty_amount,
        acknowledged_by_seller,
        load_id,
        driver:profiles!driver_id(full_name, email)
      `)
      .eq("seller_id", seller_id)
      .order("breach_at", { ascending: false });

    if (error) throw error;
    res.json({ alerts: data || [] });
  } catch (err) {
    console.error("BREACH ALERTS ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// POST /api/seller/acknowledge-breach
// Seller marks a breach alert as read.
// Body: { breach_id }
// ────────────────────────────────────────────────────────────────────────────
app.post("/api/seller/acknowledge-breach", async (req, res) => {
  try {
    const { breach_id } = req.body;
    if (!breach_id) return res.status(400).json({ error: "breach_id is required" });

    const { error } = await supabase
      .from("driver_breach_logs")
      .update({ acknowledged_by_seller: true })
      .eq("id", breach_id);

    if (error) throw error;
    res.json({ success: true });
  } catch (err) {
    console.error("ACKNOWLEDGE BREACH ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

// ── Start server ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
