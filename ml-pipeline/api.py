import os
import threading
import time
from datetime import datetime, timezone
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS
 
import database as db
from predict import predict_overflow
 
load_dotenv()
 
app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

REQUIRED_PREDICTION_FIELDS = {
    "current_load",
    "max_capacity",
    "fill_ratio_pct",
    "load_velocity_per_hour",
    "predicted_load_24h",
    "predicted_load_48h",
}
 
# ─────────────────────────────────────────────────────────────────────────────
# HELPERS
# ─────────────────────────────────────────────────────────────────────────────
 
def _run_prediction_for_warehouse(warehouse: dict) -> dict:
    """Run prediction for a single warehouse dict."""
    wid = warehouse["id"]
    capacity = warehouse.get("max_capacity") or warehouse.get("capacity") or 1000
    location = None
 
    history = db.get_inventory_history(wid, hours=48)
    if not history and warehouse.get("current_load") is not None:
        history = [{
            "recorded_at": datetime.now(timezone.utc).isoformat(),
            "current_load": warehouse.get("current_load"),
        }]
    incoming = db.get_incoming_shipment_load(wid)
 
    result = predict_overflow(
        warehouse_id=wid,
        max_capacity=capacity,
        history=history,
        incoming=incoming,
        location=None,
    )
 
    # Persist prediction to Supabase
    db.save_prediction(
        warehouse_id=wid,
        overflow_risk_percentage=result["overflow_risk_percentage"],
        expected_overflow_time=result["expected_overflow_time"],
        recommended_action=result["recommended_action"],
    )
 
    return {**result, "warehouse_name": warehouse.get("name", "Unknown")}


def _has_required_prediction_fields(prediction: dict) -> bool:
    return REQUIRED_PREDICTION_FIELDS.issubset(prediction.keys())
 
 
# ─────────────────────────────────────────────────────────────────────────────
# ROUTES
# ─────────────────────────────────────────────────────────────────────────────
 
@app.route("/api/health", methods=["GET"])
def health():
    """Health check endpoint."""
    return jsonify({
        "status": "ok",
        "service": "IGNIS Overflow Prediction API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    })
 
 
@app.route("/api/predict/<warehouse_id>", methods=["GET"])
def predict_single(warehouse_id: str):
    """
    Predict overflow risk for a single warehouse.
    Optionally re-runs fresh prediction; otherwise returns cached latest.
 
    Query params:
        fresh=true  — force a new prediction (default: return cached if < 30min old)
    """
    try:
        warehouse = db.get_warehouse_by_id(warehouse_id)
        if not warehouse:
            return jsonify({"error": f"Warehouse {warehouse_id} not found"}), 404
 
        fresh = request.args.get("fresh", "false").lower() == "true"
 
        if not fresh:
            cached = db.get_latest_prediction(warehouse_id)
            if cached and _has_required_prediction_fields(cached):
                return jsonify({
                    "source": "cache",
                    "prediction": cached,
                    "warehouse": warehouse,
                })
 
        result = _run_prediction_for_warehouse(warehouse)
        return jsonify({"source": "live", "prediction": result})
 
    except FileNotFoundError as e:
        return jsonify({"error": str(e), "hint": "Run python train.py first"}), 503
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
 
@app.route("/api/predict/all", methods=["GET"])
def predict_all():
    """
    Run overflow prediction for ALL warehouses.
    Returns a list of prediction results sorted by risk (highest first).
 
    Query params:
        fresh=true  — force re-prediction for all warehouses
    """
    try:
        warehouses = db.get_all_warehouses()
        if not warehouses:
            return jsonify({"predictions": [], "count": 0})
 
        fresh = request.args.get("fresh", "false").lower() == "true"
 
        if not fresh:
            cached = db.get_all_latest_predictions()
            if cached and all(_has_required_prediction_fields(row) for row in cached):
                return jsonify({
                    "source": "cache",
                    "predictions": cached,
                    "count": len(cached),
                })
 
        results = []
        for wh in warehouses:
            try:
                result = _run_prediction_for_warehouse(wh)
                results.append(result)
            except Exception as e:
                results.append({
                    "warehouse_id": wh["id"],
                    "warehouse_name": wh.get("name"),
                    "error": str(e),
                    "overflow_risk_percentage": None,
                })
 
        # Sort by risk descending
        results.sort(
            key=lambda x: x.get("overflow_risk_percentage") or -1,
            reverse=True,
        )
 
        return jsonify({
            "source": "live",
            "predictions": results,
            "count": len(results),
            "timestamp": datetime.now(timezone.utc).isoformat(),
        })
 
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
 
@app.route("/api/history/<warehouse_id>", methods=["GET"])
def get_history(warehouse_id: str):
    """
    Return raw inventory history for a warehouse (for charting load velocity).
 
    Query params:
        hours=48  — how many hours of history to return (default 48)
    """
    try:
        hours = int(request.args.get("hours", 48))
        history = db.get_inventory_history(warehouse_id, hours=hours)
        return jsonify({"warehouse_id": warehouse_id, "history": history, "count": len(history)})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
 
@app.route("/api/snapshot", methods=["POST"])
def record_snapshot():
    """
    Record a current inventory snapshot for a warehouse.
    Call this from a cron job or whenever the warehouse load updates.
 
    Body: { "warehouse_id": "...", "current_load": 450 }
    """
    try:
        body = request.get_json()
        warehouse_id = body.get("warehouse_id")
        current_load = body.get("current_load")
 
        if not warehouse_id or current_load is None:
            return jsonify({"error": "warehouse_id and current_load are required"}), 400
 
        row = db.record_inventory_snapshot(warehouse_id, int(current_load))
        return jsonify({"success": True, "row": row}), 201
 
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
 
@app.route("/api/weather", methods=["GET"])
def get_weather():
    """
    Return weather disruption data for a location.
 
    Query params:
        location  — "lat,lng" or city name (e.g. "Mumbai" or "19.0760,72.8777")
    """
    try:
        from predict import get_weather_disruption_factor
        location = request.args.get("location")
        if not location:
            return jsonify({"error": "location query parameter is required"}), 400
        weather = get_weather_disruption_factor(location)
        return jsonify(weather)
    except Exception as e:
        return jsonify({"error": str(e)}), 500
 
 
# ─────────────────────────────────────────────────────────────────────────────
# BACKGROUND SCHEDULER  (auto-snapshot every 30 minutes)
# ─────────────────────────────────────────────────────────────────────────────
 
def _auto_snapshot_loop(interval_seconds: int = 1800):
    """
    Background thread that records inventory snapshots for all warehouses
    every `interval_seconds` seconds. Uses service_role key to fetch
    current load from the most recent inventory history row.
    """
    while True:
        try:
            warehouses = db.get_all_warehouses()
            for wh in warehouses:
                wid = wh["id"]
                current_load = db.get_current_warehouse_load(wid)
                if current_load > 0:
                    db.record_inventory_snapshot(wid, current_load)
            print(f"[scheduler] Snapshots recorded for {len(warehouses)} warehouses at {datetime.now(timezone.utc).isoformat()}")
        except Exception as e:
            print(f"[scheduler] Error: {e}")
        time.sleep(interval_seconds)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# ENTRY POINT
# ─────────────────────────────────────────────────────────────────────────────
 
if __name__ == "__main__":
    # Start background snapshot scheduler
    snapshot_thread = threading.Thread(target=_auto_snapshot_loop, daemon=True)
    snapshot_thread.start()
    print("IGNIS Prediction API starting on http://localhost:5001")
    app.run(host="0.0.0.0", port=5000, debug=False)
