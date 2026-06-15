import os
import joblib
import requests
import numpy as np
import pandas as pd
from datetime import datetime, timedelta, timezone
from typing import Optional
from dotenv import load_dotenv
 

 
load_dotenv()
 
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
GOOGLE_WEATHER_API_KEY = os.getenv("GOOGLE_WEATHER_API_KEY")
 
# ─────────────────────────────────────────────────────────────────────────────
# MODEL LOADING (lazy, cached)
# ─────────────────────────────────────────────────────────────────────────────
 
_rf_model = None
_scaler = None
_lstm_model = None
 
 
def _load_models():
    global _rf_model, _scaler, _lstm_model
    if _rf_model is None:
        rf_path = os.path.join(MODEL_DIR, "random_forest.pkl")
        sc_path = os.path.join(MODEL_DIR, "scaler.pkl")
        lstm_path = os.path.join(MODEL_DIR, "lstm_model.keras")
 
        if not os.path.exists(rf_path):
            raise FileNotFoundError(
                "Models not found. Run `python train.py` first."
            )
        _rf_model = joblib.load(rf_path)
        _scaler = joblib.load(sc_path)
 
 
# ─────────────────────────────────────────────────────────────────────────────
# WEATHER DISRUPTION
# ─────────────────────────────────────────────────────────────────────────────
 
def get_weather_disruption_factor(location: Optional[str]) -> dict:
    """
    Calls the Google Weather API (currentConditions endpoint) to assess
    whether severe weather near the warehouse increases overflow risk
    (e.g. floods / cyclones delay outbound shipments → load accumulates).
 
    Returns:
        {
          "factor": float,          # multiplier: 1.0 = no impact, up to 1.5
          "description": str,       # human-readable weather summary
          "condition_code": str,    # raw condition identifier
          "temperature_c": float,
          "alert": bool             # True if severe weather detected
        }
    """
    default = {
        "factor": 1.0,
        "description": "Weather data unavailable",
        "condition_code": "UNKNOWN",
        "temperature_c": None,
        "alert": False,
    }
 
    if not GOOGLE_WEATHER_API_KEY or not location:
        return default
 
    # Google Weather API: currentConditions
    # Docs: https://developers.google.com/maps/documentation/weather/current-conditions
    try:
        url = "https://weather.googleapis.com/v1/currentConditions:lookup"
        params = {
            "key": GOOGLE_WEATHER_API_KEY,
            "location.latitude": None,
            "location.longitude": None,
            "languageCode": "en",
            "unitsSystem": "METRIC",
        }
 
        # If location is "lat,lng" format
        if "," in str(location):
            parts = str(location).split(",")
            params["location.latitude"] = float(parts[0].strip())
            params["location.longitude"] = float(parts[1].strip())
        else:
            # Geocode the location string first
            geo_url = "https://maps.googleapis.com/maps/api/geocode/json"
            geo_resp = requests.get(
                geo_url,
                params={"address": location, "key": GOOGLE_WEATHER_API_KEY},
                timeout=5,
            ).json()
            if geo_resp.get("results"):
                geo_loc = geo_resp["results"][0]["geometry"]["location"]
                params["location.latitude"] = geo_loc["lat"]
                params["location.longitude"] = geo_loc["lng"]
            else:
                return default
 
        resp = requests.get(url, params=params, timeout=5)
        resp.raise_for_status()
        data = resp.json()
 
        condition = data.get("weatherCondition", {})
        condition_code = condition.get("type", {}).get("type", "CLEAR")
        description = condition.get("description", {}).get("text", "Clear")
        temp_c = data.get("temperature", {}).get("degrees", None)
 
        # Severe weather types that disrupt logistics
        SEVERE_CONDITIONS = {
            "HEAVY_RAIN", "THUNDERSTORM", "CYCLONE", "HURRICANE",
            "TORNADO", "BLIZZARD", "FLOOD", "HEAVY_SNOW", "HAIL",
            "DUST_STORM", "FOG",
        }
        MODERATE_CONDITIONS = {
            "RAIN", "DRIZZLE", "SNOW", "SLEET", "WINDY", "CLOUDY",
        }
 
        alert = condition_code in SEVERE_CONDITIONS
        if condition_code in SEVERE_CONDITIONS:
            factor = 1.35  # 35% risk increase for severe conditions
        elif condition_code in MODERATE_CONDITIONS:
            factor = 1.10  # 10% increase for moderate disruptions
        else:
            factor = 1.0   # Clear weather — no disruption
 
        return {
            "factor": factor,
            "description": description,
            "condition_code": condition_code,
            "temperature_c": temp_c,
            "alert": alert,
        }
 
    except Exception as e:
        print(f"  [weather] API error for location '{location}': {e}")
        return default
 
 
