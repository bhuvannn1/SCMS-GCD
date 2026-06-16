import React, { useState, useEffect } from 'react';
import axios from 'axios';
import useWarehouseStore from '../store/warehouseStore';
const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const WarehouseAlertBanner = () => {
    // Reading alerts from the Zustand store
    const { alerts, removeAlert } = useWarehouseStore();
    
    // For CSS transition on mount and dropdown toggle
    const [mounted, setMounted] = useState(false);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Automatically close the dropdown if the last alert is dismissed/accepted
    useEffect(() => {
        if (!alerts || alerts.length === 0) {
            setIsOpen(false);
        }
    }, [alerts]);

    // If no alerts exist at all, render nothing
    if (!alerts || alerts.length === 0) return null;

    const handleAccept = async (alert) => {
        try {
            // Call the backend route
            await axios.post(`${API}/api/warehouse/reroute`, {
                truckId: alert.truckId || 'TRK-UNKNOWN', // Fallback if truckId is not in alert
                fromWarehouseId: alert.fromWarehouseId,
                toWarehouseId: alert.toWarehouseId,
                reason: `Automated reroute accepted due to overflow (${alert.fillPercent}%)`
            });
            
            // Remove the alert from the store
            if (removeAlert) {
                removeAlert(alert.id);
            }
            
            console.log("Reroute successful for truck:", alert.truckId);
        } catch (error) {
            console.error("Failed to accept reroute:", error);
            window.alert("Failed to process reroute. Check console for details.");
        }
    };

    const handleDismiss = (alertId) => {
        if (removeAlert) {
            removeAlert(alertId);
        }
    };

    return (
        <div className="warehouse-alert-banner-container" style={{
            position: 'fixed',
            top: '11px',
            right: '20px',
            zIndex: 9999,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end', // Align items to the right
            gap: '12px',
            opacity: mounted ? 1 : 0,
            transition: 'opacity 0.4s ease'
        }}>
            {/* Notification Bell Button */}
            <button 
                className="alert-banner-btn"
                onClick={() => setIsOpen(!isOpen)}
                style={{
                    backgroundColor: 'white',
                    border: '1px solid #e2e8f0',
                    borderRadius: '50%',
                    width: '48px',
                    height: '48px',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
                    position: 'relative',
                    transition: 'transform 0.2s, box-shadow 0.2s',
                    outline: 'none'
                }}
                onMouseOver={(e) => {
                    e.currentTarget.style.transform = 'scale(1.05)';
                    e.currentTarget.style.boxShadow = '0 6px 8px rgba(0, 0, 0, 0.15)';
                }}
                onMouseOut={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.boxShadow = '0 4px 6px rgba(0, 0, 0, 0.1)';
                }}
            >
                <span style={{ fontSize: '20px' }}>🔔</span>
                {/* Red Notification Badge */}
                <div style={{
                    position: 'absolute',
                    top: '-4px',
                    right: '-4px',
                    backgroundColor: '#f97316',
                    color: 'white',
                    fontSize: '12px',
                    fontWeight: 'bold',
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    border: '2px solid white',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                }}>
                    {alerts.length}
                </div>
            </button>

            {/* Alert List Dropdown */}
            {isOpen && (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '10px',
                    width: '320px',
                    maxWidth: '90vw',
                    animation: 'slideInDown 0.2s ease-out forwards',
                    transformOrigin: 'top right'
                }}>
                    {alerts.map((alert) => (
                        <div key={alert.id} style={{
                            backgroundColor: '#fff7ed',
                            border: '1px solid #fed7aa',
                            borderLeft: '4px solid #f97316',
                            borderRadius: '6px',
                            padding: '12px 14px',
                            boxShadow: '0 8px 16px rgba(0, 0, 0, 0.15)',
                            display: 'flex',
                            flexDirection: 'column'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h4 style={{ margin: '0 0 4px 0', color: '#c2410c', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                        <span>⚠️</span> Overflow: {alert.warehouseName}
                                    </h4>
                                    <p style={{ margin: '0 0 2px 0', color: '#7c2d12', fontSize: '0.85rem' }}>
                                        Fill: <span style={{ color: '#f97316', fontWeight: 'bold' }}>{alert.fillPercent}%</span>
                                    </p>
                                    <p style={{ margin: '0', color: '#7c2d12', fontSize: '0.85rem' }}>
                                        Alternate: {alert.alternateSuggested}
                                    </p>
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', gap: '8px', marginTop: '10px', justifyContent: 'flex-end' }}>
                                <button 
                                    onClick={() => handleDismiss(alert.id)}
                                    style={{
                                        backgroundColor: 'transparent',
                                        border: '1px solid #fdba74',
                                        color: '#f97316',
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        fontSize: '0.8rem',
                                        transition: 'background-color 0.2s'
                                    }}
                                    onMouseOver={(e) => e.target.style.backgroundColor = '#ffedd5'}
                                    onMouseOut={(e) => e.target.style.backgroundColor = 'transparent'}
                                >
                                    Dismiss
                                </button>
                                <button 
                                    onClick={() => handleAccept(alert)}
                                    style={{
                                        backgroundColor: '#f97316',
                                        border: 'none',
                                        color: 'white',
                                        padding: '4px 10px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        fontWeight: '600',
                                        fontSize: '0.8rem',
                                        boxShadow: '0 2px 4px rgba(249, 115, 22, 0.3)',
                                        transition: 'background-color 0.2s, transform 0.1s'
                                    }}
                                    onMouseOver={(e) => e.target.style.backgroundColor = '#ea580c'}
                                    onMouseOut={(e) => e.target.style.backgroundColor = '#f97316'}
                                    onMouseDown={(e) => e.target.style.transform = 'scale(0.97)'}
                                    onMouseUp={(e) => e.target.style.transform = 'scale(1)'}
                                >
                                    Accept Reroute
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
            
            <style>
                {`
                @keyframes slideInDown {
                    from { opacity: 0; transform: translateY(-10px) scale(0.95); }
                    to { opacity: 1; transform: translateY(0) scale(1); }
                }
                `}
            </style>
        </div>
    );
};

export default WarehouseAlertBanner;
