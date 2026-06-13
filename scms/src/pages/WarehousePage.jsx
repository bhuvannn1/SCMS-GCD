import React, { useEffect, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import supabase from '../config/SupabaseClient';
import useWarehouseMonitor from '../hooks/useWarehouseMonitor';
import WarehouseMap from '../components/WarehouseMap';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const WarehousePage = () => {
    // 1. Hook into our global state monitor
    const { warehouses, overflowing } = useWarehouseMonitor();

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
            <h1 style={{ margin: '0 0 24px 0', fontSize: '28px', color: 'var(--accent)', fontWeight: '800', textTransform: 'uppercase' }}>Warehouse Control Center</h1>

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