# ─────────────────────────────────────────────────────────────────────────────
# FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────
 
SEQ_LEN = 24  # number of hourly snapshots for LSTM
 
 
def _build_features(
    history: list[dict],
    max_capacity: int,
    incoming: int,
) -> tuple[np.ndarray, np.ndarray, float, float]:
    """
    Build feature arrays from raw history records.
 
    Returns:
        x_rf        — (1, 10) for Random Forest
        x_lstm      — (1, SEQ_LEN, 3) for LSTM
        velocity    — units/hour (latest)
        current_load — latest inventory level
    """
    if not history:
        # Cold-start: no history yet — return conservative defaults
        x_rf = np.zeros((1, 10))
        x_rf[0, 1] = max_capacity
        x_rf[0, 2] = incoming
        x_rf[0, 4] = incoming / max(max_capacity, 1)
        x_rf[0, 5] = max_capacity
        x_lstm = np.zeros((1, SEQ_LEN, 3))
        return x_rf, x_lstm, 0.0, 0
 
    df = pd.DataFrame(history)
    df["recorded_at"] = pd.to_datetime(df["recorded_at"], utc=True)
    df["current_load"] = pd.to_numeric(df["current_load"])
    df = df.sort_values("recorded_at").reset_index(drop=True)
 
    # Load velocity
    time_deltas = df["recorded_at"].diff().dt.total_seconds() / 3600
    load_deltas = df["current_load"].diff()
    df["velocity_per_hour"] = (load_deltas / time_deltas).fillna(0)
    df["rolling_avg"] = df["current_load"].rolling(6, min_periods=1).mean()
    df["rolling_max"] = df["current_load"].rolling(6, min_periods=1).max()
    df["rolling_vel"] = df["velocity_per_hour"].rolling(6, min_periods=1).mean()
 
    latest = df.iloc[-1]
    current_load = float(latest["current_load"])
    velocity = float(latest["velocity_per_hour"])
    rolling_avg = float(latest["rolling_avg"])
    rolling_max = float(latest["rolling_max"])
    rolling_vel = float(latest["rolling_vel"])
 
    fill_ratio = current_load / max(max_capacity, 1)
    incoming_fill = (current_load + incoming) / max(max_capacity, 1)
    available_space = max(max_capacity - current_load, 0)
 
    x_rf = np.array([[
        current_load,
        max_capacity,
        incoming,
        fill_ratio,
        incoming_fill,
        available_space,
        velocity,
        rolling_avg,
        rolling_max,
        rolling_vel,
    ]])
 
    # LSTM sequence
    seq = df[["current_load", "velocity_per_hour", "rolling_avg"]].values
    if len(seq) < SEQ_LEN:
        pad = np.zeros((SEQ_LEN - len(seq), 3))
        seq = np.vstack([pad, seq])
    else:
        seq = seq[-SEQ_LEN:]
    x_lstm = seq[np.newaxis, :, :]
 
    return x_rf, x_lstm, velocity, current_load
 
 
# ─────────────────────────────────────────────────────────────────────────────
# OVERFLOW TIME ESTIMATION
# ─────────────────────────────────────────────────────────────────────────────
 
def _estimate_overflow_time(
    current_load: float,
    max_capacity: int,
    velocity: float,
    incoming: int,
) -> Optional[str]:
    """
    If velocity > 0 and max_capacity will be exceeded, estimate when.
    Returns ISO timestamp string or None.
    """
    if velocity <= 0:
        return None
    available_space = max_capacity - current_load - incoming
    if available_space <= 0:
        # Already overflowing or about to due to incoming alone
        return datetime.now(timezone.utc).isoformat()
    hours_to_overflow = available_space / velocity
    if hours_to_overflow > 72:
        return None  # Beyond 72h, not actionable enough to predict
    overflow_at = datetime.now(timezone.utc) + timedelta(hours=hours_to_overflow)
    return overflow_at.isoformat()
 
 
# ─────────────────────────────────────────────────────────────────────────────
# RECOMMENDED ACTION
# ─────────────────────────────────────────────────────────────────────────────
 
