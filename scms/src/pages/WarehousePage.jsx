import React, { useEffect, useState } from 'react';
import { AlertTriangle, Building2, TrendingUp, Search, Download, ArrowUpDown, X } from 'lucide-react';
import supabase from '../config/SupabaseClient';
import useWarehouseMonitor from '../hooks/useWarehouseMonitor';
import WarehouseMap from '../components/WarehouseMap';
import axios from 'axios';
import { useTheme } from '../context/ThemeContext';

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const WarehousePage = () => {
    // 1. Hook into our global state monitor
    const { warehouses, overflowing } = useWarehouseMonitor();

    // Get current theme mode
    const { theme } = useTheme();

    // Local state for the reroute count
    const [reroutesToday, setReroutesToday] = useState(0);

    // Override Reroute Modal States
    const [selectedWarehouse, setSelectedWarehouse] = useState(null);

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

        const hasIncoming = loads.some(l => 
            l.status !== 'Delivered' && isLoadHeadedToWarehouse(l, w)
        );

        const matchesFilter = warehouseFilter === 'all' ||
            (warehouseFilter === 'overflowing' && isOverflowing) ||
            (warehouseFilter === 'normal' && !isOverflowing) ||
            (warehouseFilter === 'incoming' && hasIncoming);

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
        <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 40px)', padding: '20px', boxSizing: 'border-box', position: 'relative', color: 'var(--text-primary)', backgroundColor: 'var(--bg-primary)', transition: 'background-color 0.3s ease, color 0.3s ease' }}>
            
            {/* Header Area */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                    <h1 style={{ margin: '0', fontSize: '28px', color: 'var(--accent)', fontWeight: '800', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        Warehouse Control Center
                    </h1>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem', fontWeight: '600' }}>
                        Real-time Warehouse Capacity & Network Monitoring
                    </p>
                </div>
                <button 
                    onClick={() => {
                        alert("Exporting PDF capacity and network analytics report...");
                    }}
                    style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        padding: '10px 20px',
                        backgroundColor: 'var(--accent)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontWeight: 'bold',
                        fontSize: '0.85rem',
                        transition: 'all 0.2s',
                        boxShadow: 'var(--shadow-md)'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.filter = 'brightness(1.1)'}
                    onMouseLeave={(e) => e.currentTarget.style.filter = 'none'}
                >
                    <Download size={16} /> Export Report
                </button>
            </div>

            {/* Top Stats Bar */}
            <div style={{ display: 'flex', gap: '20px', marginBottom: '24px' }}>
                {/* Total Warehouses KPI */}
                <div style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-card)',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--border-color)',
                    borderTop: '4px solid #ea580c',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Total Warehouses</h3>
                        <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: 'var(--text-primary)' }}>{warehouses.length}</p>
                        <span style={{ fontSize: '11px', color: '#10b981', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '4px' }}>
                            +4% vs last month
                        </span>
                    </div>
                    <div style={{
                        backgroundColor: 'rgba(234, 88, 12, 0.1)',
                        padding: '12px',
                        borderRadius: '12px',
                        color: '#ea580c',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <Building2 size={24} />
                    </div>
                </div>

                {/* Overflow Warnings KPI */}
                <div style={{
                    flex: 1,
                    backgroundColor: overflowing.length > 0 ? 'rgba(239, 68, 68, 0.08)' : 'var(--bg-card)',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-md)',
                    border: overflowing.length > 0 ? '1px solid #ef4444' : '1px solid var(--border-color)',
                    borderTop: '4px solid #ef4444',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: overflowing.length > 0 ? '#ef4444' : 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Overflowing Now</h3>
                        <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: overflowing.length > 0 ? '#ef4444' : 'var(--text-primary)' }}>{overflowing.length}</p>
                        <span style={{ fontSize: '11px', color: overflowing.length > 0 ? '#ef4444' : 'var(--text-secondary)', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '4px' }}>
                            +12% fill warning
                        </span>
                    </div>
                    <div style={{
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        padding: '12px',
                        borderRadius: '12px',
                        color: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <AlertTriangle size={24} />
                    </div>
                </div>

                {/* Auto-Reroutes Today KPI */}
                <div style={{
                    flex: 1,
                    backgroundColor: 'var(--bg-card)',
                    padding: '24px',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-md)',
                    border: '1px solid var(--border-color)',
                    borderTop: '4px solid #3b82f6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'relative',
                    overflow: 'hidden'
                }}>
                    <div>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '13px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>Auto-Reroutes Today</h3>
                        <p style={{ margin: 0, fontSize: '32px', fontWeight: '800', color: '#3b82f6' }}>{reroutesToday}</p>
                        <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '2px', marginTop: '4px' }}>
                            +8% automated action
                        </span>
                    </div>
                    <div style={{
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        padding: '12px',
                        borderRadius: '12px',
                        color: '#3b82f6',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                    }}>
                        <TrendingUp size={24} />
                    </div>
                </div>
            </div>

            {/* Main Section: Map + Sidebar list */}
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
                    <h3 style={{ margin: '0 0 16px 0', fontSize: '1.1rem', color: 'var(--accent)', fontWeight: 'bold', textTransform: 'uppercase' }}>Facility Analytics</h3>

                    {/* Filter controls */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '14px' }}>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                            <Search size={16} style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)' }} />
                            <input
                                type="text"
                                placeholder="Search facility..."
                                value={warehouseSearch}
                                onChange={(e) => setWarehouseSearch(e.target.value)}
                                style={{
                                    width: '100%',
                                    padding: '8px 12px 8px 32px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-input)',
                                    backgroundColor: 'var(--bg-input)',
                                    color: 'var(--text-input)',
                                    fontSize: '0.85rem',
                                    outline: 'none',
                                    boxSizing: 'border-box'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <select
                                value={warehouseFilter}
                                onChange={(e) => setWarehouseFilter(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-input)',
                                    backgroundColor: 'var(--bg-input)',
                                    color: 'var(--text-input)',
                                    fontSize: '0.8rem',
                                    outline: 'none',
                                    cursor: 'pointer'
                                }}
                            >
                                <option value="all">All Levels</option>
                                <option value="overflowing">Overflowing (&gt;85%)</option>
                                <option value="normal">Normal (&lt;85%)</option>
                                <option value="incoming">Incoming Trucks</option>
                            </select>
                            <select
                                value={warehouseSort}
                                onChange={(e) => setWarehouseSort(e.target.value)}
                                style={{
                                    flex: 1,
                                    padding: '8px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-input)',
                                    backgroundColor: 'var(--bg-input)',
                                    color: 'var(--text-input)',
                                    fontSize: '0.8rem',
                                    outline: 'none',
                                    cursor: 'pointer'
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
                                    padding: '8px 10px',
                                    cursor: 'pointer',
                                    fontSize: '0.8rem',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <ArrowUpDown size={14} />
                            </button>
                        </div>
                    </div>

                    {/* Warehouse Scrollable List */}
                    <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '10px' }}>
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
                                
                                let borderLeftColor = '#22c55e'; // green
                                let badgeText = 'NORMAL';
                                let badgeColor = '#22c55e';
                                let badgeBg = 'rgba(34, 197, 94, 0.1)';

                                if (isOverflowing) {
                                    borderLeftColor = '#ef4444'; // red
                                    badgeText = 'CRITICAL';
                                    badgeColor = '#ef4444';
                                    badgeBg = 'rgba(239, 68, 68, 0.1)';
                                } else if (fillPercent >= 60) {
                                    borderLeftColor = '#f59e0b'; // orange
                                    badgeText = 'WARNING';
                                    badgeColor = '#f59e0b';
                                    badgeBg = 'rgba(245, 158, 11, 0.1)';
                                }

                                return (
                                    <div
                                        key={w.id}
                                        onClick={() => handleZoomToWarehouse(w)}
                                        style={{
                                            border: '1px solid var(--border-color)',
                                            borderLeft: `4px solid ${borderLeftColor}`,
                                            borderRadius: '8px',
                                            padding: '12px',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '8px',
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
                                            <strong style={{ fontSize: '0.875rem', color: 'var(--text-primary)' }}>{w.name}</strong>
                                            <span style={{
                                                fontSize: '0.7rem',
                                                fontWeight: '800',
                                                color: badgeColor,
                                                backgroundColor: badgeBg,
                                                padding: '2px 8px',
                                                borderRadius: '4px',
                                                textTransform: 'uppercase'
                                            }}>
                                                {badgeText}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <span>Capacity: {totalLoad} / {w.max_capacity} tons</span>
                                            <span style={{ fontWeight: 'bold', color: borderLeftColor }}>{fillPercent}%</span>
                                        </div>
                                        
                                        {/* Progress Bar */}
                                        <div style={{ width: '100%', height: '6px', backgroundColor: 'var(--border-input)', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{ width: `${Math.min(fillPercent, 100)}%`, height: '100%', backgroundColor: borderLeftColor, borderRadius: '3px' }}></div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

                {/* Right Panel: Map */}
                <div style={{ flex: 1, minHeight: 0, borderRadius: '12px', overflow: 'hidden', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border-color)', position: 'relative' }}>
                    <WarehouseMap onOverrideReroute={(w) => setSelectedWarehouse(w)} loads={loads} mapCenter={mapCenter} mapZoom={mapZoom} />
                </div>
            </div>

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
                        backgroundColor: 'var(--bg-primary)',
                        borderRadius: '16px',
                        padding: '30px',
                        width: '90%',
                        maxWidth: '700px',
                        maxHeight: '85vh',
                        overflowY: 'auto',
                        boxShadow: 'var(--shadow-lg)',
                        border: '1px solid var(--border-color)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '20px',
                        color: 'var(--text-primary)',
                        fontFamily: "'Nunito', sans-serif"
                    }}>
                        {/* Modal Header */}
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px' }}>
                            <div>
                                <h2 style={{ margin: 0, fontSize: '1.4rem', color: 'var(--accent)', fontWeight: '800', textTransform: 'uppercase' }}>OVERRIDE REROUTE SYSTEM</h2>
                                <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Source: <strong style={{ color: 'var(--text-primary)' }}>{selectedWarehouse.name}</strong> ({Math.round(selectedWarehouse.fillPercent * 100)}% capacity)</p>
                            </div>
                            <button
                                onClick={() => setSelectedWarehouse(null)}
                                style={{
                                    border: 'none',
                                    background: 'transparent',
                                    fontSize: '1.5rem',
                                    cursor: 'pointer',
                                    color: 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        {/* Status Messages */}
                        {successMessage && (
                            <div style={{ padding: '12px 16px', backgroundColor: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10b981', borderRadius: '8px', color: '#10b981', fontWeight: '600', fontSize: '0.9rem' }}>
                                {successMessage}
                            </div>
                        )}
                        {errorMessage && (
                            <div style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.15)', border: '1px solid #ef4444', borderRadius: '8px', color: '#ef4444', fontWeight: '600', fontSize: '0.9rem' }}>
                                {errorMessage}
                            </div>
                        )}

                        {/* Step 1: Select order to reroute */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            <label style={{ fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1. Select active order to reroute</label>
                            <select
                                value={selectedLoadId}
                                onChange={(e) => {
                                    setSelectedLoadId(e.target.value);
                                    setErrorMessage('');
                                }}
                                style={{
                                    padding: '10px 14px',
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-input)',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    backgroundColor: 'var(--bg-input)',
                                    color: 'var(--text-input)',
                                    cursor: 'pointer'
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
                            <label style={{ fontWeight: '800', fontSize: '0.8rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>2. Choose Alternative Warehouse</label>

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
                                        border: '1px solid var(--border-input)',
                                        backgroundColor: 'var(--bg-input)',
                                        color: 'var(--text-input)',
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
                                        border: '1px solid var(--border-input)',
                                        backgroundColor: 'var(--bg-input)',
                                        color: 'var(--text-input)',
                                        outline: 'none',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer'
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
                                        border: '1px solid var(--border-input)',
                                        backgroundColor: 'var(--bg-input)',
                                        color: 'var(--text-input)',
                                        outline: 'none',
                                        fontSize: '0.9rem',
                                        cursor: 'pointer'
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
                                border: '1px solid var(--border-color)',
                                borderRadius: '10px',
                                padding: '10px',
                                maxHeight: '300px',
                                overflowY: 'auto',
                                backgroundColor: 'var(--bg-card)'
                            }}>
                                {alternatives.length === 0 ? (
                                    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
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
                                                backgroundColor: 'var(--bg-primary)',
                                                padding: '12px 16px',
                                                borderRadius: '8px',
                                                border: '1px solid var(--border-color)',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                boxShadow: 'var(--shadow-sm)',
                                                gap: '15px'
                                            }}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{wh.name}</strong>
                                                        <span style={{ fontSize: '0.7rem', padding: '2px 6px', borderRadius: '4px', backgroundColor: wh.status === 'active' || wh.status === undefined ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)', color: wh.status === 'active' || wh.status === undefined ? '#22c55e' : '#ef4444', fontWeight: 'bold' }}>
                                                            {wh.status || 'active'}
                                                        </span>
                                                    </div>

                                                    {/* Progress bar */}
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                                        <div style={{ flex: 1, height: '6px', backgroundColor: 'var(--border-input)', borderRadius: '3px', overflow: 'hidden' }}>
                                                            <div style={{ width: `${Math.min(currentFill, 100)}%`, height: '100%', backgroundColor: fillClr, borderRadius: '3px' }}></div>
                                                        </div>
                                                        <span style={{ fontSize: '0.8rem', fontWeight: 'bold', color: fillClr, minWidth: '35px' }}>{currentFill}%</span>
                                                    </div>
                                                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                        Load: {totalLoad} / {wh.max_capacity} tons
                                                    </div>
                                                </div>

                                                {/* Action buttons */}
                                                <div style={{ display: 'flex', gap: '6px' }}>
                                                    <button
                                                        onClick={() => handleRejectWarehouse(wh.id)}
                                                        disabled={loadingReroute}
                                                        style={{
                                                            border: '1px solid var(--border-input)',
                                                            backgroundColor: 'var(--bg-input)',
                                                            color: 'var(--text-input)',
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
                                                            backgroundColor: 'var(--accent)',
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
                        <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
                            <button
                                onClick={() => setSelectedWarehouse(null)}
                                style={{
                                    border: '1px solid var(--border-input)',
                                    background: 'transparent',
                                    color: 'var(--text-secondary)',
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
