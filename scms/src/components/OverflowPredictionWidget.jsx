import { useState, useEffect, useCallback } from "react";


const API_BASE = process.env.REACT_APP_ML_API_URL || "http://localhost:5001";

// ─────────────────────────────────────────────────────────────────────────────
// RISK COLOUR HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function riskColor(pct) {
  if (pct >= 85) return { bg: "#fee2e2", border: "#ef4444", text: "#991b1b", label: "CRITICAL" };
  if (pct >= 65) return { bg: "#ffedd5", border: "#f97316", text: "#9a3412", label: "HIGH" };
  if (pct >= 40) return { bg: "#fef9c3", border: "#eab308", text: "#713f12", label: "MODERATE" };
  if (pct >= 20) return { bg: "#dcfce7", border: "#22c55e", text: "#14532d", label: "LOW" };
  return { bg: "#f0fdf4", border: "#86efac", text: "#166534", label: "SAFE" };
}

function RiskGauge({ pct }) {
  const c = riskColor(pct);
  const angle = (pct / 100) * 180; // 0–180° arc

  // SVG arc path helper
  function polarToXY(angleDeg, r) {
    const rad = ((angleDeg - 180) * Math.PI) / 180;
    return { x: 60 + r * Math.cos(rad), y: 60 + r * Math.sin(rad) };
  }

  function arc(startDeg, endDeg, r) {
    const s = polarToXY(startDeg, r);
    const e = polarToXY(endDeg, r);
    const large = endDeg - startDeg > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${r} ${r} 0 ${large} 1 ${e.x} ${e.y}`;
  }

  return (
    <svg viewBox="0 0 120 70" width="120" height="70" aria-label={`Risk: ${pct}%`}>
      {/* Background track */}
      <path d={arc(0, 180, 48)} fill="none" stroke="#e5e7eb" strokeWidth="10" strokeLinecap="round" />
      {/* Filled arc */}
      {pct > 0 && (
        <path
          d={arc(0, angle, 48)}
          fill="none"
          stroke={c.border}
          strokeWidth="10"
          strokeLinecap="round"
        />
      )}
      {/* Centre text */}
      <text x="60" y="58" textAnchor="middle" fontSize="14" fontWeight="700" fill={c.text}>
        {pct.toFixed(0)}%
      </text>
    </svg>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SINGLE WAREHOUSE CARD
// ─────────────────────────────────────────────────────────────────────────────

function PredictionCard({ prediction }) {
  const {
    warehouse_name,
    overflow_risk_percentage: risk,
    expected_overflow_time,
    recommended_action,
    load_velocity_per_hour: velocity,
    current_load,
    incoming_load,
    capacity,
    fill_ratio_pct,
    weather,
  } = prediction;

  const c = riskColor(risk ?? 0);
  const fillBarWidth = Math.min(fill_ratio_pct ?? 0, 100);

  function formatTime(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    const hours = Math.round((d - Date.now()) / 3600000);
    if (hours < 1) return "within the hour";
    if (hours < 24) return `~${hours}h from now`;
    const days = Math.floor(hours / 24);
    return `~${days}d from now`;
  }

  return (
    <div
      style={{
        border: `2px solid ${c.border}`,
        borderRadius: "12px",
        padding: "16px",
        backgroundColor: "#ffffff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "12px" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: "15px", color: "#1a1a2e", marginBottom: "2px" }}>
            {warehouse_name || "Warehouse"}
          </div>
          <span
            style={{
              fontSize: "11px",
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: "20px",
              backgroundColor: c.bg,
              color: c.text,
              border: `1px solid ${c.border}`,
            }}
          >
            {c.label}
          </span>
        </div>
        <RiskGauge pct={risk ?? 0} />
      </div>

      {/* Capacity bar */}
      <div style={{ marginBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#6b7280", marginBottom: "4px" }}>
          <span>Capacity used (incl. incoming)</span>
          <span>{fillBarWidth.toFixed(1)}%</span>
        </div>
        <div style={{ height: "8px", borderRadius: "4px", backgroundColor: "#f3f4f6", overflow: "hidden" }}>
          <div
            style={{
              height: "100%",
              width: `${fillBarWidth}%`,
              backgroundColor: c.border,
              borderRadius: "4px",
              transition: "width 0.6s ease",
            }}
          />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#9ca3af", marginTop: "3px" }}>
          <span>Current: {current_load?.toLocaleString()} units</span>
          <span>Incoming: +{incoming_load?.toLocaleString()}</span>
          <span>Max: {capacity?.toLocaleString()}</span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
        <StatChip
          label="Load Velocity"
          value={velocity != null ? `${velocity > 0 ? "+" : ""}${velocity.toFixed(1)} u/hr` : "—"}
          warn={velocity > 50}
        />
        <StatChip
          label="Est. Overflow"
          value={expected_overflow_time ? formatTime(expected_overflow_time) : "None forecast"}
          warn={!!expected_overflow_time}
        />
      </div>

      {/* Weather */}
      {weather && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            padding: "6px 10px",
            borderRadius: "8px",
            backgroundColor: weather.alert ? "#fef2f2" : "#f9fafb",
            marginBottom: "10px",
            fontSize: "12px",
            color: weather.alert ? "#b91c1c" : "#6b7280",
          }}
        >
          <span>{weather.alert ? "⚠️" : "🌤️"}</span>
          <span>
            {weather.description}
            {weather.temperature_c != null && ` · ${weather.temperature_c}°C`}
            {weather.alert && " — logistics disruption likely"}
          </span>
        </div>
      )}

      {/* Recommended action */}
      <div
        style={{
          fontSize: "12px",
          padding: "8px 12px",
          borderRadius: "8px",
          backgroundColor: c.bg,
          color: c.text,
          lineHeight: "1.5",
        }}
      >
        {recommended_action}
      </div>
    </div>
  );
}

function StatChip({ label, value, warn }) {
  return (
    <div
      style={{
        padding: "8px 10px",
        borderRadius: "8px",
        backgroundColor: warn ? "#fff7ed" : "#f9fafb",
        border: `1px solid ${warn ? "#fed7aa" : "#e5e7eb"}`,
      }}
    >
      <div style={{ fontSize: "10px", color: "#9ca3af", marginBottom: "2px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {label}
      </div>
      <div style={{ fontSize: "13px", fontWeight: 600, color: warn ? "#c2410c" : "#1a1a2e" }}>
        {value}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN WIDGET
// ─────────────────────────────────────────────────────────────────────────────

export default function OverflowPredictionWidget({ warehouseId }) {
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchPredictions = useCallback(async (fresh = false) => {
    try {
      setRefreshing(true);
      const url = warehouseId
        ? `${API_BASE}/api/predict/${warehouseId}${fresh ? "?fresh=true" : ""}`
        : `${API_BASE}/api/predict/all${fresh ? "?fresh=true" : ""}`;

      const resp = await fetch(url);
      if (!resp.ok) throw new Error(`API error ${resp.status}`);
      const data = await resp.json();

      if (warehouseId) {
        // Single warehouse — wrap in array
        const pred = data.prediction;
        setPredictions(pred ? [pred] : []);
      } else {
        setPredictions(data.predictions || []);
      }
      setLastUpdated(new Date());
      setError(null);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    fetchPredictions();
    // Auto-refresh every 5 minutes
    const interval = setInterval(() => fetchPredictions(), 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchPredictions]);

  const criticalCount = predictions.filter(p => (p.overflow_risk_percentage ?? 0) >= 65).length;

  return (
    <div style={{ fontFamily: "'DM Sans', sans-serif" }}>
      {/* Widget header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: 700, color: "#1a1a2e" }}>
            Overflow Risk Monitor
          </h2>
          {criticalCount > 0 && (
            <span style={{ fontSize: "12px", color: "#dc2626", fontWeight: 600 }}>
              ⚠ {criticalCount} warehouse{criticalCount > 1 ? "s" : ""} at high risk
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {lastUpdated && (
            <span style={{ fontSize: "11px", color: "#9ca3af" }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={() => fetchPredictions(true)}
            disabled={refreshing}
            style={{
              padding: "6px 14px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "8px",
              border: "1px solid #1a1a2e",
              backgroundColor: refreshing ? "#f3f4f6" : "#1a1a2e",
              color: refreshing ? "#9ca3af" : "#ffffff",
              cursor: refreshing ? "not-allowed" : "pointer",
              transition: "all 0.2s",
            }}
          >
            {refreshing ? "Updating…" : "↻ Refresh"}
          </button>
        </div>
      </div>

      {/* Body */}
      {loading && (
        <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
          Loading predictions…
        </div>
      )}

      {error && (
        <div
          style={{
            padding: "16px",
            borderRadius: "10px",
            backgroundColor: "#fef2f2",
            border: "1px solid #fecaca",
            color: "#b91c1c",
            fontSize: "13px",
          }}
        >
          <strong>Could not reach prediction API</strong>
          <br />
          {error}
          <br />
          <span style={{ color: "#9ca3af", fontSize: "12px" }}>
            Live ML Engine unreachable.
          </span>
        </div>
      )}

      {!loading && !error && predictions.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "#9ca3af" }}>
          No predictions available yet. Run a warehouse snapshot first.
        </div>
      )}

      {/* Cards grid */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
          gap: "16px",
        }}
      >
        {predictions.map((pred) => (
          <PredictionCard
            key={pred.warehouse_id || pred.id}
            prediction={pred}
          />
        ))}
      </div>
    </div>
  );
}