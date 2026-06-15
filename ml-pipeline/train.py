import os
import joblib
import numpy as np
import pandas as pd
from datetime import datetime, timedelta
from dotenv import load_dotenv
from supabase import create_client, Client

from sklearn.ensemble import RandomForestRegressor
from sklearn.preprocessing import StandardScaler
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error

import tensorflow as tf
from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import LSTM, Dense, Dropout
from tensorflow.keras.callbacks import EarlyStopping

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
 
supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
 
MODEL_DIR = os.path.join(os.path.dirname(__file__), "models")
os.makedirs(MODEL_DIR, exist_ok=True)

def fetch_warehouses():
    """Return a list of all warehouse records (id, max_capacity, name)."""
    response = supabase.table("warehouses").select("id, max_capacity, name").execute()
    return response.data or []
 
def fetch_inventory_history(warehouse_id: str, days: int = 30):
    """
    Fetch inventory snapshots for a single warehouse for the past `days` days.
    Returns a DataFrame with columns: recorded_at, current_load
    """
    since = (datetime.utcnow() - timedelta(days=days)).isoformat()
    response = (
        supabase.table("warehouse_inventory_history")
        .select("recorded_at, current_load")
        .eq("warehouse_id", warehouse_id)
        .gte("recorded_at", since)
        .order("recorded_at", desc=False)
        .execute()
    )
    rows = response.data or []
    if not rows:
        return pd.DataFrame(columns=["recorded_at", "current_load"])
    df = pd.DataFrame(rows)
    print(df["recorded_at"].head())
    print(df["recorded_at"].dtype)
    df["recorded_at"] = pd.to_datetime(df["recorded_at"],format="ISO8601",utc=True)
    df["current_load"] = pd.to_numeric(df["current_load"])
    return df

def fetch_incoming_shipments(warehouse_id: str):
    """
    Fetch total incoming shipment quantity for a warehouse.
    Looks for shipments in a 'pending' or 'in_transit' status destined for this warehouse.
    Returns total incoming units (integer).
    """
    try:
        response = (
            supabase.table("shipments")
            .select("quantity")
            .eq("destination_warehouse_id", warehouse_id)
            .in_("status", ["pending", "in_transit"])
            .execute()
        )
        rows = response.data or []
        total = sum(r.get("quantity", 0) for r in rows)
        return total
    except Exception:
        # Graceful fallback if shipments table has different schema
        return 0
    
def generate_real_data(days: int = 90):
    """
    Build Random Forest training dataset from historical warehouse data.
    Uses future load 24 hours later as the target.
    """

    warehouses = fetch_warehouses()

    X = []
    y = []

    for wh in warehouses:
        warehouse_id = wh["id"]
        capacity = wh["max_capacity"]

        df = fetch_inventory_history(warehouse_id, days)

        if len(df) < 25:
            continue

        df = compute_load_velocity(df)

        for i in range(len(df) - 24):

            current_load = df.iloc[i]["current_load"]

            velocity = df.iloc[i]["velocity_per_hour"]
            rolling_avg = df.iloc[i]["rolling_avg_load"]
            rolling_max = df.iloc[i]["rolling_max_load"]
            rolling_vel = df.iloc[i]["rolling_velocity"]

            incoming = 0

            fill_ratio = current_load / max(capacity, 1)
            incoming_fill_ratio = (current_load + incoming) / max(capacity, 1)
            available_space = max(capacity - current_load, 0)

            future_load = df.iloc[i + 24]["current_load"]

            overflow_risk = np.clip(
                (future_load / capacity) * 100,
                0,
                100
            )

            X.append([
                current_load,
                capacity,
                incoming,
                fill_ratio,
                incoming_fill_ratio,
                available_space,
                velocity,
                rolling_avg,
                rolling_max,
                rolling_vel,
            ])

            y.append(overflow_risk)

    return np.array(X), np.array(y)

def generate_real_sequences(days: int = 90, seq_len: int = 24):
    """
    Build LSTM sequences from historical warehouse data.
    """

    warehouses = fetch_warehouses()

    X_seqs = []
    y_vals = []

    for wh in warehouses:

        warehouse_id = wh["id"]
        capacity = wh["max_capacity"]

        df = fetch_inventory_history(warehouse_id, days)

        if len(df) < seq_len + 24:
            continue

        df = compute_load_velocity(df)

        seq_data = df[
            ["current_load", "velocity_per_hour", "rolling_avg_load"]
        ].values

        for i in range(len(seq_data) - seq_len - 24):

            sequence = seq_data[i:i + seq_len]

            future_load = df.iloc[i + seq_len + 24]["current_load"]

            risk = np.clip(
                future_load / capacity,
                0,
                1
            )

            X_seqs.append(sequence)
            y_vals.append(risk)

    return np.array(X_seqs), np.array(y_vals)
    