def _recommend_action(
    risk: float,
    velocity: float,
    current_load: float,
    max_capacity: int,
    incoming: int,
    weather: dict,
) -> str:
    fill = (current_load + incoming) / max(max_capacity, 1) * 100
    weather_note = f" (Weather alert: {weather['description']})" if weather["alert"] else ""
 
    if risk >= 85:
        return (
            f"🔴 CRITICAL: Immediately reroute {min(incoming, int(incoming * 0.6))} units"
            f" to nearest available warehouse. Halt incoming shipments until load drops below"
            f" {int(max_capacity * 0.75)} units.{weather_note}"
        )
    elif risk >= 65:
        return (
            f"🟠 HIGH RISK: Expedite outbound dispatches within 12 hours."
            f" Consider redistributing ~{int((current_load + incoming - max_capacity * 0.75))} units."
            f" Current fill after incoming: {fill:.0f}%.{weather_note}"
        )
    elif risk >= 40:
        return (
            f"🟡 MODERATE: Monitor closely. Current load velocity is"
            f" {velocity:+.1f} units/hr. Prepare overflow protocols"
            f" and alert logistics team.{weather_note}"
        )
    elif risk >= 20:
        return (
            f"🟢 LOW RISK: No immediate action needed."
            f" Warehouse at {fill:.0f}% projected fill after incoming shipments."
        )
    else:
        return "✅ NORMAL: Warehouse operating within safe capacity bounds."
 
 
# ─────────────────────────────────────────────────────────────────────────────
# MAIN PREDICTION FUNCTION
# ─────────────────────────────────────────────────────────────────────────────
 
def predict_overflow(
    warehouse_id: str,
    max_capacity: int,
    history: list[dict],
    incoming: int,
    location: Optional[str] = None,
) -> dict:
    """
    Run the full prediction pipeline for one warehouse.
 
    Args:
        warehouse_id: UUID of the warehouse
        max_capacity:     Maximum units the warehouse can hold
        history:      List of {recorded_at, current_load} dicts, oldest first
        incoming:     Total units in pending/in-transit inbound shipments
        location:     "lat,lng" or city name string for weather lookup
 
    Returns:
        {
          "warehouse_id": str,
          "overflow_risk_percentage": float,   # 0–100
          "expected_overflow_time": str|None,  # ISO timestamp or null
          "recommended_action": str,
          "load_velocity_per_hour": float,
          "current_load": int,
          "incoming_load": int,
          "max_capacity": int,
          "fill_ratio_pct": float,
          "weather": dict,
          "model_used": str,
        }
    """
    _load_models()
 
    weather = get_weather_disruption_factor(location)
    x_rf, x_lstm, velocity, current_load = _build_features(history, max_capacity, incoming)
 
    # ── Random Forest prediction ──────────────────────────────────────────
    x_rf_scaled = _scaler.transform(x_rf)
    rf_risk = float(np.clip(_rf_model.predict(x_rf_scaled)[0], 0, 100))
 
    # ── Ensemble: using only RF since tensorflow is unsupported ───────────
    base_risk = rf_risk
 
    # ── Apply weather disruption multiplier ───────────────────────────────
    final_risk = float(np.clip(base_risk * weather["factor"], 0, 100))
 
    overflow_time = _estimate_overflow_time(current_load, max_capacity, velocity, incoming)
    action = _recommend_action(final_risk, velocity, current_load, max_capacity, incoming, weather)
 
    fill_ratio_pct = (current_load + incoming) / max(max_capacity, 1) * 100
    predicted_load_24h = round(current_load + velocity * 24, 2)
    predicted_load_48h = round(current_load + velocity * 48, 2)

    print({
        "warehouse_id": warehouse_id,
        "current_load": current_load,
        "incoming": incoming,
        "capacity": max_capacity,
        "velocity": velocity,
        "fill_ratio_pct": fill_ratio_pct,
        "predicted_load_24h": predicted_load_24h,
        "predicted_load_48h": predicted_load_48h,
    })

 
    return {
    "warehouse_id": warehouse_id,
    "overflow_risk_percentage": round(final_risk, 2),
    "expected_overflow_time": overflow_time,
    "recommended_action": action,

    "load_velocity_per_hour": round(velocity, 2),
    "current_load": int(current_load),
    "incoming_load": incoming,
    "max_capacity": max_capacity,

    "fill_ratio_pct": round(fill_ratio_pct, 2),

    "predicted_load_24h": predicted_load_24h,
    "predicted_load_48h": predicted_load_48h,

    "weather": weather,
    "model_used": "RF+LSTM Ensemble",
}
