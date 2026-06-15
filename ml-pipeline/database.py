import os
from datetime import datetime, timedelta
from typing import Optional
from dotenv import load_dotenv
from supabase import create_client, Client
 
load_dotenv()
 
_client: Optional[Client] = None
 
 
def get_client() -> Client:
    global _client
    if _client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
        if not url or not key:
            raise EnvironmentError(
                "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env"
            )
        _client = create_client(url, key)
    return _client
 
 
# ─────────────────────────────────────────────────────────────────────────────
# READS
# ─────────────────────────────────────────────────────────────────────────────
 
def get_all_warehouses() -> list[dict]:
    """Fetch all warehouses with id, max_capacity, current_load, name."""
    db = get_client()
    resp = db.table("warehouses").select("id, name, max_capacity, current_load").execute()
    return resp.data or []
 
 
def get_warehouse_by_id(warehouse_id: str) -> Optional[dict]:
    """Fetch a single warehouse record."""
    db = get_client()
    resp = (
        db.table("warehouses")
        .select("id, name, max_capacity, current_load")
        .eq("id", warehouse_id)
        .single()
        .execute()
    )
    return resp.data
 
 
def get_inventory_history(warehouse_id: str, hours: int = 48) -> list[dict]:
    """
    Return inventory snapshots for the past `hours` hours, oldest first.
    Used to compute load velocity and build LSTM sequences.
    """
    db = get_client()
    since = (datetime.utcnow() - timedelta(hours=hours)).isoformat()
    resp = (
        db.table("warehouse_inventory_history")
        .select("recorded_at, current_load")
        .eq("warehouse_id", warehouse_id)
        .gte("recorded_at", since)
        .order("recorded_at", desc=False)
        .execute()
    )
    return resp.data or []
 
 
def get_incoming_shipment_load(warehouse_id: str) -> int:
    """
    Sum of quantities on shipments heading to this warehouse that are
    pending or in transit.
    """
    db = get_client()
    try:
        resp = (
            db.table("shipments")
            .select("quantity")
            .eq("destination_warehouse_id", warehouse_id)
            .in_("status", ["pending", "in_transit"])
            .execute()
        )
        return sum(r.get("quantity", 0) for r in (resp.data or []))
    except Exception:
        # Gracefully return 0 if the schema differs
        return 0
 
 
def get_latest_prediction(warehouse_id: str) -> Optional[dict]:
    """Return the most recent prediction row for a warehouse."""
    db = get_client()
    resp = (
        db.table("warehouse_predictions")
        .select("*")
        .eq("warehouse_id", warehouse_id)
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0] if rows else None
 
 
def get_all_latest_predictions() -> list[dict]:
    """
    Return the most recent prediction for every warehouse.
    Uses a subquery-style approach via RPC or client-side deduplication.
    """
    db = get_client()
    # Fetch recent predictions for all warehouses (last 24h)
    since = (datetime.utcnow() - timedelta(hours=24)).isoformat()
    resp = (
        db.table("warehouse_predictions")
        .select("*")
        .gte("created_at", since)
        .order("created_at", desc=True)
        .execute()
    )
    rows = resp.data or []
 
    # Deduplicate — keep only the latest per warehouse
    seen = {}
    for row in rows:
        wid = row["warehouse_id"]
        if wid not in seen:
            seen[wid] = row
    return list(seen.values())
 
 
# ─────────────────────────────────────────────────────────────────────────────
# WRITES
# ─────────────────────────────────────────────────────────────────────────────
 
def record_inventory_snapshot(warehouse_id: str, current_load: int) -> dict:
    """
    Insert a new inventory history row. Call this periodically (e.g. every 30 min)
    to build up the time-series data for velocity calculation.
    """
    db = get_client()
    resp = (
        db.table("warehouse_inventory_history")
        .insert({
            "warehouse_id": warehouse_id,
            "current_load": current_load,
        })
        .execute()
    )
    return resp.data[0] if resp.data else {}
 
 
def save_prediction(
    warehouse_id: str,
    overflow_risk_percentage: float,
    expected_overflow_time: Optional[str],
    recommended_action: str,
) -> dict:
    """Insert a prediction result into warehouse_predictions."""
    db = get_client()
    payload = {
        "warehouse_id": warehouse_id,
        "overflow_risk_percentage": round(overflow_risk_percentage, 2),
        "expected_overflow_time": expected_overflow_time,
        "recommended_action": recommended_action,
    }
    resp = db.table("warehouse_predictions").insert(payload).execute()
    return resp.data[0] if resp.data else {}
 
 
def get_current_warehouse_load(warehouse_id: str) -> int:
    """
    Get the most recently recorded load for a warehouse.
    Returns 0 if no history exists.
    """
    db = get_client()
    resp = (
        db.table("warehouse_inventory_history")
        .select("current_load")
        .eq("warehouse_id", warehouse_id)
        .order("recorded_at", desc=True)
        .limit(1)
        .execute()
    )
    rows = resp.data or []
    return rows[0]["current_load"] if rows else 0
