import { useState, useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import useWarehouseStore from '../store/warehouseStore';

function ChangeMapView({ center, zoom }) {
  const map = useMap();
  useEffect(() => {
    if (center && zoom) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

const isLoadHeadedToWarehouse = (load, warehouse) => {
    if (!load.drop || !warehouse.name) return false;
    const drop = load.drop.trim().toLowerCase();
    const name = warehouse.name.trim().toLowerCase();
    return name.includes(drop) || drop.includes(name);
};

const WarehouseMap = ({ onOverrideReroute, loads, drivers = [], mapCenter, mapZoom }) => {
    // 1. Get warehouses from Zustand store
    const warehouses = useWarehouseStore((state) => state.warehouses);

    // State to toggle truck details in the map popup
    const [activeDetailLoadId, setActiveDetailLoadId] = useState(null);

    // 2. Center coordinate of India
    const position = [20.5937, 78.9629];

    return (
        <MapContainer
            center={mapCenter || position}
            zoom={mapZoom || 5}
            style={{ height: '100%', width: '100%', borderRadius: '12px', zIndex: 0 }}
        >
            {mapCenter && mapZoom && <ChangeMapView center={mapCenter} zoom={mapZoom} />}
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            />

            {warehouses.map((warehouse) => {
                // Prevent division by zero
                const capacity = warehouse.max_capacity || 1;
                const totalLoad = warehouse.current_load + warehouse.reserved_space;
                const fillPercent = totalLoad / capacity;

                // Find loads headed to this warehouse
                const matchingLoads = (loads || []).filter(l =>
                    l.status !== 'Delivered' && isLoadHeadedToWarehouse(l, warehouse)
                );

                // Determine color and animation class
                let color = '#22c55e'; // green
                let className = '';

                if (fillPercent > 0.85) {
                    color = '#ef4444'; // red
                    className = 'pulse-circle'; // CSS class for animation
                } else if (fillPercent >= 0.60) {
                    color = '#f59e0b'; // amber
                }

                return (
                    <CircleMarker
                        key={warehouse.id}
                        center={[warehouse.lat, warehouse.lng]}
                        radius={14}
                        color={color}
                        fillColor={color}
                        fillOpacity={0.7}
                        weight={3} // border thickness
                        className={className}
                    >
                        <Popup>
                            <div style={{ minWidth: '220px', padding: '5px', color: '#1e293b', fontFamily: "'Nunito', sans-serif" }}>
                                <h3 style={{ margin: '0 0 8px 0', fontSize: '1.05rem', color: '#ea580c', fontWeight: 'bold' }}>
                                    {warehouse.name}
                                </h3>
                                <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                                    <strong>Fill Level:</strong> {Math.round(fillPercent * 100)}%
                                </p>
                                <p style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                                    <strong>Load:</strong> {totalLoad} / {warehouse.max_capacity} tons
                                </p>

                                {/* Incoming Trucks Section */}
                                <div style={{ marginTop: '10px', borderTop: '1px solid #e2e8f0', paddingTop: '8px' }}>
                                    <h4 style={{ margin: '0 0 6px 0', fontSize: '0.8rem', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Incoming Trucks</h4>
                                    {matchingLoads.length === 0 ? (
                                        <p style={{ margin: 0, fontSize: '0.8rem', color: '#94a3b8', fontStyle: 'italic' }}>No incoming trucks</p>
                                    ) : (
                                        matchingLoads.map(load => {
                                            const isExpanded = activeDetailLoadId === load.load_id;
                                            return (
                                                <div key={load.load_id} style={{ marginBottom: '6px', borderBottom: '1px dashed #f1f5f9', paddingBottom: '4px' }}>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                        <span style={{ fontWeight: '700', fontSize: '0.85rem', color: '#0f172a' }}>🚚 {load.customer}</span>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setActiveDetailLoadId(isExpanded ? null : load.load_id);
                                                            }}
                                                            style={{
                                                                background: 'none',
                                                                border: 'none',
                                                                color: '#3b82f6',
                                                                cursor: 'pointer',
                                                                fontSize: '0.75rem',
                                                                fontWeight: 'bold',
                                                                padding: '2px 4px',
                                                                textDecoration: 'underline'
                                                            }}
                                                        >
                                                            {isExpanded ? 'Hide' : 'Details'}
                                                        </button>
                                                    </div>
                                                    {isExpanded && (
                                                        <div style={{
                                                            background: '#f8fafc',
                                                            padding: '8px',
                                                            borderRadius: '6px',
                                                            marginTop: '4px',
                                                            fontSize: '0.75rem',
                                                            display: 'flex',
                                                            flexDirection: 'column',
                                                            gap: '3px',
                                                            border: '1px solid #e2e8f0'
                                                        }}>
                                                            <div><strong>Driver Name:</strong> {load.assigned_driver || 'None'}</div>
                                                            <div><strong>Driver Phone:</strong> {load.phone ? `+91 ${String(load.phone).slice(0, 5)} ${String(load.phone).slice(5)}` : 'N/A'}</div>
                                                            <div><strong>Driver ID:</strong> {load.driver_id || 'N/A'}</div>
                                                            <div><strong>Pickup:</strong> {load.pickup}</div>
                                                            <div><strong>Drop:</strong> {load.drop}</div>
                                                            <div><strong>ETA:</strong> {load.eta}</div>
                                                            <div><strong>Status:</strong> {load.status}</div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })
                                    )}
                                </div>

                                <button
                                    style={{
                                        backgroundColor: '#3b82f6',
                                        color: 'white',
                                        border: 'none',
                                        padding: '8px 12px',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        marginTop: '12px',
                                        width: '100%',
                                        fontWeight: 'bold',
                                        fontSize: '0.85rem',
                                        boxShadow: '0 2px 4px rgba(59, 130, 246, 0.2)'
                                    }}
                                    onClick={() => onOverrideReroute && onOverrideReroute(warehouse)}
                                >
                                    Override Reroute
                                </button>
                            </div>
                        </Popup>
                    </CircleMarker>
                );
            })}
        </MapContainer>
    );
};

export default WarehouseMap;