# ─────────────────────────────────────────────────────────────────────────────
# 2.  FEATURE ENGINEERING
# ─────────────────────────────────────────────────────────────────────────────

def compute_load_velocity(df: pd.DataFrame) -> pd.DataFrame:
    """
    Load Velocity = ΔInventory / ΔTime (units per hour).
    Appends 'velocity_per_hour' and rolling statistics to the dataframe.
    """
    if len(df) < 2:
        df["velocity_per_hour"] = 0.0
        df["rolling_avg_load"] = df["current_load"]
        df["rolling_max_load"] = df["current_load"]
        return df
 
    df = df.sort_values("recorded_at").reset_index(drop=True)
 
    # Time delta in hours between consecutive rows
    time_deltas = df["recorded_at"].diff().dt.total_seconds() / 3600
    load_deltas = df["current_load"].diff()
 
    df["velocity_per_hour"] = (load_deltas / time_deltas).fillna(0)

    df["rolling_avg_load"] = df["current_load"].rolling(6, min_periods=1).mean()
    df["rolling_max_load"] = df["current_load"].rolling(6, min_periods=1).max()
    df["rolling_velocity"] = df["velocity_per_hour"].rolling(6, min_periods=1).mean()
 
    return df
def build_feature_matrix(df: pd.DataFrame, capacity: int, incoming: int):
    """
    Build the final feature matrix for one warehouse snapshot.
    Returns (X_rf, X_lstm_sequence) — shapes suitable for each model.
    """
    df = compute_load_velocity(df)
 
    latest = df.iloc[-1]
    current_load = latest["current_load"]
    velocity = latest["velocity_per_hour"]
    rolling_avg = latest["rolling_avg_load"]
    rolling_max = latest["rolling_max_load"]
    rolling_vel = latest["rolling_velocity"]
 
    fill_ratio = current_load / max(capacity, 1)
    incoming_fill_ratio = (current_load + incoming) / max(capacity, 1)
    available_space = max(capacity - current_load, 0)
 
    # Scalar feature vector for Random Forest
    x_rf = np.array([[
        current_load,
        capacity,
        incoming,
        fill_ratio,
        incoming_fill_ratio,
        available_space,
        velocity,
        rolling_avg,
        rolling_max,
        rolling_vel,
    ]])
 
    # Sequence for LSTM — use last 24 readings (pad with zeros if fewer)
    SEQ_LEN = 24
    seq = df[["current_load", "velocity_per_hour", "rolling_avg_load"]].values
    if len(seq) < SEQ_LEN:
        pad = np.zeros((SEQ_LEN - len(seq), seq.shape[1]))
        seq = np.vstack([pad, seq])
    else:
        seq = seq[-SEQ_LEN:]
    x_lstm = seq[np.newaxis, :, :]  # shape: (1, SEQ_LEN, features)
 
    return x_rf, x_lstm

# ─────────────────────────────────────────────────────────────────────────────
# 3.  SYNTHETIC TRAINING DATA GENERATOR
# ─────────────────────────────────────────────────────────────────────────────

def generate_synthetic_data(n_warehouses: int = 50, days: int = 30):
    """
    Generate synthetic training data when historical data is insufficient.
    Simulates realistic warehouse load patterns with seasonal trends.
    Returns (X, y) arrays for Random Forest.
    """
    np.random.seed(42)
    rows = []
 
    for _ in range(n_warehouses):
        capacity = np.random.randint(500, 5000)
        base_load = np.random.randint(int(capacity * 0.2), int(capacity * 0.8))
        incoming = np.random.randint(0, int(capacity * 0.4))
        velocity = np.random.uniform(-50, 100)  # units/hour
 
        # Ground truth: overflow_risk based on physics
        projected_load = base_load + incoming + velocity * 24
        overflow_risk = np.clip((projected_load / capacity) * 100, 0, 100)
 
        fill_ratio = base_load / capacity
        incoming_fill = (base_load + incoming) / capacity
        available_space = max(capacity - base_load, 0)
 
        rows.append([
            base_load, capacity, incoming,
            fill_ratio, incoming_fill, available_space,
            velocity,
            base_load * np.random.uniform(0.9, 1.0),
            base_load * np.random.uniform(1.0, 1.1),
            velocity * np.random.uniform(0.8, 1.2),
            overflow_risk  # label
        ])
 
    data = np.array(rows)
    X = data[:, :-1]
    y = data[:, -1]
    return X, y

