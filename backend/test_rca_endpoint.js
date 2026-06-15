const { createClient } = require("@supabase/supabase-js");
require("dotenv").config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const BASE_URL = `http://localhost:${process.env.PORT || 5000}`;

const results = [];

function pass(name) {
  results.push({ name, status: "PASS" });
  console.log(`  ✓ PASS — ${name}`);
}

function fail(name, reason) {
  results.push({ name, status: "FAIL" });
  console.log(`  ✗ FAIL — ${name}${reason ? ": " + reason : ""}`);
}

async function run() {
  console.log("=== IGNIS RCA Engine Test Results ===\n");

  // ─── Test 1: Fetch a real order from Supabase ────────────────────────────────
  console.log("Test 1: Fetch real order from Supabase");
  let testOrder = null;

  try {
    const { data: orders, error } = await supabase
      .from("Load")
      .select("load_id, pickup, drop, status")
      .limit(1);

    if (error) {
      fail("Test 1 — Supabase order fetch", error.message);
    } else if (!orders || orders.length === 0) {
      console.log("  No orders in database — skipping live test");
      process.exit(0);
    } else {
      testOrder = orders[0];
      console.log(`  Found order: ${testOrder.load_id} (${testOrder.pickup} → ${testOrder.drop})`);
      pass("Test 1 — Supabase order fetch");
    }
  } catch (err) {
    fail("Test 1 — Supabase order fetch", err.message);
    process.exit(1);
  }

  // ─── Test 2: Call POST /api/rca/analyze ──────────────────────────────────────
  console.log("\nTest 2: POST /api/rca/analyze with real order");
  let rcaResponse = null;

  try {
    const body = {
      orderId: testOrder.load_id,
      delayHours: 6,
      plannedETA: new Date(Date.now() - 6 * 3600000).toISOString(),
      actualETA: new Date().toISOString()
    };

    const res = await fetch(`${BASE_URL}/api/rca/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    rcaResponse = await res.json();
    console.log("\n  Full response from /api/rca/analyze:");
    console.log(JSON.stringify(rcaResponse, null, 2));

    // Validate structure
    if (rcaResponse.success !== true) {
      fail("Test 2 — success === true", `got success=${rcaResponse.success}, error=${rcaResponse.error}`);
    } else {
      pass("Test 2 — success === true");
    }

    const rca = rcaResponse.rca || {};

    if (rca.primaryCause && typeof rca.primaryCause === "string" && rca.primaryCause.length > 0) {
      pass("Test 2 — rca.primaryCause is a non-empty string");
    } else {
      fail("Test 2 — rca.primaryCause is a non-empty string", `got: ${JSON.stringify(rca.primaryCause)}`);
    }

    if (rca.confidence && typeof rca.confidence === "string" && rca.confidence.endsWith("%")) {
      pass("Test 2 — rca.confidence ends with '%'");
    } else {
      fail("Test 2 — rca.confidence ends with '%'", `got: ${JSON.stringify(rca.confidence)}`);
    }

    if (Array.isArray(rca.contributingFactors) && rca.contributingFactors.length >= 1) {
      pass("Test 2 — rca.contributingFactors has at least 1 item");
    } else {
      fail("Test 2 — rca.contributingFactors has at least 1 item", `got: ${JSON.stringify(rca.contributingFactors)}`);
    }

    if (Array.isArray(rca.recommendedActions) && rca.recommendedActions.length >= 1) {
      pass("Test 2 — rca.recommendedActions has at least 1 item");
    } else {
      fail("Test 2 — rca.recommendedActions has at least 1 item", `got: ${JSON.stringify(rca.recommendedActions)}`);
    }

    if (rca.businessImpact && typeof rca.businessImpact === "string" && rca.businessImpact.length > 0) {
      pass("Test 2 — rca.businessImpact is a non-empty string");
    } else {
      fail("Test 2 — rca.businessImpact is a non-empty string", `got: ${JSON.stringify(rca.businessImpact)}`);
    }

    if (rca.summary && typeof rca.summary === "string" && rca.summary.length > 0) {
      pass("Test 2 — rca.summary is a non-empty string");
    } else {
      fail("Test 2 — rca.summary is a non-empty string", `got: ${JSON.stringify(rca.summary)}`);
    }
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED") {
      fail("Test 2 — POST /api/rca/analyze", "Server is not running on " + BASE_URL);
    } else {
      fail("Test 2 — POST /api/rca/analyze", err.message);
    }
  }

  // ─── Test 3: GET /api/rca/history ────────────────────────────────────────────
  console.log("\nTest 3: GET /api/rca/history?limit=5");

  try {
    const res = await fetch(`${BASE_URL}/api/rca/history?limit=5`);
    const historyResponse = await res.json();

    if (historyResponse.success === true && Array.isArray(historyResponse.history)) {
      console.log(`  Records returned: ${historyResponse.history.length}`);
      pass("Test 3 — GET /api/rca/history returns success + array");
    } else {
      fail("Test 3 — GET /api/rca/history returns success + array", JSON.stringify(historyResponse));
    }
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED") {
      fail("Test 3 — GET /api/rca/history", "Server is not running on " + BASE_URL);
    } else {
      fail("Test 3 — GET /api/rca/history", err.message);
    }
  }

  // ─── Test 4: Error handling — invalid orderId ─────────────────────────────────
  console.log("\nTest 4: POST /api/rca/analyze with invalid orderId");

  try {
    const body = {
      orderId: "nonexistent-order-xyz",
      delayHours: 3,
      plannedETA: new Date(Date.now() - 3 * 3600000).toISOString(),
      actualETA: new Date().toISOString()
    };

    const res = await fetch(`${BASE_URL}/api/rca/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });

    const errorResponse = await res.json();

    if (errorResponse.success === false && errorResponse.error) {
      console.log(`  Server returned graceful error: ${errorResponse.error}`);
      pass("Test 4 — Invalid orderId returns success:false with error");
    } else if (errorResponse.success === true && errorResponse.rca) {
      console.log("  Server returned gracefully degraded RCA (Gemini worked with partial context)");
      pass("Test 4 — Invalid orderId returns gracefully degraded RCA");
    } else {
      fail("Test 4 — Invalid orderId error handling", `Unexpected response: ${JSON.stringify(errorResponse)}`);
    }
  } catch (err) {
    if (err.code === "ECONNREFUSED" || err.cause?.code === "ECONNREFUSED") {
      fail("Test 4 — Invalid orderId error handling", "Server is not running on " + BASE_URL);
    } else {
      fail("Test 4 — Invalid orderId error handling", err.message);
    }
  }

  // ─── Final Summary ────────────────────────────────────────────────────────────
  console.log("\n=== IGNIS RCA Engine Test Results ===");
  const topLevelTests = ["Test 1", "Test 2", "Test 3", "Test 4"];
  let passed = 0;
  let total = 0;

  topLevelTests.forEach(testName => {
    const testResults = results.filter(r => r.name.startsWith(testName));
    if (testResults.length === 0) return;

    total++;
    const allPassed = testResults.every(r => r.status === "PASS");
    if (allPassed) {
      passed++;
      console.log(`  PASS — ${testName}`);
    } else {
      const failedChecks = testResults.filter(r => r.status === "FAIL").map(r => r.name);
      console.log(`  FAIL — ${testName} (failed: ${failedChecks.join(", ")})`);
    }
  });

  console.log(`\nTotal: ${passed}/${total} tests passed`);
}

run();
