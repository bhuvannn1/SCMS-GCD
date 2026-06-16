import React, { useEffect, useState } from 'react';
import { AlertTriangle, Activity, RefreshCw } from 'lucide-react';
import supabase from '../config/SupabaseClient';
import useWarehouseMonitor from '../hooks/useWarehouseMonitor';
import WarehouseMap from '../components/WarehouseMap';
import axios from 'axios';
import {
    AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
    CartesianGrid, ReferenceLine
} from 'recharts';

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const WarehousePage = () => {
    // 1. Hook into our global state monitor
    const { warehouses, overflowing } = useWarehouseMonitor();

    // Local state for the reroute count
    const [reroutesToday, setReroutesToday] = useState(0);

    // Override Reroute Modal States
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);

    // Integrated ML Prediction Dashboard States
    const [activeTab, setActiveTab] = useState('map'); // 'map' or 'ml_predictions'
    const [predictions, setPredictions] = useState([]);
    const [loadingPredictions, setLoadingPredictions] = useState(false);
    const [mlApiOnline, setMlApiOnline] = useState(true);
    const [selectedWhForChart, setSelectedWhForChart] = useState(null);
    const [whHistoryData, setWhHistoryData] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);

    // Main Facilities List States
    const [warehouseSearch, setWarehouseSearch] = useState('');
    const [warehouseFilter, setWarehouseFilter] = useState('all'); // 'all', 'overflowing', 'normal'
    const [warehouseSort, setWarehouseSort] = useState('name'); // 'name', 'fillPercent', 'max_capacity'
    const [warehouseSortOrder, setWarehouseSortOrder] = useState('asc');

    // Map controller state
    const [mapCenter, setMapCenter] = useState([20.5937, 78.9629]);
    const [mapZoom, setMapZoom] = useState(5);

    const [loads, setLoads] = useState([]);
    const [selectedLoadId, setSelectedLoadId] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState('name');
    const [filterBy, setFilterBy] = useState('all');
    const [rejectedWarehouseIds, setRejectedWarehouseIds] = useState(new Set());
    const [loadingReroute, setLoadingReroute] = useState(false);
    const [successMessage, setSuccessMessage] = useState('');
    const [errorMessage, setErrorMessage] = useState('');

    const fetchPredictions = async () => {
        setLoadingPredictions(true);
        try {
            const res = await axios.get('http://localhost:5001/api/predict/all');
            if (res.data && res.data.predictions) {
                setPredictions(res.data.predictions);
                setMlApiOnline(true);
                if (res.data.predictions.length > 0 && !selectedWhForChart) {
                    const firstId = res.data.predictions[0].warehouse_id;
                    setSelectedWhForChart(firstId);
                    fetchHistory(firstId);
                }
            } else {
                throw new Error("Failed success field");
            }
        } catch (err) {
            console.warn("Prediction API offline. Falling back to local calculations.");
            setMlApiOnline(false);

            // Fallback simulated predictions based on active warehouses data
            const fallbackPreds = warehouses.map(w => {
                const capacity = w.max_capacity || 1;
                const totalLoad = w.current_load + w.reserved_space;
                const fillPercent = totalLoad / capacity;

                const nameHash = w.name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const simulatedVelocity = (nameHash % 20) - 8; // -8 to +11 tons/hour

                let risk = 0;
                if (fillPercent > 0.85) risk = 85 + (nameHash % 15);
                else if (fillPercent > 0.65) risk = 40 + (nameHash % 25);
                else risk = nameHash % 15;

                const expectedTime = risk > 50
                    ? new Date(Date.now() + (24 - (risk % 16)) * 3600000).toISOString()
                    : null;

                let action = "SAFE: Operating levels are normal. No actions required.";
                if (risk > 75) {
                    const alternateWh = warehouses.find(alt => alt.id !== w.id && (alt.current_load / alt.max_capacity) < 0.6);
                    const altName = alternateWh ? ` to ${alternateWh.name}` : "";
                    action = `CRITICAL: Reroute incoming shipments${altName} immediately to avoid severe overflow.`;
                } else if (risk >= 40) {
                    action = "WARNING: Halt new inbound orders and prioritize outbound dispatches.";
                }

                return {
                    warehouse_id: w.id,
                    warehouse_name: w.name,
                    max_capacity: w.max_capacity,
                    current_load: totalLoad,
                    fill_ratio_pct: ((totalLoad / capacity) * 100).toFixed(1),
                    load_velocity_per_hour: simulatedVelocity,
                    overflow_risk_percentage: risk,
                    expected_overflow_time: expectedTime,
                    recommended_action: action,
                    predicted_load_24h: totalLoad + (simulatedVelocity * 24),
                    predicted_load_48h: totalLoad + (simulatedVelocity * 48)
                };
            });
            setPredictions(fallbackPreds);
            if (fallbackPreds.length > 0 && !selectedWhForChart) {
                const firstId = fallbackPreds[0].warehouse_id;
                setSelectedWhForChart(firstId);
                fetchHistory(firstId);
            }
        } finally {
            setLoadingPredictions(false);
        }
    };

    const fetchHistory = async (whId) => {
        setLoadingHistory(true);
        try {
            const res = await axios.get(`http://localhost:5001/api/history/${whId}`);
            if (res.data && res.data.success) {
                setWhHistoryData(res.data.history);
            } else {
                throw new Error("Failed history fetch");
            }
        } catch (err) {
            // Generate fallback simulated history for the chart
            const points = [];
            const now = Date.now();
            const w = warehouses.find(wh => wh.id === whId) || { max_capacity: 1000, current_load: 500 };
            const load = w.current_load;

            for (let i = 24; i >= 0; i--) {
                const recorded_at = new Date(now - i * 3600000).toISOString();
                const cycle = Math.sin((i - 6) / 24 * 2 * Math.PI) * (w.max_capacity * 0.05);
                const randomOffset = ((i * 7 + 13) % 17) - 8;
                points.push({
                    warehouse_id: whId,
                    current_load: Math.max(0, Math.min(w.max_capacity, Math.round(load - (24 - i) * 1.5 + cycle + randomOffset))),
                    recorded_at
                });
            }
            setWhHistoryData(points);
        } finally {
            setLoadingHistory(false);
        }
    };

    const fetchReroutes = async () => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const { count, error } = await supabase
            .from('truck_reroutes')
            .select('*', { count: 'exact', head: true })
            .gte('rerouted_at', today.toISOString());

        if (!error && count !== null) {
            setReroutesToday(count);
        } else if (error) {
            console.error("Error fetching reroutes:", error);
        }
    };

    const isLoadHeadedToWarehouse = (load, warehouse) => {
        if (!load.drop || !warehouse || !warehouse.name) return false;
        const drop = load.drop.trim().toLowerCase();
        const name = warehouse.name.trim().toLowerCase();
        return name.includes(drop) || drop.includes(name);
    };

    const fetchLoadsData = async () => {
        const { data, error } = await supabase
            .from('Load')
            .select(`
                *,
                driver:profiles!driver_id (
                    full_name,
                    phone
                )
            `);
        if (!error && data) {
            const mappedLoads = data.map(l => ({
                ...l,
                assigned_driver: l.driver?.full_name || 'None',
                phone: l.driver?.phone || null
            }));
            setLoads(mappedLoads);
        } else if (error) {
            console.error("Error fetching loads:", error);
        }
    };

    // 2. Fetch today's auto-reroute count and active loads from Supabase
    useEffect(() => {
        fetchReroutes();
        fetchLoadsData();
    }, []);

    // Fetch active loads when override reroute modal opens
    useEffect(() => {
        if (selectedWarehouse) {
            fetchLoadsData();
            // Reset inputs
            setSelectedLoadId('');
            setSearchQuery('');
            setSortBy('name');
            setFilterBy('all');
            setRejectedWarehouseIds(new Set());
            setSuccessMessage('');
            setErrorMessage('');
        }
    }, [selectedWarehouse]);

    // Trigger prediction loading when activeTab shifts to predictions or warehouses update
    useEffect(() => {
        if (activeTab === 'ml_predictions') {
            fetchPredictions();
        }
    }, [activeTab, warehouses]);

    const handleAcceptReroute = async (targetWarehouse) => {
        if (!selectedLoadId) {
            setErrorMessage('Please select an active order/truck to reroute first.');
            return;
        }

        setLoadingReroute(true);
        setErrorMessage('');
        setSuccessMessage('');

        const selectedLoad = loads.find(l => l.load_id === selectedLoadId);

        try {
            await axios.post(`${API}/api/warehouse/reroute`, {
                truckId: selectedLoad.load_id || selectedLoad.assigned_driver || 'TRK-UNKNOWN',
                fleetId: selectedLoad.fleet_id || null,
                loadId: selectedLoad.load_id || null,
                fromWarehouseId: selectedWarehouse.id,
                toWarehouseId: targetWarehouse.id,
                reason: `Manual override reroute to ${targetWarehouse.name} accepted`
            });

            setSuccessMessage(`Reroute accepted! Order for ${selectedLoad.customer} is successfully rerouted to ${targetWarehouse.name}.`);

            // Reload the statistics and loads
            await fetchReroutes();
            await fetchLoadsData();

            // Clear selected load and warehouse after a short delay
            setTimeout(() => {
                setSelectedWarehouse(null);
            }, 3000);
        } catch (error) {
            console.error("Failed to process reroute:", error);
            setErrorMessage("Failed to process override reroute. Please check the backend server logs.");
        } finally {
            setLoadingReroute(false);
        }
    };

    const handleRejectWarehouse = (targetWarehouseId) => {
        setRejectedWarehouseIds(prev => {
            const updated = new Set(prev);
            updated.add(targetWarehouseId);
            return updated;
        });
    };

    // Filter, sort and search alternate warehouses
    const getAlternativeWarehouses = () => {
        if (!selectedWarehouse) return [];

        let list = warehouses.filter(w => w.id !== selectedWarehouse.id);

        // Filter out rejected ones for this session
        list = list.filter(w => !rejectedWarehouseIds.has(w.id));

        // Search
        if (searchQuery) {
            list = list.filter(w => w.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        // Filter
        if (filterBy === 'under60') {
            list = list.filter(w => w.fillPercent < 0.60);
        } else if (filterBy === 'active') {
            list = list.filter(w => w.status === 'active' || w.status === undefined);
        }

        // Sort
        list.sort((a, b) => {
            if (sortBy === 'name') {
                return a.name.localeCompare(b.name);
            } else if (sortBy === 'fillPercent') {
                return a.fillPercent - b.fillPercent;
            } else if (sortBy === 'max_capacity') {
                return b.max_capacity - a.max_capacity;
            }
            return 0;
        });

        return list;
    };

    const alternatives = getAlternativeWarehouses();

    // Filter warehouses for the side panel
    const filteredWarehouses = warehouses.filter(w => {
        const q = warehouseSearch.toLowerCase();
        const matchesSearch = w.name && w.name.toLowerCase().includes(q);

        const capacity = w.max_capacity || 1;
        const totalLoad = w.current_load + w.reserved_space;
        const fillPercent = totalLoad / capacity;
        const isOverflowing = fillPercent > 0.85;

        const matchesFilter = warehouseFilter === 'all' ||
            (warehouseFilter === 'overflowing' && isOverflowing) ||
            (warehouseFilter === 'normal' && !isOverflowing);

        return matchesSearch && matchesFilter;
    });

    const sortedWarehouses = [...filteredWarehouses].sort((a, b) => {
        let valA = '';
        let valB = '';

        if (warehouseSort === 'name') {
            valA = a.name || '';
            valB = b.name || '';
            return warehouseSortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        } else if (warehouseSort === 'fillPercent') {
            const capA = a.max_capacity || 1;
            const fillA = (a.current_load + a.reserved_space) / capA;
            const capB = b.max_capacity || 1;
            const fillB = (b.current_load + b.reserved_space) / capB;
            return warehouseSortOrder === 'asc' ? fillA - fillB : fillB - fillA;
        } else if (warehouseSort === 'max_capacity') {
            valA = a.max_capacity || 0;
            valB = b.max_capacity || 0;
            return warehouseSortOrder === 'asc' ? valA - valB : valB - valA;
        }
        return 0;
    });

    const handleZoomToWarehouse = (w) => {
        if (w.lat && w.lng) {
            setMapCenter([w.lat, w.lng]);
            setMapZoom(12);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', padding: '20px', boxSizing: 'border-box', position: 'relative', color: 'var(--text-primary)' }}>
            <style>{`
                @keyframes pulsingRisk {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
                .pulsing-risk-badge {
                    animation: pulsingRisk 2s infinite;
                }
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                .spin-animation {
                    animation: spin 1.5s linear infinite;
                    display: inline-block;
                }
            `}</style>

            <h1 style={{ margin: '0 0 24px 0', fontSize: '28px', color: 'var(--accent)', fontWeight: '800', textTransform: 'uppercase' }}>Warehouse Control Center</h1>

            {/* View Selection Tabs */}
            <div style={{
                display: 'flex',
                gap: '12px',
                marginBottom: '20px',
                borderBottom: '1px solid var(--border-color)',
                paddingBottom: '12px'
            }}>
                <button
                    onClick={() => setActiveTab('map')}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: activeTab === 'map' ? 'var(--accent)' : 'var(--bg-card)',
                        color: activeTab === 'map' ? 'white' : 'var(--text-secondary)',
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: activeTab === 'map' ? '0 4px 12px rgba(249, 115, 22, 0.2)' : 'none',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em'
                    }}
                >
                    Live Operations Map
                </button>
                <button
                    onClick={() => {
                        setActiveTab('ml_predictions');
                        fetchPredictions();
                    }}
                    style={{
                        padding: '10px 20px',
                        borderRadius: '8px',
                        border: 'none',
                        backgroundColor: activeTab === 'ml_predictions' ? 'var(--accent)' : 'var(--bg-card)',
                        color: activeTab === 'ml_predictions' ? 'white' : 'var(--text-secondary)',
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s',
                        boxShadow: activeTab === 'ml_predictions' ? '0 4px 12px rgba(249, 115, 22, 0.2)' : 'none',
                        textTransform: 'uppercase',
                        letterSpacing: '0.05em',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px'
                    }}
                >
                    <Activity size={16} /> ML Overflow Forecast
                </button>
            </div>

            {activeTab === 'ml_predictions' ? (
                /* ML Prediction tab view */
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    {/* ML Warning Banner if API is offline */}
                    {!mlApiOnline && (
                        <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '12px',
                            backgroundColor: 'rgba(245, 158, 11, 0.1)',
                            border: '1px solid #f59e0b',
                            borderRadius: '12px',
                            padding: '16px',
                            marginBottom: '20px',
                            color: '#d97706',
                            fontSize: '0.85rem',
                            fontWeight: '600'
                        }}>
                            <AlertTriangle size={20} />
                            <span>ML Engine Server (Port 5001) is offline. Displaying real-time simulated forecasts. Start python api.py to connect live pipeline.</span>
                            <button
                                onClick={fetchPredictions}
                                style={{
                                    marginLeft: 'auto',
                                    border: '1px solid #d97706',
                                    backgroundColor: 'transparent',
                                    color: '#d97706',
                                    padding: '6px 12px',
                                    borderRadius: '6px',
                                    cursor: 'pointer',
                                    fontWeight: 'bold',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '6px'
                                }}>
                                <RefreshCw size={14} /> Retry Connection
                            </button>
                        </div>
                    )}

                    {/* ML KPI Stats Bar */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>High Overflow Risk (24-48h)</h3>
                            <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: predictions.filter(p => p.overflow_risk_percentage > 70).length > 0 ? '#ef4444' : 'var(--text-primary)' }}>
                                {predictions.filter(p => p.overflow_risk_percentage > 70).length}
                            </p>
                        </div>

                        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Average System Risk</h3>
                            <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                {predictions.length > 0 ? Math.round(predictions.reduce((acc, p) => acc + p.overflow_risk_percentage, 0) / predictions.length) : 0}%
                            </p>
                        </div>

                        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Active Stock Trends</h3>
                            <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: '#10b981' }}>
                                {predictions.filter(p => Number(p.load_velocity_per_hour || 0) < 0).length} Draining / {predictions.filter(p => Number(p.load_velocity_per_hour || 0) > 0).length} Filling
                            </p>
                        </div>
                    </div>

                    {/* Main predictions split layout */}
                    <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
                        {/* Left split: Forecast Table */}
                        <div style={{
                            flex: 1.3,
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            boxSizing: 'border-box',
                            minHeight: 0
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h3 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase' }}>ML Overflow Forecasts</h3>
                                <button
                                    onClick={fetchPredictions}
                                    disabled={loadingPredictions}
                                    style={{
                                        border: '1px solid var(--border-color)',
                                        backgroundColor: 'var(--bg-primary)',
                                        color: 'var(--text-primary)',
                                        borderRadius: '8px',
                                        padding: '6px 12px',
                                        fontSize: '0.8rem',
                                        cursor: 'pointer',
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '6px'
                                    }}>
                                    <RefreshCw size={12} className={loadingPredictions ? "spin-animation" : ""} />
                                    {loadingPredictions ? "Predicting..." : "Run Forecast"}
                                </button>
                            </div>

                            {/* Predictions List Container */}
                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                {predictions.length === 0 ? (
                                    <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: '40px', fontStyle: 'italic' }}>
                                        Loading warehouse prediction matrices...
                                    </div>
                                ) : (
                                    predictions.map(p => {
                                        const isSelected = selectedWhForChart === p.warehouse_id;
                                        const load = Number(p.current_load || 0);
                                        const fill = Math.round(Number(p.fill_ratio_pct || 0));

                                        // Risk colors
                                        let riskColor = '#10b981'; // Green
                                        let riskBg = 'rgba(16, 185, 129, 0.1)';
                                        let pulseClass = '';

                                        if (p.overflow_risk_percentage > 70) {
                                            riskColor = '#ef4444'; // Red
                                            riskBg = 'rgba(239, 68, 68, 0.1)';
                                            pulseClass = ' pulsing-risk-badge';
                                        } else if (p.overflow_risk_percentage >= 40) {
                                            riskColor = '#f59e0b'; // Amber
                                            riskBg = 'rgba(245, 158, 11, 0.1)';
                                        }

                                        // Load velocity indicator
                                        const velVal = Number(p.load_velocity_per_hour || 0);
                                        const velSign = velVal > 0 ? '+' : '';
                                        const velColor = velVal > 0 ? '#ef4444' : velVal < 0 ? '#10b981' : 'var(--text-secondary)';

                                        return (
                                            <div
                                                key={p.warehouse_id}
                                                onClick={() => {
                                                    setSelectedWhForChart(p.warehouse_id);
                                                    fetchHistory(p.warehouse_id);
                                                }}
                                                style={{
                                                    border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-color)'}`,
                                                    backgroundColor: isSelected ? 'var(--bg-primary)' : 'var(--bg-primary)',
                                                    opacity: isSelected ? 1 : 0.85,
                                                    borderRadius: '10px',
                                                    padding: '14px 16px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    gap: '15px'
                                                }}
                                                onMouseEnter={(e) => e.currentTarget.style.opacity = 1}
                                                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.opacity = 0.85 }}
                                            >
                                                {/* Left details */}
                                                <div style={{ flex: 1.5, minWidth: 0 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                                        <strong style={{ fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.warehouse_name}</strong>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', width: '100%' }}>
                                                        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-color)', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(fill, 100)}%`, height: '100%', backgroundColor: fill > 85 ? '#ef4444' : fill >= 60 ? '#f59e0b' : '#10b981', borderRadius: '3px' }}></div>
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', minWidth: '35px' }}>{fill}%</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                        Capacity: {load} / {p.max_capacity} tons
                                                    </div>
                                                </div>

                                                {/* Middle stats */}
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Load Velocity</span>
                                                    <span style={{ fontSize: '0.9rem', fontWeight: 'bold', color: velColor, display: 'flex', alignItems: 'center', gap: '2px' }}>
                                                        {velVal > 0 ? '▲' : velVal < 0 ? '▼' : '•'} {velSign}{velVal.toFixed(1)} t/h
                                                    </span>
                                                </div>

                                                {/* Risk tag */}
                                                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold' }}>Overflow Risk</span>
                                                    <span
                                                        className={`risk-badge${pulseClass}`}
                                                        style={{
                                                            fontSize: '0.85rem',
                                                            fontWeight: '800',
                                                            color: riskColor,
                                                            backgroundColor: riskBg,
                                                            padding: '4px 10px',
                                                            borderRadius: '20px',
                                                            border: `1px solid ${riskColor}`
                                                        }}
                                                    >
                                                        {Math.round(p.overflow_risk_percentage)}%
                                                    </span>
                                                </div>

                                                {/* Recommended action shortcut button */}
                                                <div style={{ flex: 1.2, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', justifyContent: 'center' }}>
                                                    {p.overflow_risk_percentage >= 40 ? (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const wh = warehouses.find(wh => wh.id === p.warehouse_id);
                                                                if (wh) {
                                                                    setSelectedWarehouse(wh);
                                                                }
                                                            }}
                                                            style={{
                                                                backgroundColor: '#f97316',
                                                                color: 'white',
                                                                border: 'none',
                                                                borderRadius: '8px',
                                                                padding: '8px 12px',
                                                                fontSize: '0.8rem',
                                                                fontWeight: 'bold',
                                                                cursor: 'pointer',
                                                                boxShadow: '0 4px 6px -1px rgba(249, 115, 22, 0.15)',
                                                                transition: 'transform 0.1s'
                                                            }}
                                                            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.03)'}
                                                            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                        >
                                                            ⚡ Reroute Order
                                                        </button>
                                                    ) : (
                                                        <span style={{ fontSize: '0.75rem', color: '#10b981', fontWeight: '600' }}>✓ Stable</span>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Right split: Details & Recharts History Chart */}
                        <div style={{
                            flex: 1,
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '20px',
                            display: 'flex',
                            flexDirection: 'column',
                            boxSizing: 'border-box',
                            minHeight: 0
                        }}>
                            {(() => {
                                const selectedPred = predictions.find(p => p.warehouse_id === selectedWhForChart);
                                if (!selectedPred) {
                                    return (
                                        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                                            Select a warehouse to view projection trends
                                        </div>
                                    );
                                }

                                const selectedMaxCapacity = Number(selectedPred.max_capacity || 0);
                                const predictedLoad24h = Number(selectedPred.predicted_load_24h || 0);
                                const predictedLoad48h = Number(selectedPred.predicted_load_48h || 0);

                                return (
                                    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
                                        <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '14px', marginBottom: '16px' }}>
                                            <h4 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--text-primary)' }}>{selectedPred.warehouse_name} Analysis</h4>
                                            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                                ML predictive trajectory over the next 24-48 hours.
                                            </p>
                                        </div>

                                        {/* Action Card */}
                                        <div style={{
                                            backgroundColor: selectedPred.overflow_risk_percentage > 70 ? 'rgba(239, 68, 68, 0.05)' : 'rgba(16, 185, 129, 0.05)',
                                            borderLeft: `4px solid ${selectedPred.overflow_risk_percentage > 70 ? '#ef4444' : '#10b981'}`,
                                            padding: '12px 16px',
                                            borderRadius: '6px',
                                            marginBottom: '20px',
                                            fontSize: '0.85rem'
                                        }}>
                                            <strong style={{ display: 'block', color: selectedPred.overflow_risk_percentage > 70 ? '#ef4444' : '#10b981', fontWeight: 'bold', textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.05em', marginBottom: '4px' }}>
                                                {selectedPred.overflow_risk_percentage > 70 ? 'Immediate Action Recommendation' : 'Operational Status'}
                                            </strong>
                                            <span style={{ color: 'var(--text-primary)', fontWeight: '600' }}>{selectedPred.recommended_action}</span>
                                            {selectedPred.expected_overflow_time && (
                                                <div style={{ marginTop: '6px', color: '#ef4444', fontWeight: 'bold' }}>
                                                    ⚠ Estimated Overflow: {new Date(selectedPred.expected_overflow_time).toLocaleString()}
                                                </div>
                                            )}
                                        </div>

                                        {/* Chart Title */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 'bold', textTransform: 'uppercase' }}>Historical Load (Last 24 Hours)</span>
                                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <Activity size={12} color="#f97316" /> Live Feed
                                            </span>
                                        </div>

                                        {/* Recharts Area Chart */}
                                        <div style={{ flex: 1, minHeight: '180px', maxHeight: '240px', width: '100%', marginBottom: '16px' }} className="notranslate">
                                            {loadingHistory ? (
                                                <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                                                    Syncing historical snapshots...
                                                </div>
                                            ) : whHistoryData.length === 0 ? (
                                                <div style={{ height: '100%', display: 'flex', justifyContent: 'center', alignItems: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                                                    No history log found.
                                                </div>
                                            ) : (
                                                <ResponsiveContainer width="100%" height="100%">
                                                    <AreaChart data={whHistoryData.map(h => ({
                                                        time: new Date(h.recorded_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
                                                        load: h.current_load
                                                    }))} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                                                        <defs>
                                                            <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                                                                <stop offset="5%" stopColor="#f97316" stopOpacity={0.4} />
                                                                <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                                                            </linearGradient>
                                                        </defs>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" opacity={0.3} />
                                                        <XAxis dataKey="time" stroke="var(--text-secondary)" fontSize={9} />
                                                        <YAxis stroke="var(--text-secondary)" fontSize={9} />
                                                        <Tooltip contentStyle={{ backgroundColor: 'var(--bg-card)', borderColor: 'var(--border-color)', color: 'var(--text-primary)' }} />
                                                        <ReferenceLine y={selectedMaxCapacity} stroke="#ef4444" strokeDasharray="4 4" label={{ value: 'Capacity', fill: '#ef4444', fontSize: 10, position: 'top' }} />
                                                        <Area type="monotone" dataKey="load" name="Load (tons)" stroke="#f97316" strokeWidth={2} fillOpacity={1} fill="url(#chartGradient)" />
                                                    </AreaChart>
                                                </ResponsiveContainer>
                                            )}
                                        </div>

                                        {/* Trajectory projection details */}
                                        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '2px' }}>Predicted Load (+24h)</span>
                                                <strong style={{ fontSize: '1rem', color: predictedLoad24h > selectedMaxCapacity ? '#ef4444' : 'var(--text-primary)' }}>
                                                    {Math.round(predictedLoad24h)} / {selectedMaxCapacity} t
                                                </strong>
                                            </div>
                                            <div style={{ backgroundColor: 'var(--bg-primary)', padding: '10px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                                                <span style={{ display: 'block', fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 'bold', marginBottom: '2px' }}>Predicted Load (+48h)</span>
                                                <strong style={{ fontSize: '1rem', color: predictedLoad48h > selectedMaxCapacity ? '#ef4444' : 'var(--text-primary)' }}>
                                                    {Math.round(predictedLoad48h)} / {selectedMaxCapacity} t
                                                </strong>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            ) : (
                /* Map View (original design) */
                <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
                    {/* Top Stats Bar */}
                    <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Total Warehouses</h3>
                            <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{warehouses.length}</p>
                        </div>

                        <div style={{ flex: 1, backgroundColor: overflowing.length > 0 ? 'rgba(239, 68, 68, 0.1)' : 'var(--bg-card)', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: `1px solid ${overflowing.length > 0 ? '#ef4444' : 'var(--border-color)'}` }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: overflowing.length > 0 ? '#ef4444' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Overflowing Now</h3>
                            <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: overflowing.length > 0 ? '#ef4444' : 'var(--text-primary)' }}>{overflowing.length}</p>
                        </div>

                        <div style={{ flex: 1, backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ margin: '0 0 8px 0', fontSize: '14px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Auto-Reroutes Today</h3>
                            <p style={{ margin: 0, fontSize: '36px', fontWeight: 'bold', color: '#3b82f6' }}>{reroutesToday}</p>
                        </div>
                    </div>

                    {/* Left & Right split of original Map UI */}
                    <div style={{ display: 'flex', gap: '20px', flex: 1, minHeight: 0 }}>
                        {/* Left panel: warehouse search & list */}
                        <div style={{
                            width: '360px',
                            backgroundColor: 'var(--bg-card)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '16px',
                            display: 'flex',
                            flexDirection: 'column',
                            boxSizing: 'border-box'
                        }}>
                            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase' }}>Facilities List</h3>

                            {/* Filter controls */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={warehouseSearch}
                                    onChange={(e) => setWarehouseSearch(e.target.value)}
                                    style={{
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid var(--border-input)',
                                        backgroundColor: 'var(--bg-input)',
                                        color: 'var(--text-input)',
                                        fontSize: '0.85rem',
                                        outline: 'none'
                                    }}
                                />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <select
                                        value={warehouseFilter}
                                        onChange={(e) => setWarehouseFilter(e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '6px 8px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-input)',
                                            backgroundColor: 'var(--bg-input)',
                                            color: 'var(--text-input)',
                                            fontSize: '0.8rem',
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="all">All Levels</option>
                                        <option value="overflowing">Overflowing (&gt;85%)</option>
                                        <option value="normal">Normal (&lt;85%)</option>
                                    </select>
                                    <select
                                        value={warehouseSort}
                                        onChange={(e) => setWarehouseSort(e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '6px 8px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-input)',
                                            backgroundColor: 'var(--bg-input)',
                                            color: 'var(--text-input)',
                                            fontSize: '0.8rem',
                                            outline: 'none'
                                        }}
                                    >
                                        <option value="name">Sort by Name</option>
                                        <option value="fillPercent">Sort by Fill</option>
                                        <option value="max_capacity">Sort by Capacity</option>
                                    </select>
                                    <button
                                        onClick={() => setWarehouseSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                        style={{
                                            border: '1px solid var(--border-input)',
                                            backgroundColor: 'var(--bg-input)',
                                            color: 'var(--text-input)',
                                            borderRadius: '8px',
                                            padding: '6px 10px',
                                            cursor: 'pointer',
                                            fontSize: '0.8rem'
                                        }}
                                    >
                                        {warehouseSortOrder === 'asc' ? '▲' : '▼'}
                                    </button>
                                </div>
                            </div>

                            {/* Warehouse Scrollable List */}
                            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                {sortedWarehouses.length === 0 ? (
                                    <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', fontStyle: 'italic', textAlign: 'center', padding: '20px' }}>
                                        No warehouses match
                                    </div>
                                ) : (
                                    sortedWarehouses.map((w) => {
                                        const capacity = w.max_capacity || 1;
                                        const totalLoad = w.current_load + w.reserved_space;
                                        const fillPercent = Math.round((totalLoad / capacity) * 100);
                                        const isOverflowing = fillPercent > 85;
                                        let statusColor = '#22c55e'; // green
                                        if (isOverflowing) statusColor = '#ef4444'; // red
                                        else if (fillPercent >= 60) statusColor = '#f59e0b'; // orange

                                        return (
                                            <div
                                                key={w.id}
                                                onClick={() => handleZoomToWarehouse(w)}
                                                style={{
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    padding: '10px 12px',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '4px',
                                                    backgroundColor: 'var(--bg-primary)'
                                                }}
                                                onMouseEnter={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--accent)';
                                                    e.currentTarget.style.transform = 'translateY(-1px)';
                                                }}
                                                onMouseLeave={(e) => {
                                                    e.currentTarget.style.borderColor = 'var(--border-color)';
                                                    e.currentTarget.style.transform = 'translateY(0)';
                                                }}
                                            >
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                    <strong style={{ fontSize: '0.85rem' }}>{w.name}</strong>
                                                    <span style={{ fontSize: '0.75rem', fontWeight: 'bold', color: statusColor }}>{fillPercent}%</span>
                                                </div>
                                                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                                    Capacity: {totalLoad} / {w.max_capacity} tons
                                                </div>
                                                {isOverflowing && (
                                                    <span style={{ fontSize: '0.65rem', color: '#ef4444', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: '0.02em', display: 'inline-flex', gap: '2px', alignItems: 'center' }}>
                                                        <AlertTriangle size={12} /> Overflow Warning
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Right Panel: Map */}
                        <div style={{ flex: 1, minHeight: 0, borderRadius: '12px', overflow: 'hidden', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1)', border: '1px solid var(--border-color)' }}>
                            <WarehouseMap onOverrideReroute={(w) => setSelectedWarehouse(w)} loads={loads} mapCenter={mapCenter} mapZoom={mapZoom} />
                        </div>
                    </div>
                </div>
            )}

            {/* OVERRIDE REROUTE MODAL */}
            {selectedWarehouse && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    width: '100vw',
                    height: '100vh',
                    backgroundColor: 'rgba(15, 23, 42, 0.6)',
                    backdropFilter: 'blur(8px)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div style={{
                        backgroundColor: 'white',
                        borderRadius: '16px',
                        padding: '30px',
                        width: '90%',
                        maxWidth: '700px',
                        maxHeight: '85vh',
                        overflowY: 'auto',
                        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04)',
                        border: '1px solid #e2e8f0',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        color: '#1e293b',
                        fontFamily: "'Nunito', sans-serif"
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e2e8f0', paddingBottom: '16px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', color: '#ea580c', fontWeight: 'bold' }}>OVERRIDE REROUTE SYSTEM</h2>
                                <p style={{ margin: '4px 0 0 0', color: '#64748b', fontSize: '0.85rem' }}>Source: <strong style={{ color: '#0f172a' }}>{selectedWarehouse.name}</strong> ({Math.round(selectedWarehouse.fillPercent * 100)}% capacity)</p>
                            </div>
                            <button
                                onClick={() => setSelectedWarehouse(null)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: '#94a3b8'
                                }}
                            >
                                &times;
                            </button>
                        </div>

                        {/* Status Messages */}
                        {successMessage && (
                            <div style={{ padding: '12px 16px', backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', color: '#16a34a', fontWeight: '600', fontSize: '0.9rem' }}>
                                {successMessage}
                            </div>
                        )}
                        {errorMessage && (
                            <div style={{ padding: '12px 16px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#ef4444', fontWeight: '600', fontSize: '0.9rem' }}>
                                {errorMessage}
                            </div>
                        )}

                        {/* Step 1: Select order to reroute */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontWeight: '800', fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Select active order to reroute</label>
                            <select
                                value={selectedLoadId}
                                onChange={(e) => {
                                    setSelectedLoadId(e.target.value);
                                    setErrorMessage('');
                                }}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid #cbd5e1',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    backgroundColor: '#f8fafc'
                                }}
                            >
                                <option value="">-- Choose active load / truck heading to this warehouse --</option>
                                {loads.filter(l => l.status !== 'Delivered' && isLoadHeadedToWarehouse(l, selectedWarehouse)).map(l => (
                                    <option key={l.load_id} value={l.load_id}>
                                        {l.customer} ({l.pickup} ➔ {l.drop}) - Status: {l.status}
                                    </option>
                                ))}
                                {loads.filter(l => l.status !== 'Delivered' && isLoadHeadedToWarehouse(l, selectedWarehouse)).length === 0 && (
                                    <option value="" disabled>No active trucks heading to this warehouse</option>
                                )}
                            </select>
                        </div>

                        {/* Step 2: Search, Filter, Sort and Select target Warehouse */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <label style={{ fontWeight: '800', fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Choose Alternative Warehouse</label>

                            {/* Controls bar */}
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {/* Search */}
                                <input
                                    type="text"
                                    placeholder="Search warehouse..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    style={{
                                        flex: 2,
                                        minWidth: '150px',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        outline: 'none',
                                        fontSize: '0.9rem'
                                    }}
                                />

                                {/* Filter */}
                                <select
                                    value={filterBy}
                                    onChange={(e) => setFilterBy(e.target.value)}
                                    style={{
                                        flex: 1,
                                        minWidth: '100px',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        outline: 'none',
                                        fontSize: '0.9rem',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value="all">All Levels</option>
                                    <option value="under60">Under 60% Fill</option>
                                    <option value="active">Active Status</option>
                                </select>

                                {/* Sort */}
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    style={{
                                        flex: 1,
                                        minWidth: '100px',
                                        padding: '8px 12px',
                                        borderRadius: '8px',
                                        border: '1px solid #cbd5e1',
                                        outline: 'none',
                                        fontSize: '0.9rem',
                                        backgroundColor: 'white'
                                    }}
                                >
                                    <option value="name">Sort by Name</option>
                                    <option value="fillPercent">Sort by Fill level</option>
                                    <option value="max_capacity">Sort by Capacity</option>
                                </select>
                            </div>

                            {/* Warehouses list */}
                            <div style={{
                                display: 'flex',
                                flexDirection: 'column',
                                gap: '10px',
                                border: '1px solid #e2e8f0',
                                borderRadius: '10px',
                                padding: '10px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                backgroundColor: '#f8fafc'
                            }}>
                                {alternatives.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: '#64748b', fontSize: '0.9rem' }}>
                                        No alternative warehouses found matching the options.
                                    </div>
                                ) : (
                                    alternatives.map((wh) => {
                                        const currentFill = Math.round(wh.fillPercent * 100);
                                        const totalLoad = wh.current_load + wh.reserved_space;

                                        // Color coding fill level
                                        let fillClr = '#22c55e'; // green
                                        if (currentFill > 85) fillClr = '#ef4444'; // red
                                        else if (currentFill >= 60) fillClr = '#f59e0b'; // orange

                                        return (
                                            <div key={wh.id} style={{
                                                backgroundColor: 'white',
                                                padding: '12px 16px',
                                                borderRadius: '8px',
                                                border: '1px solid #e2e8f0',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
                                                gap: '15px'
                                            }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{wh.name}</strong>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: wh.status === 'active' || wh.status === undefined ? '#f0fdf4' : '#fef2f2', color: wh.status === 'active' || wh.status === undefined ? '#16a34a' : '#ef4444', fontWeight: 'bold' }}>
                                                            {wh.status || 'active'}
                                                        </span>
                                                    </div>

                                                    {/* Progress bar */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                                        <div style={{ flex: 1, height: '6px', backgroundColor: '#e2e8f0', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(currentFill, 100)}%`, height: '100%', backgroundColor: fillClr, borderRadius: '3px' }}></div>
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: fillClr, minWidth: '35px' }}>{currentFill}%</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                                                        Load: {totalLoad} / {wh.max_capacity} tons
                                                    </div>
                                                </div>

                                                {/* Action buttons */}
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        onClick={() => handleRejectWarehouse(wh.id)}
                                                        disabled={loadingReroute}
                                                        style={{
                                                            border: '1px solid #cbd5e1',
                                                            backgroundColor: 'white',
                                                            color: '#64748b',
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            fontWeight: '600'
                                                        }}
                                                    >
                                                        Reject
                                                    </button>
                                                    <button
                                                        onClick={() => handleAcceptReroute(wh)}
                                                        disabled={loadingReroute}
                                                        style={{
                                                            border: 'none',
                                                            backgroundColor: '#f97316',
                                                            color: 'white',
                                                            padding: '6px 12px',
                                                            borderRadius: '6px',
                                                            cursor: 'pointer',
                                                            fontSize: '0.8rem',
                                                            fontWeight: 'bold',
                                                            boxShadow: '0 2px 4px rgba(249,115,22,0.2)'
                                                        }}
                                                    >
                                                        Accept
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e2e8f0', paddingTop: '16px', marginTop: '10px' }}>
                            <button
                                onClick={() => setSelectedWarehouse(null)}
                                style={{
                                    border: '1px solid #cbd5e1',
                                    background: 'transparent',
                                    color: '#64748b',
                                    padding: '8px 16px',
                                    borderRadius: '8px',
                                    cursor: 'pointer',
                                    fontWeight: '600'
                                }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default WarehousePage;