# ─────────────────────────────────────────────────────────────────────────────
# 4.  MODEL TRAINING
# ─────────────────────────────────────────────────────────────────────────────

def train_random_forest(X_train, y_train, X_test, y_test):
    """Train Random Forest regression model."""
    print("  Training Random Forest ...")
    rf = RandomForestRegressor(
        n_estimators=200,
        max_depth=10,
        min_samples_leaf=2,
        random_state=42,
        n_jobs=-1,
    )
    rf.fit(X_train, y_train)
    preds = rf.predict(X_test)
    mae = mean_absolute_error(y_test, preds)
    print(f"  Random Forest MAE: {mae:.2f}%")
    return rf
 
 
def build_lstm_model(seq_len: int = 24, n_features: int = 3):
    """Build LSTM model architecture."""
    model = Sequential([
        LSTM(64, input_shape=(seq_len, n_features), return_sequences=True),
        Dropout(0.2),
        LSTM(32, return_sequences=False),
        Dropout(0.2),
        Dense(16, activation="relu"),
        Dense(1, activation="sigmoid"),  # outputs 0–1; multiply by 100 for %
    ])
    model.compile(optimizer="adam", loss="mse", metrics=["mae"])
    return model
 
 
def train_lstm(X_seq_train, y_train_norm, X_seq_test, y_test_norm):
    """Train LSTM model on sequence data."""
    print("  Training LSTM ...")
    model = build_lstm_model(seq_len=X_seq_train.shape[1], n_features=X_seq_train.shape[2])
    es = EarlyStopping(monitor="val_loss", patience=5, restore_best_weights=True)
    model.fit(
        X_seq_train, y_train_norm,
        validation_data=(X_seq_test, y_test_norm),
        epochs=50,
        batch_size=32,
        callbacks=[es],
        verbose=0,
    )
    loss, mae = model.evaluate(X_seq_test, y_test_norm, verbose=0)
    print(f"  LSTM MAE: {mae * 100:.2f}%")
    return model
 
 
def generate_synthetic_sequences(n: int = 500, seq_len: int = 24):
    """Generate synthetic LSTM sequences for training."""
    np.random.seed(42)
    X_seqs = []
    y_vals = []
 
    for _ in range(n):
        capacity = np.random.randint(500, 5000)
        base = np.random.randint(100, capacity)
        trend = np.random.uniform(-10, 30)  # load change per step
 
        loads = [max(0, base + trend * i + np.random.normal(0, 20)) for i in range(seq_len)]
        vels = [trend + np.random.normal(0, 5)] * seq_len
        avgs = pd.Series(loads).rolling(6, min_periods=1).mean().tolist()
 
        seq = np.column_stack([loads, vels, avgs])
        X_seqs.append(seq)
 
        projected = loads[-1] + trend * 24
        risk = np.clip(projected / capacity, 0, 1)
        y_vals.append(risk)
 
    return np.array(X_seqs), np.array(y_vals)

# ─────────────────────────────────────────────────────────────────────────────
# 5.  MAIN TRAINING PIPELINE
# ─────────────────────────────────────────────────────────────────────────────

def main():
    print("=" * 60)
    print("IGNIS — Warehouse Overflow Prediction — Training Pipeline")
    print("=" * 60)
 
    # ── Random Forest Training ──────────────────────────────────────────────
    print("\n[1/3] Generating training data ...")
    X, y = generate_real_data(days=90)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
 
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
 
    print("\n[2/3] Training models ...")
    rf_model = train_random_forest(X_train_scaled, y_train, X_test_scaled, y_test)
 
    # ── LSTM Training ───────────────────────────────────────────────────────
    X_seq, y_seq = generate_real_sequences(days=90)
    Xs_train, Xs_test, ys_train, ys_test = train_test_split(X_seq, y_seq, test_size=0.2, random_state=42)
    lstm_model = train_lstm(Xs_train, ys_train, Xs_test, ys_test)
 
    # ── Save artifacts ──────────────────────────────────────────────────────
    print("\n[3/3] Saving model artifacts ...")
    joblib.dump(rf_model, os.path.join(MODEL_DIR, "random_forest.pkl"))
    joblib.dump(scaler, os.path.join(MODEL_DIR, "scaler.pkl"))
    lstm_model.save(os.path.join(MODEL_DIR, "lstm_model.keras"))
    print(f"  Models saved to {MODEL_DIR}/")
 
    print("\n✅ Training complete!")
    print("   Run `python api.py` to start the prediction API.")
 
 
if __name__ == "__main__":
    main()
 
