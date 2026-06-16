import { useEffect, useState, useRef } from "react"
import { User, Phone, MapPin, Tag, CheckCircle, XCircle, Route, TrendingUp, Leaf, Loader2, Compass, AlertTriangle, ShieldAlert, Search, ArrowUpDown, Filter } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import L from "leaflet"
import supabase from "../config/SupabaseClient"
import { getFriendlyError } from "../components/EmptyState";

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000'

// Create a colored truck icon based on active/inactive status and selection
const createTruckIcon = (isActive, isSelected) => new L.divIcon({
    className: 'custom-truck-marker',
    html: `
        <div style="
            background-color: #fff;
            border: 2px solid ${isSelected ? '#f97316' : (isActive ? '#22c55e' : '#ef4444')};
            border-radius: 50%;
            width: ${isSelected ? '48px' : '42px'};
            height: ${isSelected ? '48px' : '42px'};
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 14px ${isSelected ? 'rgba(249,115,22,0.4)' : 'rgba(0,0,0,0.22)'};
            transform: scale(${isSelected ? '1.15' : '1'});
            transition: transform 0.2s;
        ">
            <svg xmlns="http://www.w3.org/2000/svg" width="${isSelected ? '26' : '22'}" height="${isSelected ? '26' : '22'}" viewBox="0 0 24 24" fill="none" stroke="${isSelected ? '#f97316' : (isActive ? '#22c55e' : '#ef4444')}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="3" width="15" height="13"></rect>
                <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                <circle cx="5.5" cy="18.5" r="2.5"></circle>
                <circle cx="18.5" cy="18.5" r="2.5"></circle>
            </svg>
        </div>
    `,
    iconSize: isSelected ? [48, 48] : [42, 42],
    iconAnchor: isSelected ? [24, 24] : [21, 21],
    popupAnchor: [0, isSelected ? -24 : -22]
});

// Custom markers for route start and end
const createPinIcon = (color) => new L.divIcon({
    className: `custom-pin-marker-${color}`,
    html: `
        <div style="
            background-color: #fff;
            border: 2px solid ${color};
            border-radius: 50% 50% 50% 0;
            width: 28px;
            height: 28px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.15);
            transform: rotate(-45deg);
        ">
            <div style="
                width: 12px;
                height: 12px;
                background-color: ${color};
                border-radius: 50%;
                transform: rotate(45deg);
            "></div>
        </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28]
});

const pickupIcon = createPinIcon('#22c55e'); // Green
const dropIcon = createPinIcon('#ef4444'); // Red

// Breach marker icon (pulsing red alert)
const createBreachIcon = () => new L.divIcon({
    className: 'custom-breach-marker',
    html: `
        <div style="
            background-color: #fef2f2;
            border: 2.5px solid #ef4444;
            border-radius: 50%;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7);
            animation: pulse-breach 1.5s infinite;
        ">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"></path>
                <path d="M12 9v4"></path>
                <path d="M12 17h.01"></path>
            </svg>
        </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 18],
    popupAnchor: [0, -18]
});

// Component to dynamically fit route bounds
const MapBoundsAdjuster = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords && coords.length > 0) {
            const bounds = L.latLngBounds(coords);
            map.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [coords, map]);
    return null;
};

