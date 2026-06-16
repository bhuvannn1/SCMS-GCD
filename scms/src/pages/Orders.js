import { useEffect, useState, useRef } from "react"
import { Search, ArrowUpDown, Filter, Lock, CheckCircle, Package, MapPin, Home, Truck, ChevronDown, ChevronUp, SearchX, AlertTriangle } from 'lucide-react';
import { useNavigate } from "react-router-dom"
import supabase from "../config/SupabaseClient"
import EmptyState, { getFriendlyError } from "../components/EmptyState";
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

  // Card toggle state
  const [expandedCards, setExpandedCards] = useState(new Set())
  
  const toggleCardExpansion = (id) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const getCityFromLocation = (locationStr) => {
    if (!locationStr || locationStr === 'N/A') return 'N/A';
    let part = locationStr;
    if (locationStr.includes('–')) {
      part = locationStr.split('–')[1];
    } else if (locationStr.includes('-')) {
      part = locationStr.split('-')[1];
    }
    if (part.includes(',')) {
      part = part.split(',')[0];
    }
    return part.trim().toUpperCase();
  };
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
  const [buyerAmount, setBuyerAmount] = useState(0)
  const [orderStatus, setOrderStatus] = useState('Not Confirmed')
  const [paymentStatus, setPaymentStatus] = useState('unpaid')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)

  // Edit Order State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editOrderId, setEditOrderId] = useState('')
  const [editCustomer, setEditCustomer] = useState('')
  const [editPickup, setEditPickup] = useState('')
  const [editDrop, setEditDrop] = useState('')
  const [editEta, setEditEta] = useState('')
  const [editBuyerId, setEditBuyerId] = useState('')
  const [editSellerId, setEditSellerId] = useState('')
  const [editDriverId, setEditDriverId] = useState('')
  const [editFleetId, setEditFleetId] = useState('')
  const [editAssignedAmount, setEditAssignedAmount] = useState(0)
  const [editBuyerAmount, setEditBuyerAmount] = useState(0)
  const [editOrderStatus, setEditOrderStatus] = useState('Pending')
  const [editPaymentStatus, setEditPaymentStatus] = useState('unpaid')
  const [editLoading, setEditLoading] = useState(false)
  const [editError, setEditError] = useState(null)
  const [editBuyerDestinations, setEditBuyerDestinations] = useState([])
  const [editDropMode, setEditDropMode] = useState('custom')
  const [editRoutingData, setEditRoutingData] = useState(null)
  const [editRoutingLoading, setEditRoutingLoading] = useState(false)
  const [editRoutingError, setEditRoutingError] = useState(null)
  const [systemWarehouses, setSystemWarehouses] = useState([])
  const [isPickupDropdownOpen, setIsPickupDropdownOpen] = useState(false)
  const [isDropDropdownOpen, setIsDropDropdownOpen] = useState(false)
  const [isEditPickupDropdownOpen, setIsEditPickupDropdownOpen] = useState(false)
  const [isEditDropDropdownOpen, setIsEditDropDropdownOpen] = useState(false)

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

  const handleCalculateEditRoute = async () => {
    if (!editPickup || !editDrop) {
      setEditRoutingError("Please enter both Pickup and Drop locations first.");
      return;
    }
    setEditRoutingLoading(true);
    setEditRoutingError(null);
    setEditRoutingData(null);
    try {
      const res = await fetch(`${API_BASE}/api/route/optimize?pickup=${encodeURIComponent(editPickup)}&drop=${encodeURIComponent(editDrop)}`);
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to calculate route");
      }
      setEditRoutingData(data);
      if (data.optimized?.distance_km && (!editAssignedAmount || Number(editAssignedAmount) === 0)) {
        // Base rate ₹35/km plus base charge of ₹2000
        const suggestedPrice = Math.round(data.optimized.distance_km * 35 + 2000);
        setEditAssignedAmount(suggestedPrice);
      }
    } catch (err) {
      setEditRoutingError(err.message);
    } finally {
      setEditRoutingLoading(false);
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
  const pickupDropdownRef = useRef(null)
  const dropDropdownRef = useRef(null)
  const editPickupDropdownRef = useRef(null)
  const editDropDropdownRef = useRef(null)

  useClickOutside(filterRef, () => setIsFilterOpen(false))
  useClickOutside(sortRef, () => setIsSortOpen(false))
  useClickOutside(pickupDropdownRef, () => setIsPickupDropdownOpen(false))
  useClickOutside(dropDropdownRef, () => setIsDropDropdownOpen(false))
  useClickOutside(editPickupDropdownRef, () => setIsEditPickupDropdownOpen(false))
  useClickOutside(editDropDropdownRef, () => setIsEditDropDropdownOpen(false))

  const getSearchQuery = (val) => {
    if (!val) return '';
    if (val.includes(' – ')) {
      return val.split(' – ')[0];
    }
    return val;
  };

  const filteredPickups = systemWarehouses.filter(w => {
    const query = getSearchQuery(pickup).toLowerCase();
    return !query || w.name.toLowerCase().startsWith(query);
  });

  const filteredDrops = systemWarehouses.filter(w => {
    const query = getSearchQuery(drop).toLowerCase();
    return !query || w.name.toLowerCase().startsWith(query);
  });

  const filteredEditPickups = systemWarehouses.filter(w => {
    const query = getSearchQuery(editPickup).toLowerCase();
    return !query || w.name.toLowerCase().startsWith(query);
  });

  const filteredEditDrops = systemWarehouses.filter(w => {
    const query = getSearchQuery(editDrop).toLowerCase();
    return !query || w.name.toLowerCase().startsWith(query);
  });

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
      query = query
        .eq('driver_id', userId)
        .neq('status', 'Delivered')
        .neq('status', 'delivered')
        .neq('status', 'Completed')
        .neq('status', 'completed')
        .neq('status', 'Cancelled')
        .neq('status', 'cancelled');
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

    // Fetch system warehouses
    const { data: whs } = await supabase
      .from('warehouses')
      .select('id, name')
      .order('name', { ascending: true })
    setSystemWarehouses(whs || [])

    // Fetch payments to map payment_status dynamically since payment_status column does not exist on Load table.
    const { data: payments } = await supabase.from('payments').select('*')
    const paymentsMap = payments || []

    const mappedLoads = (loads || []).map(load => {
      const loadPayments = paymentsMap.filter(p => p.order_id === load.load_id && p.status === 'success');
      let totalPaidInINR = loadPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) / 100;

      if (totalPaidInINR === 0 && load.payment_status === 'paid') {
        totalPaidInINR = Number(load.buyer_amount) || 0;
      }

      const balanceDue = Math.max(0, (Number(load.buyer_amount) || 0) - totalPaidInINR);
      const isFullyPaid = balanceDue <= 0 && (totalPaidInINR > 0 || load.payment_status === 'paid');
      const isPartiallyPaid = totalPaidInINR > 0 && balanceDue > 0;

      return {
        ...load,
        total_paid: totalPaidInINR,
        balance_due: balanceDue,
        payment_status: isFullyPaid ? 'paid' : isPartiallyPaid ? 'partial' : 'unpaid',
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
    setBuyerAmount(0);
    setRoutingData(null);
    setRoutingError(null);
    setIsPickupDropdownOpen(false);
    setIsDropDropdownOpen(false);
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
          buyer_amount: buyerAmount ? parseFloat(buyerAmount) : 0,
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

  const handleOpenEditModal = async (load) => {
    setEditOrderId(load.load_id);
    setEditCustomer(load.customer || '');
    setEditPickup(load.pickup || '');
    setEditDrop(load.drop || '');
    setEditEta(load.eta || '');
    setEditBuyerId(load.buyer_id || '');
    setEditSellerId(load.seller_id || '');
    setEditDriverId(load.driver_id || '');
    setEditFleetId(load.fleet_id || '');
    setEditAssignedAmount(load.assigned_amount || 0);
    setEditBuyerAmount(load.buyer_amount || 0);
    setEditOrderStatus(load.status || 'Pending');
    setEditPaymentStatus(load.payment_status || 'unpaid');
    setIsEditModalOpen(true);
    setEditError(null);

    // Fetch buyer destinations for edit modal drop selector
    if (load.buyer_id) {
      try {
        const res = await fetch(`${API_BASE}/api/buyer-warehouses?buyer_id=${load.buyer_id}`)
        if (res.ok) {
          const data = await res.json();
          const whs = data.warehouses || [];
          setEditBuyerDestinations(whs);
          const isWarehouseDrop = whs.some(w => load.drop === `${w.name} – ${w.city}${w.state ? ', ' + w.state : ''}`);
          setEditDropMode(isWarehouseDrop ? 'warehouse' : 'custom');
        } else {
          setEditBuyerDestinations([]);
          setEditDropMode('custom');
        }
      } catch (e) {
        setEditBuyerDestinations([]);
        setEditDropMode('custom');
      }
    } else {
      setEditBuyerDestinations([]);
      setEditDropMode('custom');
    }
  };

  const closeEditModal = () => {
    setIsEditModalOpen(false);
    setEditOrderId('');
    setEditCustomer('');
    setEditPickup('');
    setEditDrop('');
    setEditEta('');
    setEditBuyerId('');
    setEditSellerId('');
    setEditDriverId('');
    setEditFleetId('');
    setEditAssignedAmount(0);
    setEditBuyerAmount(0);
    setEditOrderStatus('Pending');
    setEditPaymentStatus('unpaid');
    setEditError(null);
    setEditRoutingData(null);
    setEditRoutingError(null);
    setIsEditPickupDropdownOpen(false);
    setIsEditDropDropdownOpen(false);
  };

  const handleEditOrderSubmit = async (e) => {
    e.preventDefault();
    setEditLoading(true);
    setEditError(null);
    try {
      const { error } = await supabase
        .from('Load')
        .update({
          customer: editCustomer,
          pickup: editPickup,
          drop: editDrop,
          eta: editEta,
          buyer_id: editBuyerId ? editBuyerId : null,
          seller_id: editSellerId ? editSellerId : null,
          driver_id: editDriverId ? editDriverId : null,
          fleet_id: editFleetId ? editFleetId : null,
          assigned_amount: editAssignedAmount ? parseFloat(editAssignedAmount) : 0,
          buyer_amount: editBuyerAmount ? parseFloat(editBuyerAmount) : 0,
          status: editOrderStatus,
          payment_status: editPaymentStatus
        })
        .eq('load_id', editOrderId);

      if (error) throw error;

      closeEditModal();
      fetchData();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditLoading(false);
    }
  };

  return (
    <div className="page orders">
      <div className="header-actions-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
        <div className="header-title-area">
          <h2>Orders</h2>
          <p>Track customer orders, delivery status, and fleet assignments.</p>
        </div>
        {(userRole === 'seller' || userRole === 'owner') && (
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
        )}
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

      {fetchError && (
        <EmptyState
          icon={AlertTriangle}
          variant="warning"
          title="Data Temporarily Unavailable"
          message={getFriendlyError(fetchError)}
          style={{ margin: '20px 0' }}
        />
      )}
      {loadData && loadData.length === 0 && (
        userRole === 'driver' ? (
          <EmptyState
            icon={Package}
            title="Nothing to Deliver Yet"
            message="Orders haven't been assigned. Explore the app while we prepare your next route."
            style={{ margin: '20px 0', minHeight: '240px' }}
          />
        ) : userRole === 'buyer' ? (
          <EmptyState
            icon={Package}
            title="No Purchases Yet"
            message="Your order history will be displayed here once you buy products."
            style={{ margin: '20px 0', minHeight: '240px' }}
          />
        ) : (
          <EmptyState
            icon={Package}
            title="Waiting for Customers"
            message="Customer orders will appear here as they arrive."
            style={{ margin: '20px 0', minHeight: '240px' }}
          />
        )
      )}
      {sortedCards && sortedCards.length === 0 && loadData && loadData.length > 0 && (
        <EmptyState
          icon={SearchX}
          title="No Matches Found"
          message="No orders match your current search or filter criteria. Try adjusting your filters."
          variant="muted"
          size="sm"
          style={{ margin: '20px 0' }}
        />
      )}
      {sortedCards && sortedCards.length > 0 && (
        <div className="loads">
          {sortedCards.map((load) => {
            const isExpanded = expandedCards.has(load.load_id);
            const isFleet = load.load_id?.startsWith('FLEET-');
            
            // Get city names
            const pickupCity = getCityFromLocation(load.pickup);
            const dropCity = getCityFromLocation(load.drop);
            
            // Status mapping for visual badge
            let statusConfig = { bg: '#fff7ed', text: '#f97316', label: load.status || 'Pending', dot: '#f97316' };
            const lowerStatus = (load.status || '').toLowerCase();
            const isUnpaid = load.payment_status !== 'paid';

            if (isUnpaid && (lowerStatus === 'pending' || lowerStatus === 'not confirmed' || lowerStatus === 'confirmed' || lowerStatus === 'damaged')) {
              statusConfig = { bg: '#fee2e2', text: '#ef4444', label: 'Not Confirmed', dot: '#ef4444' };
            } else if (lowerStatus === 'not confirmed' || lowerStatus === 'damaged') {
              statusConfig = { bg: '#fee2e2', text: '#ef4444', label: 'Not Confirmed', dot: '#ef4444' };
            } else if (lowerStatus === 'running' || lowerStatus === 'assigned' || lowerStatus === 'in transit') {
              statusConfig = { bg: '#f97316', text: '#ffffff', label: 'In Transit', dot: '#ffffff' };
            } else if (lowerStatus === 'delivered' || lowerStatus === 'completed') {
              statusConfig = { bg: '#dcfce7', text: '#16a34a', label: 'Delivered', dot: '#16a34a' };
            } else if (lowerStatus === 'confirmed') {
              statusConfig = { bg: '#dbeafe', text: '#2563eb', label: 'Confirmed', dot: '#2563eb' };
            } else if (lowerStatus === 'stopped') {
              statusConfig = { bg: '#fee2e2', text: '#ef4444', label: 'Stopped', dot: '#ef4444' };
            } else {
              // Fallback for any unknown DB status — respect payment state
              statusConfig = isUnpaid
                ? { bg: '#fee2e2', text: '#ef4444', label: 'Not Confirmed', dot: '#ef4444' }
                : { bg: '#dcfce7', text: '#16a34a', label: 'Confirmed', dot: '#16a34a' };
            }
            
            // Generate contextual AI insights
            let aiInsight = "Route monitored by active systems.";
            if (isUnpaid && (lowerStatus === 'pending' || lowerStatus === 'not confirmed' || lowerStatus === 'confirmed')) {
              aiInsight = `Awaiting payment confirmation from the buyer to schedule route dispatch.`;
            } else if (lowerStatus === 'pending' || lowerStatus === 'not confirmed') {
              aiInsight = `Order registered. Awaiting fleet allocation and driver assignment for route.`;
            } else if (lowerStatus === 'assigned') {
              aiInsight = `Driver and vehicle assigned. Initial safety check complete. Ready for dispatch to ${dropCity || 'destination'}.`;
            } else if (lowerStatus === 'running' || lowerStatus === 'in transit') {
              aiInsight = `On schedule. Optimal route speed tracking. Traffic at ${dropCity || 'destination'} clearing.`;
            } else if (lowerStatus === 'delivered') {
              aiInsight = `Shipment safely delivered at ${dropCity || 'destination'}. Awaiting confirmation sign-off.`;
            } else if (lowerStatus === 'confirmed') {
              aiInsight = `Transaction complete. Payment reconciled and warehouse inventory updated.`;
            } else if (lowerStatus === 'stopped') {
              aiInsight = `Vehicle stationary. Routine check or driver rest period active.`;
            }

            return (
              <div key={load.load_id} className="load-card" style={{
                background: 'var(--bg-card, #ffffff)',
                borderRadius: '24px',
                padding: '24px',
                boxShadow: '0 10px 30px rgba(0,0,0,0.04)',
                border: '1px solid var(--border-color, #e2e8f0)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                transition: 'all 0.3s ease',
                position: 'relative',
                overflow: 'hidden'
              }}>
                {/* Visual indicator bar on the left side of the card, premium style */}
                <div style={{
                  position: 'absolute',
                  left: 0,
                  top: 0,
                  bottom: 0,
                  width: '5px',
                  background: lowerStatus === 'running' || lowerStatus === 'assigned' || lowerStatus === 'in transit' 
                    ? 'linear-gradient(180deg, #f97316, #ea580c)' 
                    : lowerStatus === 'delivered' || lowerStatus === 'confirmed'
                    ? 'linear-gradient(180deg, #10b981, #059669)'
                    : 'linear-gradient(180deg, #cbd5e1, #94a3b8)'
                }} />

                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Peach Package Icon container */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: 'rgba(249, 115, 22, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(249, 115, 22, 0.15)'
                    }}>
                      <Package size={20} color="#f97316" />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>ORDER REF</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                        #{load.load_id}
                      </div>
                    </div>
                  </div>
                  
                  {/* Status Badge */}
                  <span style={{
                    background: statusConfig.bg,
                    color: statusConfig.text,
                    borderRadius: '20px',
                    padding: '6px 12px',
                    fontSize: '0.75rem',
                    fontWeight: '700',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    boxShadow: statusConfig.text === '#ffffff' ? '0 4px 10px rgba(249,115,22,0.25)' : 'none'
                  }}>
                    <span style={{
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      background: statusConfig.dot,
                      display: 'inline-block'
                    }} />
                    {statusConfig.label}
                  </span>
                </div>

                {/* Route Visualizer */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '8px 0', width: '100%' }}>
                  {/* Pickup City */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '70px', textAlign: 'center' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: '#1e293b',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 4px 10px rgba(15,23,42,0.15)'
                    }}>
                      <MapPin size={16} color="#ffffff" />
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-primary, #1e293b)', marginTop: '8px', letterSpacing: '0.5px' }}>
                      {pickupCity}
                    </span>
                  </div>

                  {/* Connected line with vehicle */}
                  <div style={{ flexGrow: 1, height: '2px', background: '#e2e8f0', margin: '0 12px', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: '#ffffff',
                      border: '1.5px solid #f97316',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      boxShadow: '0 2px 6px rgba(249,115,22,0.15)'
                    }}>
                      <Truck size={14} color="#f97316" />
                    </div>
                  </div>

                  {/* Drop City */}
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '70px', textAlign: 'center' }}>
                    <div style={{
                      width: '38px',
                      height: '38px',
                      borderRadius: '10px',
                      background: 'var(--bg-inset)',
                      border: '1.5px solid var(--border-inset)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}>
                      <Home size={16} color="var(--text-secondary)" />
                    </div>
                    <span style={{ fontSize: '0.72rem', fontWeight: 800, color: 'var(--text-primary, #1e293b)', marginTop: '8px', letterSpacing: '0.5px' }}>
                      {dropCity}
                    </span>
                  </div>
                </div>

                {/* ETA and VALUE block */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--bg-inset)', padding: '12px 16px', borderRadius: '14px', border: '1px solid var(--border-color)' }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>ETA</span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary, #1e293b)' }}>{load.eta || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', display: 'block', letterSpacing: '0.5px' }}>
                      {userRole === 'driver' ? 'EARNING' : 'VALUE'}
                    </span>
                    <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-primary, #1e293b)' }}>
                      {userRole === 'driver' 
                        ? (load.assigned_amount ? `₹${Number(load.assigned_amount).toLocaleString("en-IN")}` : 'Not Set')
                        : (load.buyer_amount ? `₹${Number(load.buyer_amount).toLocaleString("en-IN")}` : 'Not Set')
                      }
                    </span>
                  </div>
                </div>

                {/* AI Insight Box */}
                {!isFleet && (
                  <div style={{
                    padding: '12px 16px',
                    background: 'var(--bg-inset)',
                    borderRadius: '16px',
                    border: '1px solid var(--border-inset)',
                    fontSize: '0.78rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.4'
                  }}>
                    <strong style={{ color: 'var(--text-primary)', fontWeight: 700 }}>AI Insight:</strong> {aiInsight}
                  </div>
                )}

                {/* Directly display Pay Now button for buyers if unpaid/partial */}
                {userRole === 'buyer' && load.balance_due > 0 && !isFleet && (
                  <button
                    onClick={() => navigate(`/payments?orderId=${load.load_id}`)}
                    style={{
                      width: '100%',
                      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      color: 'white',
                      border: 'none',
                      padding: '12px 16px',
                      borderRadius: '12px',
                      fontWeight: 700,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      boxShadow: '0 4px 12px rgba(249,115,22,0.25)',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 16px rgba(249,115,22,0.35)'; }}
                    onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 12px rgba(249,115,22,0.25)'; }}
                  >
                    <Lock size={14} /> Pay Now
                  </button>
                )}

                {/* Expandable Details Container */}
                {isExpanded && (
                  <div style={{
                    borderTop: '1px solid #f1f5f9',
                    paddingTop: '16px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}>
                    {userRole === 'driver' ? (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>CUSTOMER (BUYER)</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.customer || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>STATUS</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.status}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>PICKUP ADDRESS</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.pickup}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>DROP ADDRESS</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.drop}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>BUYER CONTACT</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {load.buyer?.email ? `${load.buyer.email} ${load.buyer.phone ? `| ${load.buyer.phone}` : ''}` : 'N/A'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>SELLER CONTACT</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>
                            {load.seller?.email ? `${load.seller.email} ${load.seller.phone ? `| ${load.seller.phone}` : ''}` : 'N/A'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>VEHICLE NUMBER</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.vehicleId || 'None'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>EARNING (YOUR PAY)</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            {load.assigned_amount ? `₹${Number(load.assigned_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : 'Not Set'}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>CUSTOMER</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.customer}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>STATUS</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.status}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>PICKUP ADDRESS</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.pickup}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>DROP ADDRESS</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.drop}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>ASSIGNED DRIVER</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.assigned_driver || 'None'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>DRIVER PHONE</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.driver?.phone || 'N/A'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>VEHICLE NUMBER</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 600 }}>{load.vehicleId || 'None'}</span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>PRICE (DRIVER)</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            {load.assigned_amount ? `₹${Number(load.assigned_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : 'Not Set'}
                          </span>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>PRICE (BUYER)</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontWeight: 700 }}>
                            {load.buyer_amount ? `₹${Number(load.buyer_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}` : 'Not Set'}
                          </span>
                        </div>
                        {load.total_paid > 0 && load.payment_status !== 'paid' && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>PAID AMOUNT</span>
                            <span style={{ fontSize: '0.82rem', color: '#10b981', fontWeight: 700 }}>
                              ₹{Number(load.total_paid).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        {load.balance_due > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                            <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>BALANCE DUE</span>
                            <span style={{ fontSize: '0.82rem', color: '#ef4444', fontWeight: 700 }}>
                              ₹{Number(load.balance_due).toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                            </span>
                          </div>
                        )}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', gridColumn: '1 / -1' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase' }}>DRIVER ID</span>
                          <span style={{ fontSize: '0.82rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>{localeDigits(load.driver_id) || 'None'}</span>
                        </div>
                      </div>
                    )}

                    {/* Edit Order Button — shown only for sellers/owners within details */}
                    {(userRole === 'seller' || userRole === 'owner') && !isFleet && (
                      <button
                        onClick={() => handleOpenEditModal(load)}
                        style={{
                          width: '100%',
                          background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
                          color: 'white',
                          border: 'none',
                          padding: '10px 16px',
                          borderRadius: '10px',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: '8px',
                          boxShadow: '0 4px 10px rgba(59,130,246,0.2)',
                          transition: 'all 0.2s',
                          marginTop: '8px'
                        }}
                      >
                        Edit Order
                      </button>
                    )}
                  </div>
                )}

                {/* Card Footer Actions */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderTop: '1px solid #f1f5f9',
                  paddingTop: '16px',
                  marginTop: 'auto'
                }}>
                  {/* Details Toggle Button */}
                  <button
                    onClick={() => toggleCardExpansion(load.load_id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#64748b',
                      fontSize: '0.85rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      padding: 0
                    }}
                  >
                    Details
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>

                  {/* Track Live / View Map button — only for non-drivers */}
                  {userRole !== 'driver' && (
                    lowerStatus === 'running' || lowerStatus === 'in transit' ? (
                      <button
                        onClick={() => navigate(`/map?loadId=${load.load_id}`)}
                        style={{
                          background: '#2563eb',
                          color: 'white',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'pointer',
                          boxShadow: '0 4px 10px rgba(37,99,235,0.2)',
                          transition: 'all 0.2s'
                        }}
                        onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 6px 14px rgba(37,99,235,0.3)'; }}
                        onMouseLeave={e => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 4px 10px rgba(37,99,235,0.2)'; }}
                      >
                        Track Live
                      </button>
                    ) : (
                      <button
                        disabled
                        style={{
                          background: '#f1f5f9',
                          color: '#94a3b8',
                          border: 'none',
                          padding: '8px 16px',
                          borderRadius: '20px',
                          fontWeight: 700,
                          fontSize: '0.82rem',
                          cursor: 'not-allowed'
                        }}
                      >
                        Track Live
                      </button>
                    )
                  )}
                </div>
              </div>
            );
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
                <div ref={pickupDropdownRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Pickup Location</label>
                  <input
                    type="text"
                    required
                    value={pickup}
                    onChange={e => {
                      setPickup(e.target.value);
                      setIsPickupDropdownOpen(true);
                    }}
                    onFocus={() => setIsPickupDropdownOpen(true)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="Type warehouse or custom location..."
                  />
                  {isPickupDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 10,
                      marginTop: '4px'
                    }}>
                      {filteredPickups.length > 0 ? (
                        filteredPickups.map(w => (
                          <div
                            key={w.id}
                            onClick={() => {
                              setPickup(w.name);
                              setIsPickupDropdownOpen(false);
                            }}
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              borderBottom: '1px solid var(--border-color, #f1f5f9)',
                              transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.08)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            🏢 {w.name}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '10px 16px', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                          No matching warehouses found. Press enter or click outside to use custom location.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div ref={dropDropdownRef} style={{ position: 'relative' }}>
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
                            onClick={() => {
                              setDrop(label);
                              setDropMode('warehouse');
                            }}
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
                        onClick={() => {
                          setDropMode('custom');
                          setDrop('');
                        }}
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
                  <input
                    type="text"
                    required
                    value={drop}
                    onChange={e => {
                      setDrop(e.target.value);
                      setDropMode('custom');
                      setIsDropDropdownOpen(true);
                    }}
                    onFocus={() => setIsDropDropdownOpen(true)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder={buyerDestinations.length > 0 ? 'Or type warehouse or custom location...' : 'Type warehouse or custom location...'}
                  />
                  {isDropDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 10,
                      marginTop: '4px'
                    }}>
                      {filteredDrops.length > 0 ? (
                        filteredDrops.map(w => (
                          <div
                            key={w.id}
                            onClick={() => {
                              setDrop(w.name);
                              setIsDropDropdownOpen(false);
                            }}
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              borderBottom: '1px solid var(--border-color, #f1f5f9)',
                              transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.08)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            🏢 {w.name}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '10px 16px', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                          No matching warehouses found. Press enter or click outside to use custom location.
                        </div>
                      )}
                    </div>
                  )}
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
                    {/* Terrain badge + ETA headline */}
                    {routingData.optimized?.breakdown && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: routingData.optimized.breakdown.terrain_type === 'Plain' ? 'rgba(16,185,129,0.1)' : routingData.optimized.breakdown.terrain_type === 'Mixed' ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)', color: routingData.optimized.breakdown.terrain_type === 'Plain' ? '#10b981' : routingData.optimized.breakdown.terrain_type === 'Mixed' ? '#f97316' : '#ef4444', padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>⛰ {routingData.optimized.breakdown.terrain_type} Terrain</span>
                          {routingData.optimized.breakdown.hilly_km > 0 && <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{routingData.optimized.breakdown.plain_km.toFixed(0)} km plain · {routingData.optimized.breakdown.hilly_km.toFixed(0)} km hilly</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f97316' }}>🕐 ETA: {Math.round(routingData.optimized.breakdown.total_hours)}h transit</div>
                      </div>
                    )}
                    {/* Metrics grid: 3 columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div style={{ background: 'var(--bg-card, #fff)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' }}>DISTANCE</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f97316' }}>{routingData.optimized.distance_km.toFixed(1)} km</div>
                        <div style={{ fontSize: '0.58rem', color: '#10b981', fontWeight: 600 }}>Save {routingData.savings.distance_km.toFixed(1)} km</div>
                      </div>
                      <div style={{ background: 'var(--bg-card, #fff)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' }}>FUEL COST</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f97316' }}>₹{Math.round(routingData.optimized.fuel_cost).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: '0.58rem', color: '#10b981', fontWeight: 600 }}>Save ₹{Math.round(routingData.savings.fuel_cost).toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card, #fff)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' }}>CO₂</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f97316' }}>{routingData.optimized.co2_kg.toFixed(1)} kg</div>
                        <div style={{ fontSize: '0.58rem', color: '#10b981', fontWeight: 600 }}>Save {routingData.savings.co2_kg.toFixed(1)} kg</div>
                      </div>
                    </div>
                    {/* Breakdown strip */}
                    {routingData.optimized?.breakdown && (
                      <div style={{ background: 'var(--bg-card, #fff)', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Time Breakdown (1 Driver · Motor Vehicles Act)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>{routingData.optimized.breakdown.pure_driving_hours}h</div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b' }}>🚛 Driving</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b' }}>{routingData.optimized.breakdown.break_hours}h</div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b' }}>☕ Break Hours</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ef4444' }}>{routingData.optimized.breakdown.checkpoint_delays}h</div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b' }}>🛂 Checkpoint Delays</div>
                          </div>
                        </div>
                      </div>
                    )}
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
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                    ETA
                  </label>
                  <input type="date" value={eta} onChange={e => setEta(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Price for Driver (INR)</label>
                  <input type="number" value={assignedAmount} onChange={e => setAssignedAmount(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="25000" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Price for Buyer (INR)</label>
                  <input type="number" value={buyerAmount} onChange={e => setBuyerAmount(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="30000" />
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
                    <option value="Not Confirmed">Not Confirmed</option>
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

      {isEditModalOpen && (
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
            <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Edit Order</h3>
            <p style={{ margin: '0 0 24px 0', fontSize: '0.875rem', color: '#64748b' }}>Modify order logistics, status, pricing, and driver assignments.</p>

            {editError && (
              <div style={{
                padding: '12px 16px', background: '#fee2e2', color: '#ef4444',
                borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                marginBottom: '16px', border: '1px solid #fecaca'
              }}>
                ✗ {editError}
              </div>
            )}

            <form onSubmit={handleEditOrderSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Order ID</label>
                  <input type="text" readOnly required value={editOrderId} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: '#f1f5f9', cursor: 'not-allowed' }} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Customer Name (Auto-filled)</label>
                  <input type="text" readOnly required value={editCustomer} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: '#f1f5f9', cursor: 'not-allowed' }} placeholder="Select a Buyer below..." />
                </div>
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div ref={editPickupDropdownRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Pickup Location</label>
                  <input
                    type="text"
                    required
                    value={editPickup}
                    onChange={e => {
                      setEditPickup(e.target.value);
                      setIsEditPickupDropdownOpen(true);
                    }}
                    onFocus={() => setIsEditPickupDropdownOpen(true)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder="Type warehouse or custom location..."
                  />
                  {isEditPickupDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 10,
                      marginTop: '4px'
                    }}>
                      {filteredEditPickups.length > 0 ? (
                        filteredEditPickups.map(w => (
                          <div
                            key={w.id}
                            onClick={() => {
                              setEditPickup(w.name);
                              setIsEditPickupDropdownOpen(false);
                            }}
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              borderBottom: '1px solid var(--border-color, #f1f5f9)',
                              transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.08)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            🏢 {w.name}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '10px 16px', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                          No matching warehouses found. Press enter or click outside to use custom location.
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div ref={editDropDropdownRef} style={{ position: 'relative' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Drop Location</label>
                  {editBuyerDestinations.length > 0 && (
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '8px', flexWrap: 'wrap' }}>
                      {editBuyerDestinations.map(wh => {
                        const label = `${wh.name} – ${wh.city}${wh.state ? ', ' + wh.state : ''}`;
                        const isSelected = editDrop === label;
                        return (
                          <button
                            key={wh.id}
                            type="button"
                            onClick={() => {
                              setEditDrop(label);
                              setEditDropMode('warehouse');
                            }}
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
                        onClick={() => {
                          setEditDropMode('custom');
                          setEditDrop('');
                        }}
                        style={{
                          padding: '5px 12px',
                          borderRadius: '20px',
                          border: editDropMode === 'custom' && !editBuyerDestinations.some(w => editDrop === `${w.name} – ${w.city}${w.state ? ', ' + w.state : ''}`) ? '1.5px solid #64748b' : '1px dashed #94a3b8',
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
                  <input
                    type="text"
                    required
                    value={editDrop}
                    onChange={e => {
                      setEditDrop(e.target.value);
                      setEditDropMode('custom');
                      setIsEditDropDropdownOpen(true);
                    }}
                    onFocus={() => setIsEditDropDropdownOpen(true)}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }}
                    placeholder={editBuyerDestinations.length > 0 ? 'Or type warehouse or custom location...' : 'Type warehouse or custom location...'}
                  />
                  {isEditDropDropdownOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      left: 0,
                      right: 0,
                      backgroundColor: 'var(--bg-card, #ffffff)',
                      border: '1px solid var(--border-color, #cbd5e1)',
                      borderRadius: '12px',
                      boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                      maxHeight: '200px',
                      overflowY: 'auto',
                      zIndex: 10,
                      marginTop: '4px'
                    }}>
                      {filteredEditDrops.length > 0 ? (
                        filteredEditDrops.map(w => (
                          <div
                            key={w.id}
                            onClick={() => {
                              setEditDrop(w.name);
                              setIsEditDropDropdownOpen(false);
                            }}
                            style={{
                              padding: '10px 16px',
                              cursor: 'pointer',
                              fontSize: '0.875rem',
                              borderBottom: '1px solid var(--border-color, #f1f5f9)',
                              transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(249, 115, 22, 0.08)'}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            🏢 {w.name}
                          </div>
                        ))
                      ) : (
                        <div style={{ padding: '10px 16px', fontSize: '0.85rem', color: '#64748b', fontStyle: 'italic' }}>
                          No matching warehouses found. Press enter or click outside to use custom location.
                        </div>
                      )}
                    </div>
                  )}
                  {editBuyerDestinations.length === 0 && editBuyerId && (
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
                    onClick={handleCalculateEditRoute}
                    disabled={editRoutingLoading}
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
                    {editRoutingLoading ? 'Calculating...' : 'Calculate Route'}
                  </button>
                </div>
                
                {editRoutingError && (
                  <div style={{ fontSize: '0.8rem', color: '#ef4444', fontWeight: 600 }}>
                    ⚠ {editRoutingError}
                  </div>
                )}
                
                {editRoutingData && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {/* Terrain badge + ETA headline */}
                    {editRoutingData.optimized?.breakdown && (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.65rem', fontWeight: 700, background: editRoutingData.optimized.breakdown.terrain_type === 'Plain' ? 'rgba(16,185,129,0.1)' : editRoutingData.optimized.breakdown.terrain_type === 'Mixed' ? 'rgba(249,115,22,0.1)' : 'rgba(239,68,68,0.1)', color: editRoutingData.optimized.breakdown.terrain_type === 'Plain' ? '#10b981' : editRoutingData.optimized.breakdown.terrain_type === 'Mixed' ? '#f97316' : '#ef4444', padding: '2px 8px', borderRadius: '20px', textTransform: 'uppercase' }}>⛰ {editRoutingData.optimized.breakdown.terrain_type} Terrain</span>
                          {editRoutingData.optimized.breakdown.hilly_km > 0 && <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{editRoutingData.optimized.breakdown.plain_km.toFixed(0)} km plain · {editRoutingData.optimized.breakdown.hilly_km.toFixed(0)} km hilly</span>}
                        </div>
                        <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#f97316' }}>🕐 ETA: {Math.round(editRoutingData.optimized.breakdown.total_hours)}h transit</div>
                      </div>
                    )}
                    {/* Metrics grid: 3 columns */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <div style={{ background: 'var(--bg-card, #fff)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' }}>DISTANCE</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f97316' }}>{editRoutingData.optimized.distance_km.toFixed(1)} km</div>
                        <div style={{ fontSize: '0.58rem', color: '#10b981', fontWeight: 600 }}>Save {editRoutingData.savings.distance_km.toFixed(1)} km</div>
                      </div>
                      <div style={{ background: 'var(--bg-card, #fff)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' }}>FUEL COST</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f97316' }}>₹{Math.round(editRoutingData.optimized.fuel_cost).toLocaleString('en-IN')}</div>
                        <div style={{ fontSize: '0.58rem', color: '#10b981', fontWeight: 600 }}>Save ₹{Math.round(editRoutingData.savings.fuel_cost).toLocaleString('en-IN')}</div>
                      </div>
                      <div style={{ background: 'var(--bg-card, #fff)', padding: '10px', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', textAlign: 'center' }}>
                        <div style={{ fontSize: '0.6rem', color: '#64748b', fontWeight: 'bold' }}>CO₂</div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: '#f97316' }}>{editRoutingData.optimized.co2_kg.toFixed(1)} kg</div>
                        <div style={{ fontSize: '0.58rem', color: '#10b981', fontWeight: 600 }}>Save {editRoutingData.savings.co2_kg.toFixed(1)} kg</div>
                      </div>
                    </div>
                    {/* Breakdown strip */}
                    {editRoutingData.optimized?.breakdown && (
                      <div style={{ background: 'var(--bg-card, #fff)', borderRadius: '10px', border: '1px solid var(--border-color, #e2e8f0)', padding: '10px 14px' }}>
                        <div style={{ fontSize: '0.6rem', color: '#94a3b8', fontWeight: 700, textTransform: 'uppercase', marginBottom: '8px' }}>Time Breakdown (1 Driver · Motor Vehicles Act)</div>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px' }}>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#1e293b' }}>{editRoutingData.optimized.breakdown.pure_driving_hours}h</div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b' }}>🚛 Driving</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#f59e0b' }}>{editRoutingData.optimized.breakdown.break_hours}h</div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b' }}>☕ Break Hours</div>
                          </div>
                          <div style={{ textAlign: 'center' }}>
                            <div style={{ fontSize: '0.78rem', fontWeight: 800, color: '#ef4444' }}>{editRoutingData.optimized.breakdown.checkpoint_delays}h</div>
                            <div style={{ fontSize: '0.58rem', color: '#64748b' }}>🛂 Checkpoint Delays</div>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Mini Leaflet Map */}
                    <div style={{ height: '180px', width: '100%', borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color, #e2e8f0)' }}>
                      <MapContainer
                        center={editRoutingData.pickup.coords}
                        zoom={7}
                        style={{ height: '100%', width: '100%' }}
                        zoomControl={false}
                      >
                        <TileLayer
                          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                          attribution='&copy; OpenStreetMap'
                        />
                        <Marker position={editRoutingData.pickup.coords} icon={pickupIcon} />
                        <Marker position={editRoutingData.drop.coords} icon={dropIcon} />
                        <Polyline
                          positions={editRoutingData.optimized.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
                          color="#f97316"
                          weight={4}
                          opacity={0.8}
                        />
                      </MapContainer>
                    </div>
                  </div>
                )}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>
                    ETA
                  </label>
                  <input type="date" value={editEta} onChange={e => setEditEta(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Price for Driver (INR)</label>
                  <input type="number" value={editAssignedAmount} onChange={e => setEditAssignedAmount(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="25000" />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Price for Buyer (INR)</label>
                  <input type="number" value={editBuyerAmount} onChange={e => setEditBuyerAmount(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="30000" />
                </div>
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Buyer</label>
                  <select
                    required
                    value={editBuyerId}
                    onChange={async e => {
                      const selectedId = e.target.value;
                      setEditBuyerId(selectedId);
                      const buyerObj = buyersList.find(b => b.id === selectedId);
                      setEditCustomer(buyerObj ? buyerObj.full_name : '');
                      
                      if (!selectedId) { setEditBuyerDestinations([]); return; }
                      try {
                        const res = await fetch(`${API_BASE}/api/buyer-warehouses?buyer_id=${selectedId}`)
                        if (res.ok) {
                          const data = await res.json();
                          const whs = data.warehouses || [];
                          setEditBuyerDestinations(whs);
                          const primary = whs.find(w => w.is_default) || whs[0];
                          if (primary) {
                            const dropLabel = `${primary.name} – ${primary.city}${primary.state ? ', ' + primary.state : ''}`;
                            setEditDrop(dropLabel);
                            setEditDropMode('warehouse');
                          } else {
                            setEditDropMode('custom');
                          }
                        } else {
                          setEditBuyerDestinations([]);
                          setEditDropMode('custom');
                        }
                      } catch (e) {
                        setEditBuyerDestinations([]);
                        setEditDropMode('custom');
                      }
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
                  <select value={editSellerId} onChange={e => setEditSellerId(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--bg-card)' }}>
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
                    value={editFleetId}
                    onChange={e => {
                      const selectedId = e.target.value;
                      setEditFleetId(selectedId);
                      const selectedVehicle = fleetData.find(v => v.id === selectedId);
                      if (selectedVehicle?.driver_id) {
                        setEditDriverId(selectedVehicle.driver_id);
                      } else {
                        setEditDriverId('');
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
                    value={driversList.find(d => d.id === editDriverId)?.full_name || 'No driver assigned to selected vehicle'}
                    style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: '#f1f5f9', cursor: 'not-allowed' }}
                  />
                </div>
              </div>
 
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Order Status</label>
                  <select value={editOrderStatus} onChange={e => setEditOrderStatus(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--bg-card)' }}>
                    <option value="Pending">Pending</option>
                    <option value="Assigned">Assigned</option>
                    <option value="Running">Running</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Confirmed">Confirmed</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Payment Status</label>
                  <select value={editPaymentStatus} onChange={e => setEditPaymentStatus(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--bg-card)' }}>
                    <option value="unpaid">Unpaid</option>
                    <option value="paid">Paid</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                <button type="button" onClick={closeEditModal} style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                <button type="submit" disabled={editLoading} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                  {editLoading ? 'Saving...' : 'Save Changes'}
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
