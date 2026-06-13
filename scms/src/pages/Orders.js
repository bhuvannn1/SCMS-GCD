import { useEffect, useState, useRef } from "react"
import { Search, ArrowUpDown, Filter, Lock, CheckCircle } from 'lucide-react';
import { useNavigate } from "react-router-dom"
import supabase from "../config/SupabaseClient"
import useClickOutside from "../hooks/useClickOutside"
import { MapContainer, TileLayer, Marker, Polyline } from "react-leaflet"
import L from "leaflet"

const TruckIcon = () => (
  <svg className="truck-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="1" y="3" width="15" height="13"></rect>
    <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
    <circle cx="5.5" cy="18.5" r="2.5"></circle>
    <circle cx="18.5" cy="18.5" r="2.5"></circle>
  </svg>
)

const createPinIcon = (color) => new L.divIcon({
  className: `custom-pin-marker-${color}`,
  html: `
    <div style="
      background-color: #fff;
      border: 2px solid ${color};
      border-radius: 50% 50% 50% 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 2px 6px rgba(0,0,0,0.15);
      transform: rotate(-45deg);
    ">
      <div style="
        width: 10px;
        height: 10px;
        background-color: ${color};
        border-radius: 50%;
        transform: rotate(45deg);
      "></div>
    </div>
  `,
  iconSize: [24, 24],
  iconAnchor: [12, 24],
  popupAnchor: [0, -24]
});

const pickupIcon = createPinIcon('#22c55e'); // Green
const dropIcon = createPinIcon('#ef4444'); // Red

