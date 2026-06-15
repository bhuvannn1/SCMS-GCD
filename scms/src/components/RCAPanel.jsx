import React, { useEffect, useState } from 'react';

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const RCAPanel = ({ orderId, delayHours = 0, onClose, mockRca }) => {
  const [loading, setLoading] = useState(!mockRca);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(mockRca || null);

  useEffect(() => {
    if (mockRca || !orderId) return;

    const analyzeDelay = async () => {
      setLoading(true);
      setError(null);
      try {
        const now = new Date();
        const planned = new Date(now.getTime() - Number(delayHours || 0) * 3600000);
        const response = await fetch(`${API}/api/rca/analyze`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            orderId,
            delayHours,
            plannedETA: planned.toISOString(),
            actualETA: now.toISOString()
          })
        });

        const data = await response.json();
        if (!response.ok || !data.success) {
          throw new Error(data.error || 'Failed to analyze shipment delay');
        }
        setResult(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    analyzeDelay();
  }, [orderId, delayHours, mockRca]);

  const rca = result?.rca || result;
  const calculated = rca?.calculated || result?.calculationUsed || {};
  const velocity = calculated.velocity || {};
  const weather = calculated.weather || {};
  const route = calculated.route || {};

  const metricBox = (label, value, accent = '#0f172a') => (
    <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
      <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#64748b', fontWeight: 800 }}>{label}</div>
      <div style={{ marginTop: '4px', color: accent, fontWeight: 900, fontSize: '1rem' }}>{value}</div>
    </div>
  );

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 10000,
      background: 'rgba(15, 23, 42, 0.55)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        width: 'min(920px, 96vw)',
        maxHeight: '90vh',
        overflowY: 'auto',
        background: '#ffffff',
        borderRadius: '12px',
        border: '1px solid #e2e8f0',
        boxShadow: '0 24px 80px rgba(15, 23, 42, 0.24)'
      }}>
        <div style={{
          padding: '18px 22px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          gap: '16px',
          alignItems: 'flex-start'
        }}>
          <div>
            <div style={{ fontSize: '0.72rem', color: '#f97316', fontWeight: 900, textTransform: 'uppercase' }}>AI Root Cause Analysis</div>
            <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: '#0f172a' }}>Shipment {orderId}</h2>
          </div>
          <button onClick={onClose} style={{ border: '1px solid #cbd5e1', background: '#fff', borderRadius: '8px', padding: '8px 12px', cursor: 'pointer', fontWeight: 800 }}>Close</button>
        </div>

        <div style={{ padding: '22px' }}>
          {loading && <div style={{ color: '#64748b', fontWeight: 700 }}>Calculating route, velocity, weather, and delay impact...</div>}
          {error && <div style={{ color: '#dc2626', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '12px' }}>{error}</div>}

          {!loading && !error && rca && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
              <div style={{ border: '1px solid #fed7aa', background: '#fff7ed', borderRadius: '8px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: '0.7rem', color: '#9a3412', fontWeight: 900, textTransform: 'uppercase' }}>Primary Cause</div>
                    <h3 style={{ margin: '4px 0 0', color: '#7c2d12', fontSize: '1.1rem' }}>{rca.primaryCause}</h3>
                  </div>
                  <div style={{ color: '#c2410c', fontWeight: 900 }}>Confidence: {rca.confidence || 'N/A'}</div>
                </div>
                <p style={{ margin: '10px 0 0', color: '#7c2d12', lineHeight: 1.5 }}>{rca.summary}</p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
                {metricBox('Expected speed', `${velocity.expectedVelocityKmh ?? route.expectedVelocityKmh ?? 40} km/h`)}
                {metricBox('Actual speed', `${velocity.actualVelocityKmh ?? 0} km/h`, velocity.abnormalSpeedDegradation ? '#dc2626' : '#059669')}
                {metricBox('Speed degradation', `${velocity.degradationPercent ?? 0}%`, velocity.abnormalSpeedDegradation ? '#dc2626' : '#059669')}
                {metricBox('Projected delay', `${calculated.projectedDelayHours ?? velocity.projectedDelayHours ?? delayHours} hours`, '#f97316')}
                {metricBox('Weather severity', `${weather.severityScore ?? 0}/100`, weather.likelyWeatherDelay ? '#dc2626' : '#059669')}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                <section>
                  <h4 style={{ margin: '0 0 10px', color: '#0f172a' }}>Calculated Factors</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(rca.contributingFactors || []).map((factor, index) => (
                      <div key={`${factor.factor}-${index}`} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                          <strong style={{ color: '#0f172a' }}>{factor.factor}</strong>
                          <span style={{ color: '#f97316', fontWeight: 900 }}>{factor.weight}</span>
                        </div>
                        <p style={{ margin: '6px 0 0', color: '#64748b', lineHeight: 1.45 }}>{factor.description}</p>
                      </div>
                    ))}
                  </div>
                </section>

                <section>
                  <h4 style={{ margin: '0 0 10px', color: '#0f172a' }}>Recommendations</h4>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {(rca.recommendedActions || []).map((action, index) => (
                      <div key={`${action.action}-${index}`} style={{ border: '1px solid #e2e8f0', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px' }}>
                          <strong style={{ color: '#0f172a' }}>{action.action}</strong>
                          <span style={{ color: action.priority === 'High' ? '#dc2626' : '#f97316', fontWeight: 900 }}>{action.priority}</span>
                        </div>
                        <p style={{ margin: '6px 0 0', color: '#64748b', lineHeight: 1.45 }}>{action.description}</p>
                      </div>
                    ))}
                  </div>
                </section>
              </div>

              <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '14px', color: '#475569', lineHeight: 1.5 }}>
                <strong>Business impact:</strong> {rca.businessImpact}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RCAPanel;