const MapView = () => {
    const [fleet, setFleet] = useState([])
    const [activeLoads, setActiveLoads] = useState([])
    const [selectedLoad, setSelectedLoad] = useState(null)
    const [breachAlerts, setBreachAlerts] = useState([])

    // Search, Sort, Filter States
    const [searchQuery, setSearchQuery] = useState('')
    const [sortBy, setSortBy] = useState('customer') // 'customer' | 'load_id' | 'pickup' | 'drop'
    const [sortOrder, setSortOrder] = useState('asc') // 'asc' | 'desc'
    const [driverFilter, setDriverFilter] = useState('all') // 'all' | 'assigned' | 'unassigned'

    const filteredActiveLoads = activeLoads.filter(load => {
        const q = searchQuery.toLowerCase();
        const matchesSearch = 
            (load.customer && load.customer.toLowerCase().includes(q)) ||
            (load.load_id && load.load_id.toLowerCase().includes(q)) ||
            (load.pickup && load.pickup.toLowerCase().includes(q)) ||
            (load.drop && load.drop.toLowerCase().includes(q)) ||
            (load.driver?.full_name && load.driver.full_name.toLowerCase().includes(q)) ||
            (load.fleet?.vehicle_number && load.fleet.vehicle_number.toLowerCase().includes(q));
            
        const matchesDriver = driverFilter === 'all' ||
            (driverFilter === 'assigned' && load.driver?.full_name && load.driver.full_name !== 'None') ||
            (driverFilter === 'unassigned' && (!load.driver?.full_name || load.driver.full_name === 'None' || load.driver.full_name === ''));
            
        return matchesSearch && matchesDriver;
    });

    const sortedActiveLoads = [...filteredActiveLoads].sort((a, b) => {
        let valA = a[sortBy] || '';
        let valB = b[sortBy] || '';
        
        if (sortBy === 'customer') {
            valA = a.customer || '';
            valB = b.customer || '';
        } else if (sortBy === 'load_id') {
            valA = a.load_id || '';
            valB = b.load_id || '';
        } else if (sortBy === 'pickup') {
            valA = a.pickup || '';
            valB = b.pickup || '';
        } else if (sortBy === 'drop') {
            valA = a.drop || '';
            valB = b.drop || '';
        }

        if (typeof valA === 'string') {
            return sortOrder === 'asc' 
                ? valA.localeCompare(valB) 
                : valB.localeCompare(valA);
        } else {
            return sortOrder === 'asc' ? (valA > valB ? 1 : -1) : (valB > valA ? 1 : -1);
        }
    });
    
    const [routeData, setRouteData] = useState(null)
    const [routeLoading, setRouteLoading] = useState(false)
    const [routeError, setRouteError] = useState(null)

    // Simulation states
    const [simulating, setSimulating] = useState(false);
    const [simIndex, setSimIndex] = useState(0);
    const [simCoords, setSimCoords] = useState([]);
    const simIntervalRef = useRef(null);

    // Downsampling helper
    const getDownsampledCoords = (coords, maxSteps = 25) => {
        if (coords.length <= maxSteps) return coords;
        const step = Math.max(1, Math.floor(coords.length / maxSteps));
        const sampled = [];
        for (let i = 0; i < coords.length; i += step) {
            sampled.push(coords[i]);
        }
        const last = coords[coords.length - 1];
        if (sampled[sampled.length - 1] !== last) {
            sampled.push(last);
        }
        return sampled;
    };

    const fetchFleetLocations = async () => {
        const { data, error } = await supabase
            .from("Fleet")
            .select(`
                *,
                profiles:driver_id (
                    full_name,
                    phone
                )
            `)

        if (error) {
            console.log("Error fetching Fleet data:", error)
            return
        }

        // Convert location string → lat/lng
        const formatted = data.map((item) => {
            const locString = item.location;

            if (!locString || typeof locString !== 'string') return null;

            let lat = NaN;
            let lng = NaN;

            // Robust coordinate parsing
            let cleaned = locString.trim();
            cleaned = cleaned.replace(/,\s+/, ' ');
            
            const spaceParts = cleaned.split(/\s+/);
            if (spaceParts.length === 2) {
                const latStr = spaceParts[0].replace(',', '.').replace(/[^0-9.-]/g, '');
                const lngStr = spaceParts[1].replace(',', '.').replace(/[^0-9.-]/g, '');
                lat = parseFloat(latStr);
                lng = parseFloat(lngStr);
            } else {
                const commaParts = cleaned.split(',');
                if (commaParts.length === 2) {
                    lat = parseFloat(commaParts[0].trim());
                    lng = parseFloat(commaParts[1].trim());
                } else {
                    const commaCount = (cleaned.match(/,/g) || []).length;
                    if (commaCount === 3) {
                        const indexes = [];
                        for (let i = 0; i < cleaned.length; i++) {
                            if (cleaned[i] === ',') indexes.push(i);
                        }
                        const latStr = (cleaned.substring(0, indexes[0]) + '.' + cleaned.substring(indexes[0] + 1, indexes[1])).replace(/\s+/g, '');
                        const lngStr = (cleaned.substring(indexes[1] + 1, indexes[2]) + '.' + cleaned.substring(indexes[2] + 1)).replace(/\s+/g, '');
                        lat = parseFloat(latStr);
                        lng = parseFloat(lngStr);
                    }
                }
            }

            if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
                return null;
            }

            return {
                ...item,
                lat,
                lng,
                displayLoc: locString
            }
        }).filter(Boolean)

        setFleet(formatted)
    }

    const fetchActiveLoads = async () => {
        const { data, error } = await supabase
            .from("Load")
            .select(`
                *,
                fleet:Fleet!fleet_id (
                    vehicle_number,
                    location,
                    status
                ),
                driver:profiles!driver_id (
                    full_name,
                    phone
                )
            `)
            .eq("status", "Running");
            
        if (error) {
            console.error("Error fetching active loads:", error);
            return;
        }
        setActiveLoads(data || []);

        // Auto-select load from URL query param
        const queryParams = new URLSearchParams(window.location.search);
        const loadIdFromUrl = queryParams.get('loadId');
        if (loadIdFromUrl && data) {
            const matchingLoad = data.find(l => l.load_id === loadIdFromUrl);
            if (matchingLoad) {
                // Call handleSelectLoad to load routing data and zoom
                handleSelectLoad(matchingLoad);
            }
        }
    }

    const fetchBreachAlerts = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user) return;
        try {
            const res = await fetch(`${API_BASE}/api/seller/breach-alerts?seller_id=${session.user.id}`);
            const data = await res.json();
            setBreachAlerts((data.alerts || []).filter(a => !a.acknowledged_by_seller));
        } catch (e) {
            console.warn('Map breach alerts fetch failed:', e.message);
        }
    }

    useEffect(() => {
        fetchFleetLocations()
        fetchActiveLoads()
        fetchBreachAlerts()
        
        // Supabase Realtime WebSocket channel subscription
        const channel = supabase
            .channel('map-realtime-changes')
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Fleet'
                },
                (payload) => {
                    console.log('Realtime update for Fleet:', payload);
                    fetchFleetLocations();
                }
            )
            .on(
                'postgres_changes',
                {
                    event: '*',
                    schema: 'public',
                    table: 'Load'
                },
                (payload) => {
                    console.log('Realtime update for Load:', payload);
                    fetchActiveLoads();
                }
            )
            .subscribe();
        
        // Fallback polling refresh every 30s
        const interval = setInterval(() => {
            fetchFleetLocations()
            fetchActiveLoads()
            fetchBreachAlerts()
        }, 30000)
        
        return () => {
            clearInterval(interval);
            supabase.removeChannel(channel);
            if (simIntervalRef.current) {
                clearInterval(simIntervalRef.current);
            }
        }
    }, [])

    // Stop simulation when selectedLoad is changed or cleared
    useEffect(() => {
        if (simIntervalRef.current) {
            clearInterval(simIntervalRef.current);
            simIntervalRef.current = null;
        }
        setSimulating(false);
        setSimIndex(0);
        setSimCoords([]);
    }, [selectedLoad]);

    const handleStartSimulation = () => {
        if (!routeData || !selectedLoad || !selectedLoad.fleet_id) return;
        
        const rawCoords = routeData.optimized.geometry.coordinates; // [lng, lat]
        const sampled = getDownsampledCoords(rawCoords, 25);
        
        setSimCoords(sampled);
        setSimIndex(0);
        setSimulating(true);
        
        let index = 0;
        
        simIntervalRef.current = setInterval(async () => {
            if (index >= sampled.length) {
                // Simulation complete!
                clearInterval(simIntervalRef.current);
                simIntervalRef.current = null;
                setSimulating(false);
                
                // Automatically complete load in Supabase
                await supabase
                    .from("Load")
                    .update({ status: "Delivered", eta: "Delivered" })
                    .eq("load_id", selectedLoad.load_id);
                    
                alert(`Simulation Completed! Shipment ${selectedLoad.load_id} has been marked as Delivered.`);
                return;
            }
            
            const [lng, lat] = sampled[index];
            
            // Update database row for this fleet vehicle
            await supabase
                .from("Fleet")
                .update({ location: `${lat.toFixed(5)}, ${lng.toFixed(5)}` })
                .eq("id", selectedLoad.fleet_id);
                
            setSimIndex(index);
            index++;
        }, 3000);
    };
    
    const handleStopSimulation = () => {
        if (simIntervalRef.current) {
            clearInterval(simIntervalRef.current);
            simIntervalRef.current = null;
        }
        setSimulating(false);
    };

    const handleSelectLoad = async (load) => {
        if (selectedLoad?.load_id === load.load_id) {
            setSelectedLoad(null);
            setRouteData(null);
            setRouteError(null);
            return;
        }

        setSelectedLoad(load);
        setRouteLoading(true);
        setRouteError(null);
        setRouteData(null);

        try {
            const res = await fetch(`${API_BASE}/api/route/optimize?pickup=${encodeURIComponent(load.pickup)}&drop=${encodeURIComponent(load.drop)}`);
            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Failed to calculate optimal route");
            }
            setRouteData(data);
        } catch (err) {
            setRouteError(err.message);
        } finally {
            setRouteLoading(false);
        }
    }

    return (
        <div className="page map-view" style={{ maxWidth: '1400px', margin: '0 auto', padding: '20px', animation: 'fadeIn 0.5s ease-out' }}>
            <div className="map-title" style={{ marginBottom: '24px' }}>
                <h2 style={{ fontSize: '2rem', color: '#f97316', margin: '0', fontWeight: '800', letterSpacing: '-0.02em', textTransform: 'uppercase' }}>
                    Live Fleet Tracking & Route Optimization
                </h2>
                <p style={{ color: '#64748b', margin: '8px 0 0', fontSize: '1rem' }}>
                    Track live vehicle locations and analyze smart, fuel-efficient routing configurations.
                </p>
            </div>

            <div style={{
                display: 'grid',
                gridTemplateColumns: '360px 1fr',
                gap: '24px',
                height: '75vh',
                width: '100%'
            }} className="mapview-grid-layout">
                
                {/* Sidebar */}
                <div style={{
                    background: 'var(--bg-card, #fff)',
                    border: '1px solid var(--border-color, #e2e8f0)',
                    borderRadius: '20px',
                    padding: '20px',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    maxHeight: '100%',
                    overflowY: 'auto'
                }}>
                    <h3 style={{ margin: 0, fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <Route size={20} style={{ color: '#f97316' }} />
                        <span>Active Shipments</span>
                        <span style={{ 
                            background: '#fee2e2', 
                            color: '#ef4444', 
                            fontSize: '0.72rem', 
                            fontWeight: 800,
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            marginLeft: 'auto' 
                        }}>
                            {activeLoads.length} Running
                        </span>
                    </h3>

                    {breachAlerts.length > 0 && !selectedLoad && (
                        <div style={{
                            padding: '12px', background: 'rgba(239,68,68,0.06)', 
                            border: '1px solid rgba(239,68,68,0.2)', borderRadius: '12px',
                            display: 'flex', flexDirection: 'column', gap: '8px',
                            animation: 'pulse-bg 2s infinite'
                        }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#ef4444', display: 'flex', alignItems: 'center', gap: '6px', textTransform: 'uppercase' }}>
                                <ShieldAlert size={14} /> Critical Alerts ({breachAlerts.length})
                            </div>
                            {breachAlerts.map(alert => (
                                <div key={alert.id} style={{ fontSize: '0.75rem', color: '#7f1d1d', background: 'white', padding: '8px', borderRadius: '8px', border: '1px solid #fca5a5' }}>
                                    <strong>{alert.driver?.full_name || 'Driver'}</strong> exceeded 8h limit.
                                    <br />
                                    Drove for {Math.floor(alert.drive_minutes_at_breach/60)}h {alert.drive_minutes_at_breach%60}m.
                                    <div style={{ marginTop: '6px' }}>
                                        <button 
                                            onClick={async () => {
                                                await fetch(`${API_BASE}/api/seller/acknowledge-breach`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ breach_id: alert.id })
                                                });
                                                setBreachAlerts(prev => prev.filter(a => a.id !== alert.id));
                                            }}
                                            style={{ background: '#ef4444', color: 'white', border: 'none', padding: '4px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 'bold', cursor: 'pointer' }}>
                                            Dismiss Alert
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {selectedLoad ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {/* Selected Dispatch Panel */}
                            <div style={{ padding: '14px', background: 'var(--bg-primary, #f8fafc)', borderRadius: '14px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                                <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Selected Shipment</div>
                                <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginTop: '4px' }}>{selectedLoad.customer}</div>
                                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '2px', fontFamily: 'monospace' }}>ID: {selectedLoad.load_id}</div>
                                
                                <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <span style={{ color: '#22c55e', fontSize: '1.1rem', lineHeight: 1 }}>●</span>
                                        <div><strong>Pickup:</strong> {selectedLoad.pickup}</div>
                                    </div>
                                    <div style={{ fontSize: '0.82rem', color: '#475569', display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                        <span style={{ color: '#ef4444', fontSize: '1.1rem', lineHeight: 1 }}>●</span>
                                        <div><strong>Drop:</strong> {selectedLoad.drop}</div>
                                    </div>
                                </div>
                            </div>

                            {routeLoading && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', padding: '30px 10px', textAlign: 'center' }}>
                                    <Loader2 className="animate-spin" size={24} style={{ color: '#f97316' }} />
                                    <span style={{ fontSize: '0.85rem', color: '#64748b' }}>Plotting optimized route...</span>
                                </div>
                            )}

                            {routeError && (
                                <div style={{ padding: '12px', background: '#fee2e2', color: '#ef4444', borderRadius: '12px', fontSize: '0.82rem', fontWeight: 600 }}>
                                    ⚠ {getFriendlyError(routeError)}
                                </div>
                            )}

                            {routeData && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', animation: 'fadeIn 0.3s ease-out' }}>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                                        <div style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span style={{ fontSize: '0.62rem', color: '#16a34a', fontWeight: 'bold', textTransform: 'uppercase' }}>Optimized Dist</span>
                                            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#14532d' }}>{routeData.optimized.distance_km.toFixed(1)} km</span>
                                        </div>
                                        <div style={{ background: 'rgba(34, 197, 94, 0.06)', border: '1px solid #bbf7d0', padding: '10px', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                            <span style={{ fontSize: '0.62rem', color: '#16a34a', fontWeight: 'bold', textTransform: 'uppercase' }}>Optimized ETA</span>
                                            <span style={{ fontSize: '1.05rem', fontWeight: 900, color: '#14532d' }}>{(routeData.optimized.duration_sec / 3600).toFixed(1)} hrs</span>
                                        </div>
                                    </div>

                                    {/* Cost stats */}
                                    <div style={{ padding: '12px 14px', borderRadius: '12px', background: 'rgba(236, 72, 153, 0.04)', border: '1px solid #fbcfe8', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: '#db2777' }}>
                                            <TrendingUp size={14} /> Trip Cost & Emissions
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <div>
                                                <div style={{ fontSize: '0.62rem', color: '#9d174d' }}>Fuel Consumption</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#831843' }}>{routeData.optimized.fuel_liters.toFixed(1)} Liters</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '0.62rem', color: '#9d174d' }}>Carbon Footprint</div>
                                                <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#831843' }}>{routeData.optimized.co2_kg.toFixed(1)} kg CO2</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Savings card */}
                                    <div style={{
                                        padding: '14px',
                                        background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                                        color: '#fff',
                                        borderRadius: '14px',
                                        boxShadow: '0 8px 20px rgba(16,185,129,0.2)',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '6px'
                                    }}>
                                        <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <Leaf size={14} /> Eco-Routing Savings
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: '4px' }}>
                                            <div>
                                                <span style={{ fontSize: '0.62rem', opacity: 0.9 }}>FUEL COST SAVED</span>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>₹{Math.round(routeData.savings.fuel_cost).toLocaleString('en-IN')}</div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <span style={{ fontSize: '0.62rem', opacity: 0.9 }}>CO2 PREVENTED</span>
                                                <div style={{ fontSize: '1.2rem', fontWeight: 900 }}>{routeData.savings.co2_kg.toFixed(1)} kg</div>
                                            </div>
                                        </div>
                                        <div style={{ fontSize: '0.62rem', opacity: 0.85, borderTop: '1px solid rgba(255,255,255,0.2)', paddingTop: '4px', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                            <Compass size={10} /> Route selection is actively optimized
                                        </div>
                                    </div>

                                    {/* GPS Transit Simulation Panel */}
                                    <div style={{
                                        padding: '14px',
                                        background: simulating ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-primary, #f8fafc)',
                                        border: `1.5px solid ${simulating ? '#3b82f6' : 'var(--border-color, #e2e8f0)'}`,
                                        borderRadius: '14px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        marginTop: '4px'
                                    }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span style={{ fontSize: '0.78rem', fontWeight: 800, color: simulating ? '#2563eb' : 'var(--text-primary, #0f172a)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ 
                                                    width: '8px', 
                                                    height: '8px', 
                                                    borderRadius: '50%', 
                                                    background: simulating ? '#22c55e' : '#64748b', 
                                                    display: 'inline-block',
                                                    animation: simulating ? 'pulse 1.5s infinite' : 'none'
                                                }}></span>
                                                {simulating ? 'GPS Simulator Active' : 'GPS Simulation'}
                                            </span>
                                            {simulating && (
                                                <span style={{ fontSize: '0.7rem', color: '#3b82f6', fontWeight: 700 }}>
                                                    Step {simIndex + 1}/{simCoords.length}
                                                </span>
                                            )}
                                        </div>
                                        
                                        <p style={{ margin: 0, fontSize: '0.72rem', color: '#64748b', lineHeight: 1.3 }}>
                                            {simulating 
                                                ? 'Updating database GPS coordinates in real-time. Watch the truck marker move on all dashboards!' 
                                                : 'Simulate the truck moving along the optimized route in real-time to test fleet tracking.'}
                                        </p>
                                        
                                        {!simulating ? (
                                            <button
                                                type="button"
                                                onClick={handleStartSimulation}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    background: '#3b82f6',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 4px 10px rgba(59,130,246,0.2)',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                Start GPS Simulation
                                            </button>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={handleStopSimulation}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px',
                                                    background: '#dc2626',
                                                    color: 'white',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    fontWeight: 700,
                                                    fontSize: '0.8rem',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 4px 10px rgba(220,38,38,0.2)',
                                                    transition: 'all 0.15s'
                                                }}
                                            >
                                                Stop Simulation
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}

                            <button
                                onClick={() => { setSelectedLoad(null); setRouteData(null); setRouteError(null); }}
                                style={{
                                    padding: '12px',
                                    background: '#ef4444',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '12px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    marginTop: '8px',
                                    boxShadow: '0 4px 10px rgba(239,68,68,0.15)',
                                    transition: 'all 0.15s'
                                }}
                            >
                                Back to All Vehicles
                            </button>
                        </div>
                    ) : (
                        <>
                            {/* Search, Sort, Filter Panel */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color, #e2e8f0)' }}>
                                {/* Search Input */}
                                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                    <input 
                                        type="text" 
                                        placeholder="Search active shipments..." 
                                        value={searchQuery}
                                        onChange={e => setSearchQuery(e.target.value)}
                                        style={{
                                            width: '100%',
                                            padding: '8px 12px 8px 32px',
                                            borderRadius: '10px',
                                            border: '1px solid var(--border-color, #e2e8f0)',
                                            background: 'var(--bg-input, #f8fafc)',
                                            fontSize: '0.85rem',
                                            outline: 'none'
                                        }}
                                    />
                                    <Search size={14} style={{ position: 'absolute', left: '10px', color: '#94a3b8' }} />
                                </div>
                                
                                {/* Sort & Filter Controls */}
                                <div style={{ display: 'flex', gap: '6px' }}>
                                    <select
                                        value={sortBy}
                                        onChange={e => setSortBy(e.target.value)}
                                        style={{
                                            flex: 1.2,
                                            padding: '6px 10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color, #e2e8f0)',
                                            background: 'var(--bg-card, #fff)',
                                            fontSize: '0.78rem',
                                            color: 'var(--text-primary, #475569)',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="customer">Sort: Customer</option>
                                        <option value="load_id">Sort: Order Ref</option>
                                        <option value="pickup">Sort: Pickup</option>
                                        <option value="drop">Sort: Drop</option>
                                    </select>

                                    <button
                                        onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}
                                        style={{
                                            padding: '6px 10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color, #e2e8f0)',
                                            background: 'var(--bg-card, #fff)',
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}
                                        title={sortOrder === 'asc' ? 'Ascending (A-Z)' : 'Descending (Z-A)'}
                                    >
                                        <ArrowUpDown size={14} color="#64748b" />
                                    </button>

                                    <select
                                        value={driverFilter}
                                        onChange={e => setDriverFilter(e.target.value)}
                                        style={{
                                            flex: 1,
                                            padding: '6px 10px',
                                            borderRadius: '8px',
                                            border: '1px solid var(--border-color, #e2e8f0)',
                                            background: 'var(--bg-card, #fff)',
                                            fontSize: '0.78rem',
                                            color: 'var(--text-primary, #475569)',
                                            fontWeight: 600,
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <option value="all">All Drivers</option>
                                        <option value="assigned">Assigned</option>
                                        <option value="unassigned">Unassigned</option>
                                    </select>
                                </div>
                            </div>

                            {/* Active Shipments List */}
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', flex: 1, overflowY: 'auto', paddingRight: '2px', marginTop: '4px' }}>
                                {sortedActiveLoads.length === 0 ? (
                                    <div style={{ padding: '30px 10px', textAlign: 'center', color: '#64748b', fontSize: '0.88rem', fontStyle: 'italic' }}>
                                        {activeLoads.length === 0 ? 'No active shipments are currently running on route.' : 'No matching shipments found.'}
                                    </div>
                                ) : (
                                    sortedActiveLoads.map((load) => (
                                        <div
                                            key={load.load_id}
                                            onClick={() => handleSelectLoad(load)}
                                            style={{
                                                padding: '14px',
                                                background: 'var(--bg-primary, #f8fafc)',
                                                border: '1px solid var(--border-color, #e2e8f0)',
                                                borderRadius: '14px',
                                                cursor: 'pointer',
                                                transition: 'all 0.15s',
                                                display: 'flex',
                                                flexDirection: 'column',
                                                gap: '6px'
                                            }}
                                            className="active-shipment-card"
                                        >
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                <span style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-primary, #0f172a)' }}>{load.customer}</span>
                                                <span style={{ 
                                                    fontSize: '0.72rem', 
                                                    color: '#f97316', 
                                                    fontWeight: 800, 
                                                    background: 'rgba(249,115,22,0.1)', 
                                                    padding: '2px 8px', 
                                                    borderRadius: '8px' 
                                                }}>
                                                    #{load.fleet?.vehicle_number || 'N/A'}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '0.78rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                <MapPin size={12} style={{ color: '#94a3b8' }} />
                                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{load.pickup} → {load.drop}</span>
                                            </div>
                                            <div style={{ fontSize: '0.72rem', color: '#94a3b8', display: 'flex', justifyContent: 'space-between', marginTop: '4px', borderTop: '1px dashed var(--border-color, #e2e8f0)', paddingTop: '6px' }}>
                                                <span>Driver: {load.driver?.full_name || 'None'}</span>
                                                <span style={{ color: '#22c55e', fontWeight: 800, display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }}></span>
                                                    Running
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    )}
                </div>

                {/* Map Area */}
                <div style={{
                    height: "100%",
                    width: "100%",
                    borderRadius: "20px",
                    overflow: "hidden",
                    boxShadow: "0 10px 30px rgba(0,0,0,0.08)",
                    border: "1px solid #e2e8f0"
                }}>
                    <MapContainer center={[12.9716, 77.5946]} zoom={10} style={{ height: "100%", width: "100%" }}>
                        <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                        />

                        {/* Route Render */}
                        {routeData && (
                            <>
                                <MapBoundsAdjuster coords={routeData.optimized.geometry.coordinates.map(([lng, lat]) => [lat, lng])} />
                                <Marker position={routeData.pickup.coords} icon={pickupIcon}>
                                    <Popup><strong>Pickup Point</strong><br />{selectedLoad?.pickup}</Popup>
                                </Marker>
                                <Marker position={routeData.drop.coords} icon={dropIcon}>
                                    <Popup><strong>Drop Destination</strong><br />{selectedLoad?.drop}</Popup>
                                </Marker>
                                
                                {/* Outer polyline for high-contrast border */}
                                <Polyline
                                    positions={routeData.optimized.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
                                    color="#1e293b"
                                    weight={6}
                                    opacity={0.85}
                                />
                                {/* Inner polyline for main route color */}
                                <Polyline
                                    positions={routeData.optimized.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
                                    color="#f97316"
                                    weight={3.5}
                                    opacity={1}
                                />
                            </>
                        )}

                        {/* Fleet Markers */}
                        {fleet.map((truck) => {
                            const isTruckSelected = selectedLoad && selectedLoad.fleet?.vehicle_number === truck.vehicle_number;
                            const isActive = truck.status === 'Running';
                            const vehicleId = truck.vehicle_number || "Unknown";
                            const driver = truck.profiles?.full_name || null;
                            const locationLabel = truck.location || truck.displayLoc || "Unknown";
                            const rawPhone = truck.profiles?.phone || null;
                            const formattedPhone = rawPhone ? `+91 ${String(rawPhone).slice(0, 5)} ${String(rawPhone).slice(5)}` : null;
                            
                            // If a specific load is selected, reduce opacity of other trucks
                            const markerOpacity = selectedLoad ? (isTruckSelected ? 1.0 : 0.4) : 1.0;

                            return (
                                <Marker 
                                    key={truck.id || vehicleId} 
                                    position={[truck.lat, truck.lng]} 
                                    icon={createTruckIcon(isActive, isTruckSelected)}
                                    opacity={markerOpacity}
                                >
                                    <Popup minWidth={230}>
                                        <div style={{ fontFamily: "'Nunito', 'Inter', sans-serif", color: '#1e293b', padding: '2px 0' }}>
                                            {/* Header */}
                                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px', borderBottom: '1px solid #f1f5f9', paddingBottom: '8px' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    <div style={{
                                                        width: '32px', height: '32px', borderRadius: '50%',
                                                        background: isActive ? '#dcfce7' : '#fee2e2',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                        border: `1.5px solid ${isActive ? '#22c55e' : '#ef4444'}`
                                                    }}>
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={isActive ? '#22c55e' : '#ef4444'} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                            <rect x="1" y="3" width="15" height="13"></rect>
                                                            <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
                                                            <circle cx="5.5" cy="18.5" r="2.5"></circle>
                                                            <circle cx="18.5" cy="18.5" r="2.5"></circle>
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <div style={{ fontWeight: '800', fontSize: '0.95rem', color: '#0f172a', lineHeight: 1.2 }}>
                                                            Truck #{vehicleId}
                                                        </div>
                                                        <div style={{ fontSize: '0.7rem', color: '#94a3b8', letterSpacing: '0.05em', textTransform: 'uppercase' }}>Fleet Vehicle</div>
                                                    </div>
                                                </div>
                                                {isActive ? (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#16a34a', fontSize: '0.8rem', fontWeight: 700 }}><CheckCircle size={12} /> Active</span>
                                                ) : (
                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#dc2626', fontSize: '0.8rem', fontWeight: 700 }}><XCircle size={12} /> Inactive</span>
                                                )}
                                            </div>

                                            {/* Detail rows */}
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                                                {/* Driver */}
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <User size={16} style={{ marginTop: '2px', color: '#94a3b8' }} />
                                                    <div>
                                                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Driver</div>
                                                        <div style={{ fontSize: '0.84rem', fontWeight: '600', color: driver ? '#0f172a' : '#94a3b8', fontStyle: driver ? 'normal' : 'italic' }}>
                                                            {driver || 'Unassigned'}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Driver Phone */}
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <Phone size={14} style={{ marginTop: '2px', color: '#94a3b8' }} />
                                                    <div>
                                                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Driver Phone</div>
                                                        {formattedPhone ? (
                                                            <a
                                                                href={`tel:${rawPhone}`}
                                                                style={{ fontSize: '0.84rem', fontWeight: '600', color: '#3b82f6', textDecoration: 'none', letterSpacing: '0.02em' }}
                                                            >
                                                                {formattedPhone}
                                                            </a>
                                                        ) : (
                                                            <div style={{ fontSize: '0.84rem', fontWeight: '600', color: '#94a3b8', fontStyle: 'italic' }}>N/A</div>
                                                        )}
                                                    </div>
                                                </div>

                                                {/* GPS Location */}
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <MapPin size={14} style={{ marginTop: '2px', color: '#94a3b8' }} />
                                                    <div>
                                                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>GPS Location</div>
                                                        <div style={{ fontSize: '0.8rem', fontWeight: '600', color: '#0f172a', fontFamily: 'monospace' }}>
                                                            {truck.lat.toFixed(4)}, {truck.lng.toFixed(4)}
                                                        </div>
                                                        <div style={{ fontSize: '0.72rem', color: '#64748b' }}>
                                                            {locationLabel}
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Vehicle ID */}
                                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                                                    <Tag size={14} style={{ marginTop: '2px', color: '#94a3b8' }} />
                                                    <div>
                                                        <div style={{ fontSize: '0.68rem', color: '#94a3b8', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vehicle ID</div>
                                                        <div style={{ fontSize: '0.84rem', fontWeight: '700', color: '#f97316', fontFamily: 'monospace' }}>
                                                            {vehicleId}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}

                        {/* Breach Markers */}
                        {breachAlerts.map(alert => {
                            if (!alert.gps_lat || !alert.gps_lng) return null;
                            return (
                                <Marker 
                                    key={alert.id} 
                                    position={[alert.gps_lat, alert.gps_lng]} 
                                    icon={createBreachIcon()}
                                >
                                    <Popup minWidth={220}>
                                        <div style={{ fontFamily: "'Nunito', 'Inter', sans-serif" }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ef4444', fontWeight: 900, fontSize: '0.9rem', marginBottom: '6px', borderBottom: '1px solid #fee2e2', paddingBottom: '6px' }}>
                                                <AlertTriangle size={16} /> DRIVER FATIGUE BREACH
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#1e293b', marginBottom: '4px' }}>
                                                <strong>Driver:</strong> {alert.driver?.full_name || 'Unknown'}
                                            </div>
                                            <div style={{ fontSize: '0.8rem', color: '#1e293b', marginBottom: '4px' }}>
                                                <strong>Drive Time:</strong> {Math.floor(alert.drive_minutes_at_breach/60)}h {alert.drive_minutes_at_breach%60}m
                                            </div>
                                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                                                Logged at: {new Date(alert.breach_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                            <div style={{ marginTop: '8px', background: '#fee2e2', color: '#ef4444', padding: '4px', borderRadius: '4px', textAlign: 'center', fontSize: '0.75rem', fontWeight: 700 }}>
                                                Penalty Logged: ₹{alert.penalty_amount}
                                            </div>
                                        </div>
                                    </Popup>
                                </Marker>
                            );
                        })}

                    </MapContainer>
                </div>
            </div>

            <style>{`
                @keyframes pulse {
                    0% { transform: scale(0.9); opacity: 0.8; }
                    50% { transform: scale(1.2); opacity: 1; }
                    100% { transform: scale(0.9); opacity: 0.8; }
                }
                @keyframes pulse-breach {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
                    70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
                @keyframes pulse-bg {
                    0% { background: rgba(239,68,68,0.06); }
                    50% { background: rgba(239,68,68,0.12); }
                    100% { background: rgba(239,68,68,0.06); }
                }
            `}</style>
        </div>
    )
}

export default MapView