const Orders = () => {
  const [fetchError, setFetchError] = useState(null)
  const [loadData, setLoadData] = useState(null)
  const [fleetData, setFleetData] = useState([])
  const [userRole, setUserRole] = useState(null)
  const navigate = useNavigate()

  // Add Order State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [orderId, setOrderId] = useState('')
  const [customer, setCustomer] = useState('')
  const [pickup, setPickup] = useState('')
  const [drop, setDrop] = useState('')
  const [eta, setEta] = useState('')
  const [buyerId, setBuyerId] = useState('')
  const [sellerId, setSellerId] = useState('')
  const [driverId, setDriverId] = useState('')
  const [fleetId, setFleetId] = useState('')
  const [assignedAmount, setAssignedAmount] = useState(0)
  const [orderStatus, setOrderStatus] = useState('Pending')
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)

  // Lists for dropdowns
  const [buyersList, setBuyersList] = useState([])
  const [sellersList, setSellersList] = useState([])
  const [driversList, setDriversList] = useState([])
  const [buyerDestinations, setBuyerDestinations] = useState([]) // buyer's registered destination warehouses
  const [dropMode, setDropMode] = useState('custom') // 'warehouse' | 'custom'

  const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:5000'

  const [routingData, setRoutingData] = useState(null)
  const [routingLoading, setRoutingLoading] = useState(false)
  const [routingError, setRoutingError] = useState(null)

  const handleCalculateRoute = async () => {
    if (!pickup || !drop) {
      setRoutingError("Please enter both Pickup and Drop locations first.");
      return;
    }
    setRoutingLoading(true);
    setRoutingError(null);
    setRoutingData(null);
    try {
      const res = await fetch(`${API_BASE}/api/route/optimize?pickup=${encodeURIComponent(pickup)}&drop=${encodeURIComponent(drop)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to calculate route");
      }
      setRoutingData(data);
      // Auto-set ETA if empty or default
      if (data.optimized?.duration_sec) {
        const hours = Math.round(data.optimized.duration_sec / 3600);
        setEta(`${hours} Hours`);
      }
      // Auto-suggest price if 0 or empty
      if (data.optimized?.distance_km && (!assignedAmount || Number(assignedAmount) === 0)) {
        // Base rate ₹35/km plus base charge of ₹2000
        const suggestedPrice = Math.round(data.optimized.distance_km * 35 + 2000);
        setAssignedAmount(suggestedPrice);
      }
    } catch (err) {
      setRoutingError(err.message);
    } finally {
      setRoutingLoading(false);
    }
  };

  // Converts ASCII digits in a string to the active locale's numeral script
  const localeDigits = (str) => {
    return str;
  };

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [driverFilter, setDriverFilter] = useState('all')
  const [sortBy, setSortBy] = useState('customer')
  const [sortOrder, setSortOrder] = useState('asc')

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)

  const filterRef = useRef(null)
  const sortRef = useRef(null)

  useClickOutside(filterRef, () => setIsFilterOpen(false))
  useClickOutside(sortRef, () => setIsSortOpen(false))

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (driverFilter !== 'all' ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || searchQuery !== '' || sortBy !== 'customer' || sortOrder !== 'asc';

  const handleResetAll = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setDriverFilter('all')
    setSortBy('customer')
    setSortOrder('asc')
  };

  const fetchData = async () => {
    // Fetch user role for conditional UI
    const { data: { session } } = await supabase.auth.getSession()
    let currentRole = null;
    let userId = null;
    if (session?.user) {
      const { data: profileData } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle()
      currentRole = profileData?.role || session.user.user_metadata?.role || 'buyer'
      setUserRole(currentRole)
      userId = session.user.id
      setSellerId(userId) // Pre-set sellerId to the current user's ID
    }

    let query = supabase
      .from('Load')
      .select(`
        *,
        buyer:profiles!buyer_id(full_name, email, phone),
        seller:profiles!seller_id(full_name, email, phone),
        driver:profiles!driver_id(full_name, email, phone),
        fleet:Fleet!fleet_id(vehicle_number, status, location)
      `)

    if (currentRole === 'driver') {
      query = query.eq('driver_id', userId)
    } else if (currentRole === 'buyer') {
      query = query.eq('buyer_id', userId)
    }

    const { data: loads, error: loadError } = await query

    if (loadError) {
      setFetchError('Could not fetch the loads')
      setLoadData(null)
      console.error(loadError)
      return
    }

    const { data: fleet, error: fleetError } = await supabase
      .from('Fleet')
      .select(`
        *,
        profiles:driver_id(full_name)
      `)

    if (fleetError) {
      console.error('Error fetching fleet:', fleetError)
    } else {
      setFleetData(fleet || [])
    }

    // Fetch buyers, sellers, drivers profiles for dropdowns
    const { data: profiles } = await supabase.from('profiles').select('id, full_name, role')
    if (profiles) {
      setBuyersList(profiles.filter(p => p.role === 'buyer'))
      setSellersList(profiles.filter(p => p.role === 'seller' || p.role === 'owner'))
      setDriversList(profiles.filter(p => p.role === 'driver'))
    }

    // Fetch payments to map payment_status dynamically since payment_status column does not exist on Load table.
    const { data: payments } = await supabase.from('payments').select('*')
    const paymentsMap = payments || []

    const mappedLoads = (loads || []).map(load => {
      const hasPayment = paymentsMap.some(p => p.order_id === load.load_id && p.status === 'success');
      return {
        ...load,
        payment_status: (load.payment_status === 'paid' || hasPayment) ? 'paid' : 'unpaid',
        assigned_driver: load.driver?.full_name || 'None',
        vehicleId: load.fleet?.vehicle_number || 'None'
      }
    })

    setLoadData(mappedLoads)
    setFetchError(null)
  }

  // Fetch buyer's registered destination warehouses when buyer changes
  const fetchBuyerDestinations = async (selectedBuyerId) => {
    if (!selectedBuyerId) { setBuyerDestinations([]); return; }
    try {
      const res = await fetch(`${API_BASE}/api/buyer-warehouses?buyer_id=${selectedBuyerId}`)
      if (!res.ok) return;
      const data = await res.json();
      const whs = data.warehouses || [];
      setBuyerDestinations(whs);
      // Auto-fill drop with buyer's primary warehouse if available
      const primary = whs.find(w => w.is_default) || whs[0];
      if (primary) {
        const dropLabel = `${primary.name} – ${primary.city}${primary.state ? ', ' + primary.state : ''}`;
        setDrop(dropLabel);
        setDropMode('warehouse');
      } else {
        setDropMode('custom');
      }
    } catch (e) {
      setBuyerDestinations([]);
    }
  };

  useEffect(() => {
    fetchData()
  }, [])

  // Process matching and add synthetic cards for unmatched fleet vehicles
  const matchedVehicleIds = new Set()

  const processedLoads = loadData ? loadData.map((load) => {
    if (load.vehicleId && load.vehicleId !== 'None') {
      matchedVehicleIds.add(load.vehicleId.trim().toLowerCase())
    }
    return load
  }) : []

  const syntheticLoads = []
  if (loadData && fleetData.length > 0) {
    fleetData.forEach((vehicle) => {
      const vid = vehicle.vehicle_number
      if (!vid) return

      const normalizedVid = vid.trim().toLowerCase()
      if (!matchedVehicleIds.has(normalizedVid)) {
        const isRunning = vehicle.status === 'Running'
        syntheticLoads.push({
          load_id: `FLEET-${vid.trim().replace(/\s+/g, '-')}`,
          customer: 'Fleet Logistics',
          pickup: vehicle.location || 'N/A',
          drop: 'N/A',
          eta: 'N/A',
          status: isRunning ? 'Running' : 'Stopped',
          assigned_driver: vehicle.profiles?.full_name || 'None',
          driver_id: 'N/A',
          vehicleId: vid
        })
      }
    })
  }

  const combinedCards = processedLoads

  // Extract unique statuses dynamically
  const uniqueStatuses = Array.from(new Set(combinedCards.map(c => c.status).filter(Boolean)))

  // Filter
  const filteredCards = combinedCards.filter(load => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (load.customer && load.customer.toLowerCase().includes(q)) ||
      (load.load_id && load.load_id.toLowerCase().includes(q)) ||
      (load.pickup && load.pickup.toLowerCase().includes(q)) ||
      (load.drop && load.drop.toLowerCase().includes(q)) ||
      (load.assigned_driver && load.assigned_driver.toLowerCase().includes(q)) ||
      (load.vehicleId && load.vehicleId.toLowerCase().includes(q));

    const matchesStatus = statusFilter === 'all' || load.status === statusFilter;

    const matchesDriver = driverFilter === 'all' ||
      (driverFilter === 'assigned' && load.assigned_driver && load.assigned_driver !== 'None' && load.assigned_driver !== '') ||
      (driverFilter === 'unassigned' && (!load.assigned_driver || load.assigned_driver === 'None' || load.assigned_driver === ''));

    return matchesSearch && matchesStatus && matchesDriver;
  });

  // Sort
  const sortedCards = [...filteredCards].sort((a, b) => {
    let valA = a[sortBy] || '';
    let valB = b[sortBy] || '';

    if (typeof valA === 'string') {
      return sortOrder === 'asc'
        ? valA.localeCompare(valB)
        : valB.localeCompare(valA);
    } else {
      return sortOrder === 'asc'
        ? (valA > valB ? 1 : -1)
        : (valB > valA ? 1 : -1);
    }
  });

  const closeAddModal = () => {
    setIsAddModalOpen(false);
    setOrderId('');
    setCustomer('');
    setPickup('');
    setDrop('');
    setEta('');
    setBuyerId('');
    setSellerId('');
    setDriverId('');
    setFleetId('');
    setAssignedAmount(0);
    setRoutingData(null);
    setRoutingError(null);
  };

  const handleAddOrderSubmit = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    try {
      const { error } = await supabase
        .from('Load')
        .insert({
          load_id: orderId,
          customer,
          pickup,
          drop,
          eta,
          buyer_id: buyerId ? buyerId : null,
          seller_id: sellerId ? sellerId : null,
          driver_id: driverId ? driverId : null,
          fleet_id: fleetId ? fleetId : null,
          assigned_amount: assignedAmount ? parseFloat(assignedAmount) : 0,
          status: orderStatus,
          payment_status: paymentStatus
        });

      if (error) throw error;

      closeAddModal();
      fetchData();
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="page orders">
      <div className="header-actions-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
        <div className="header-title-area">
          <h2>Orders</h2>
          <p>Track customer orders, delivery status, and fleet assignments.</p>
        </div>
        <button
          onClick={() => {
            setIsAddModalOpen(true);
            setOrderId(`ORD-${Math.floor(100000 + Math.random() * 900000)}`);
            setRoutingData(null);
            setRoutingError(null);
          }}
          style={{
            padding: '10px 20px',
            background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
            color: 'white',
            border: 'none',
            borderRadius: '12px',
            fontWeight: '700',
            fontSize: '0.9rem',
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(249,115,22,0.2)',
            transition: 'all 0.2s'
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(249,115,22,0.3)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.2)'; }}
        >
          + Add Order
        </button>
      </div>

        <div className="search-filter-sort-wrapper">
          {/* Search Box */}
          <div className="search-box-container">
            <input
              type="text"
              placeholder="Search orders..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-v3"
            />
            <span className="search-icon-v3" style={{ display: 'flex', alignItems: 'center' }}><Search size={14} /></span>
          </div>

          {/* Sort Trigger Button & Popover */}
          <div style={{ position: 'relative' }} ref={sortRef}>
            <button
              className={`sort-trigger-btn ${sortBy !== 'customer' || sortOrder !== 'asc' ? 'active' : ''}`}
              onClick={() => {
                setIsSortOpen(!isSortOpen);
                setIsFilterOpen(false);
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><ArrowUpDown size={14} /> Sort</span>
            </button>

            {isSortOpen && (
              <div className="custom-popover-card">
                <div className="popover-header-v3">
                  <h4>Sort Options</h4>
                  <button className="clear-btn" onClick={() => { setSortBy('customer'); setSortOrder('asc'); }}>Reset</button>
                </div>
                <div className="popover-body-v3">
                  <div className="popover-field-v3">
                    <label>Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="popover-input-v3"
                    >
                      <option value="customer">Customer</option>
                      <option value="load_id">Order ID</option>
                      <option value="pickup">Pickup</option>
                      <option value="drop">Drop</option>
                      <option value="eta">ETA</option>
                      <option value="status">Status</option>
                    </select>
                  </div>
                  <div className="popover-field-v3">
                    <label>Direction</label>
                    <div className="popover-btn-group">
                      <button
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: sortOrder === 'asc' ? '1px solid var(--accent)' : '1px solid var(--border-input)',
                          background: sortOrder === 'asc' ? 'var(--accent-bg)' : 'transparent',
                          color: sortOrder === 'asc' ? 'var(--accent)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                        onClick={() => setSortOrder('asc')}
                      >
                        Ascending (▲)
                      </button>
                      <button
                        style={{
                          padding: '8px',
                          borderRadius: '8px',
                          border: sortOrder === 'desc' ? '1px solid var(--accent)' : '1px solid var(--border-input)',
                          background: sortOrder === 'desc' ? 'var(--accent-bg)' : 'transparent',
                          color: sortOrder === 'desc' ? 'var(--accent)' : 'var(--text-primary)',
                          cursor: 'pointer',
                          fontWeight: 'bold'
                        }}
                        onClick={() => setSortOrder('desc')}
                      >
                        Descending (▼)
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Filter Trigger Button & Popover */}
          <div style={{ position: 'relative' }} ref={filterRef}>
            <button
              className={`filter-trigger-btn ${activeFilterCount > 0 ? 'active' : ''}`}
              onClick={() => {
                setIsFilterOpen(!isFilterOpen);
                setIsSortOpen(false);
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><Filter size={14} /> Filter</span>
              {activeFilterCount > 0 && <span className="filter-badge-v3">{activeFilterCount}</span>}
            </button>

            {isFilterOpen && (
              <div className="custom-popover-card">
                <div className="popover-header-v3">
                  <h4>Filter Options</h4>
                  <button className="clear-btn" onClick={() => { setStatusFilter('all'); setDriverFilter('all'); }}>Clear</button>
                </div>
                <div className="popover-body-v3">
                  <div className="popover-field-v3">
                    <label>Order Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="popover-input-v3"
                    >
                      <option value="all">All Statuses</option>
                      {uniqueStatuses.map(status => (
                        <option key={status} value={status}>{status}</option>
                      ))}
                    </select>
                  </div>
                  <div className="popover-field-v3">
                    <label>Driver Assignment</label>
                    <select
                      value={driverFilter}
                      onChange={(e) => setDriverFilter(e.target.value)}
                      className="popover-input-v3"
                    >
                      <option value="all">All Assignments</option>
                      <option value="assigned">Driver Assigned</option>
                      <option value="unassigned">No Driver</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {hasActiveFilters && (
            <button
              onClick={handleResetAll}
              style={{
                background: 'transparent',
                border: '1px dashed var(--border-color)',
                color: 'var(--text-secondary)',
                padding: '10px 14px',
                borderRadius: '12px',
                fontSize: '0.9rem',
                fontWeight: '600',
                cursor: 'pointer'
              }}
            >
              Clear All
            </button>
          )}
        </div>

      {fetchError && (<p className="error">{fetchError}</p>)}
      {loadData && loadData.length === 0 && (
        <p>No data found! The "Load" table is either empty or Row Level Security (RLS) is blocking read access.</p>
      )}
      {sortedCards && sortedCards.length === 0 && loadData && loadData.length > 0 && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No orders match the search criteria.</p>
      )}
      {sortedCards && sortedCards.length > 0 && (
        <div className="loads">
          {sortedCards.map((load) => {
            return (
              <div key={load.load_id} className="load-card">
                <div className="load-header">
                  <div className="load-header-left">
                    <div className="load-icon">
                      <TruckIcon />
                    </div>
                    <h3>{load.customer}</h3>
                  </div>
                  <span className="load-header-badge">ID: {load.load_id}</span>
                </div>
                <div className="load-details">
                  <div className="detail-item">
                    <span className="detail-label">CUSTOMER</span>
                    <span className="detail-value">{load.customer}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">PICKUP</span>
                    <span className="detail-value">{load.pickup}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">DROP</span>
                    <span className="detail-value">{load.drop}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">ETA</span>
                    <span className="detail-value">{load.eta}</span>
                  </div>
                  <div className="detail-item stat-status">
                    <span className="detail-label">STATUS</span>
                    <span className="detail-value">{load.status}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">ASSIGNED DRIVER</span>
                    <span className="detail-value">{load.assigned_driver || 'None'}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">VEHICLE NUMBER</span>
                    <span className="detail-value">{load.vehicleId}</span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">PRICE</span>
                    <span style={{ color: load.payment_status === 'paid' ? '#10b981' : '#3b82f6', fontWeight: 700 }}>
                      {load.assigned_amount ? `₹${Number(load.assigned_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : 'Not Set'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">PAYMENT STATUS</span>
                    <span style={{ color: load.payment_status === 'paid' ? '#10b981' : '#f59e0b', fontWeight: 700, textTransform: 'uppercase' }}>
                      {load.payment_status || 'UNPAID'}
                    </span>
                  </div>
                  <div className="detail-item">
                    <span className="detail-label">DRIVER ID</span>
                    <span className="detail-value" style={{ fontSize: '0.9rem', fontFamily: 'monospace' }}>
                      {localeDigits(load.driver_id) || 'None'}
                    </span>
                  </div>
                </div>

                {/* Pay Now Button — shown for buyers on unpaid orders */}
                {userRole === 'buyer' && load.payment_status !== 'paid' && !load.load_id?.startsWith('FLEET-') && (
                  <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-color, rgba(0,0,0,0.06))' }}>
                    <button
                      onClick={() => navigate(`/payments?orderId=${load.load_id}`)}
                      style={{
                        width: '100%',
                        background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                        color: 'white',
                        border: 'none',
                        padding: '10px 16px',
                        borderRadius: '10px',
                        fontWeight: 700,
                        fontSize: '0.875rem',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '8px',
                        boxShadow: '0 4px 12px rgba(249,115,22,0.3)',
                        transition: 'all 0.2s',
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(249,115,22,0.4)'; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.3)'; }}
                    >
                      <Lock size={14} /> Pay Now
                    </button>
                  </div>
                )}
                {load.payment_status === 'paid' && !load.load_id?.startsWith('FLEET-') && (
                  <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border-color, rgba(0,0,0,0.06))', textAlign: 'center' }}>
                    <span style={{ color: '#10b981', fontWeight: 700, fontSize: '0.85rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><CheckCircle size={14} /> Payment Received</span>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {isAddModalOpen && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.6)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px'
        }}>
          <div style={{
            background: 'var(--bg-card, #ffffff)',
            borderRadius: '24px', width: '100%',
            maxWidth: '560px', padding: '32px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
            border: '1px solid var(--border-color, #e2e8f0)',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Add New Order</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.875rem', color: '#64748b' }}>Create a new load record and allocate routing, status, and pricing.</p>

            {addError && (
              <div style={{
                padding: '12px 16px', background: '#fee2e2', color: '#ef4444',
                borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                marginBottom: '16px', border: '1px solid #fecaca'
              }}>
                ✗ {addError}
              </div>
            )}

            <form onSubmit={handleAddOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Order ID (Auto-generated)</label>
                  <input type="text" readOnly required value={orderId} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: '#f1f5f9', cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Customer Name (Auto-filled)</label>
                  <input type="text" readOnly required value={customer} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: '#f1f5f9', cursor: 'not-allowed' }} placeholder="Select a Buyer below..." />
                </div>
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Pickup Location</label>
                  <input type="text" required value={pickup} onChange={e => setPickup(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Mumbai" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Drop Location</label>
                  {buyerDestinations.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      {buyerDestinations.map(wh => {
                        const label = `${wh.name} – ${wh.city}${wh.state ? ', ' + wh.state : ''}`;
                        const isSelected = drop === label;
                        return (
                          <button
                            key={wh.id}
                            type="button"
                            onClick={() => { setDrop(label); setDropMode('warehouse'); }}
                            style={{
                              padding: '5px 12px',
                              borderRadius: '20px',
                              border: isSelected ? '1.5px solid #f97316' : '1px solid rgba(249,115,22,0.3)',
                              background: isSelected ? 'rgba(249,115,22,0.12)' : 'transparent',
                              color: isSelected ? '#f97316' : '#64748b',
                              fontWeight: isSelected ? 700 : 500,
                              fontSize: '0.78rem',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              transition: 'all 0.15s'
                            }}
                          >
                            {wh.is_default && '⭐ '}{wh.name}
                          </button>
                        );
                      })}
                      <button
                        type="button"
                        onClick={() => { setDropMode('custom'); setDrop(''); }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          border: dropMode === 'custom' && !buyerDestinations.some(w => drop === `${w.name} – ${w.city}${w.state ? ', ' + w.state : ''}`) ? '1.5px solid #64748b' : '1px dashed #94a3b8',
                          background: 'transparent',
                          color: '#64748b',
                          fontSize: '0.78rem',
                          cursor: 'pointer'
                        }}
                      >
                        + Custom
                      </button>
                    </div>
                  )}
                  {buyerDestinations.length > 0 && drop && (
                    <div style={{ fontSize: '0.75rem', color: '#10b981', marginBottom: '6px', fontWeight: 600 }}>
                      ✓ Delivery to: {drop}
                    </div>
                  )}
                  <input type="text" required value={drop} onChange={e => { setDrop(e.target.value); setDropMode('custom'); }} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder={buyerDestinations.length > 0 ? 'Or type a custom location...' : 'Pune'} />
                  {buyerDestinations.length === 0 && buyerId && (
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '4px' }}>
                      ℹ This buyer has not registered any destination warehouses.
                    </div>
                  )}
                </div>
              </div>

              {/* Route Optimization Preview Section */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: '16px', borderRadius: '16px', background: 'rgba(249, 115, 22, 0.05)', border: '1px solid rgba(249, 115, 22, 0.15)', marginTop: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>Smart Route Optimization</span>
                  <button
                    type="button"
                    onClick={handleCalculateRoute}
                    disabled={routingLoading}
                    style={{
                      padding: '8px 14px',
                      background: 'rgba(249,115,22,0.1)',
                      color: '#f97316',
                      border: '1px solid #f97316',
                      borderRadius: '8px',
                      fontWeight: '700',
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {routingLoading ? 'Calculating...' : 'Calculate Route'}
                  </button>
                </div>
                
                {routingError && (
                  <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                    ⚠ {routingError}
                  </div>
                )}
                
                {routingData && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Metrics grid */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div style={{ background: 'var(--bg-card, #fff)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold' }}>DISTANCE</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f97316' }}>{routingData.optimized.distance_km.toFixed(1)} km</div>
                        <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>Save {routingData.savings.distance_km.toFixed(1)} km</div>
                      </div>
                      <div style={{ background: 'var(--bg-card, #fff)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold' }}>FUEL COST</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f97316' }}>₹{Math.round(routingData.optimized.fuel_cost).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>Save ₹{Math.round(routingData.savings.fuel_cost).toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card, #fff)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold' }}>CO2 EMISSIONS</div>
                        <div style={{ fontSize: '0.9rem', fontWeight: 800, color: '#f97316' }}>{routingData.optimized.co2_kg.toFixed(1)} kg</div>
                        <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>Save {routingData.savings.co2_kg.toFixed(1)} kg</div>
                      </div>
                    </div>
                    
                    {/* Mini Leaflet Map */}
                    <div style={{ height: '180px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color, #e2e8f0)' }}>
                      <MapContainer
                        center={routingData.pickup.coords}
                        zoom={7}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; OpenStreetMap'
                        />
                        <Marker position={routingData.pickup.coords} icon={pickupIcon} />
                        <Marker position={routingData.drop.coords} icon={dropIcon} />
                        <Polyline
                          positions={routingData.optimized.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
                          color="#f97316"
                          weight={4}
                          opacity={0.8}
                        />
                      </MapContainer>
                    </div>
                  </div>
                )}
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                    ETA <span style={{ fontSize: '0.65rem', textTransform: 'none', color: '#f97316', fontWeight: 'normal' }}>(Estimated Time of Arrival, e.g. "24 Hours")</span>
                  </label>
                  <input type="text" value={eta} onChange={e => setEta(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="24 Hours" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Assigned Price (INR)</label>
                  <input type="number" value={assignedAmount} onChange={e => setAssignedAmount(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="25000" />
                </div>
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Buyer</label>
                  <select
                    required
                    value={buyerId}
                    onChange={e => {
                      const selectedId = e.target.value;
                      setBuyerId(selectedId);
                      const buyerObj = buyersList.find(b => b.id === selectedId);
                      setCustomer(buyerObj ? buyerObj.full_name : '');
                      fetchBuyerDestinations(selectedId);
                    }}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--bg-card)' }}
                  >
                    <option value="">Select Buyer</option>
                    {buyersList.map(b => (
                      <option key={b.id} value={b.id}>{b.full_name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Seller</label>
                  <select value={sellerId} onChange={e => setSellerId(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--bg-card)' }}>
                    <option value="">Select Seller</option>
                    {sellersList.map(s => (
                      <option key={s.id} value={s.id}>{s.full_name}</option>
                    ))}
                  </select>
                </div>
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Fleet Vehicle (Active Only)</label>
                  <select
                    required
                    value={fleetId}
                    onChange={e => {
                      const selectedId = e.target.value;
                      setFleetId(selectedId);
                      const selectedVehicle = fleetData.find(v => v.id === selectedId);
                      if (selectedVehicle?.driver_id) {
                        setDriverId(selectedVehicle.driver_id);
                      } else {
                        setDriverId('');
                      }
                    }}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--bg-card)' }}
                  >
                    <option value="">Select Vehicle</option>
                    {fleetData.filter(v => v.status === 'Active' || v.status === 'Running').map(v => (
                      <option key={v.id} value={v.id}>{v.vehicle_number} {v.profiles?.full_name ? `(${v.profiles.full_name})` : ''}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Assigned Driver (Auto-selected)</label>
                  <input
                    type="text"
                    readOnly
                    value={driversList.find(d => d.id === driverId)?.full_name || 'No driver assigned to selected vehicle'}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: '#f1f5f9', cursor: 'not-allowed' }}
                  />
                </div>
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Order Status</label>
                  <select value={orderStatus} onChange={e => setOrderStatus(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--bg-card)' }}>
                    <option value="Pending">Pending</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Running">Running</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Confirmed">Confirmed</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Payment Status</label>
                  <select value={paymentStatus} onChange={e => setPaymentStatus(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--bg-card)' }}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={closeAddModal} style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                <button type="submit" disabled={addLoading} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                  {addLoading ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Orders
