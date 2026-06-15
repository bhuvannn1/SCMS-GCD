import { useEffect, useState, useRef } from "react"
import { Search, ArrowUpDown, Filter } from 'lucide-react';
import supabase from "../config/SupabaseClient"
import useClickOutside from "../hooks/useClickOutside"

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

const Fleet = () => {
  const [fetchError, setFetchError] = useState(null)
  const [fleetData, setFleetData] = useState(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [driverFilter, setDriverFilter] = useState('all')
  const [sortBy, setSortBy] = useState('vehicle_id')
  const [sortOrder, setSortOrder] = useState('asc')

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)

  // Add Fleet State
  const [isAddModalOpen, setIsAddModalOpen] = useState(false)
  const [driverName, setDriverName] = useState('')
  const [driverEmail, setDriverEmail] = useState('')
  const [driverPassword, setDriverPassword] = useState('')
  const [driverPhone, setDriverPhone] = useState('')
  const [driverLicense, setDriverLicense] = useState('')
  const [vehicleNumber, setVehicleNumber] = useState('')
  const [location, setLocation] = useState('')
  const [vehicleStatus, setVehicleStatus] = useState('Running')
  const [addLoading, setAddLoading] = useState(false)
  const [addError, setAddError] = useState(null)

  const formatCoordinateString = (val) => {
    if (!val) return '';
    const digits = val.replace(/\D/g, '').slice(0, 12);
    if (digits.length === 0) return '';
    
    let formatted = '';
    if (digits.length <= 2) {
      formatted = digits;
    } else if (digits.length <= 6) {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2);
    } else if (digits.length <= 8) {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2, 6) + ', ' + digits.slice(6);
    } else {
      formatted = digits.slice(0, 2) + '.' + digits.slice(2, 6) + ', ' + digits.slice(6, 8) + '.' + digits.slice(8);
    }
    return formatted;
  };

  const handleLocationChange = (e) => {
    setLocation(formatCoordinateString(e.target.value));
  };

  const formatVehicleNumber = (val) => {
    if (!val) return '';
    const raw = val.toUpperCase().replace(/[^A-Z0-9]/g, '');
    let part1 = '';
    let part2 = '';
    let part3 = '';
    let part4 = '';
    
    for (let i = 0; i < raw.length; i++) {
      const char = raw[i];
      const isDigit = char >= '0' && char <= '9';
      const isLetter = char >= 'A' && char <= 'Z';
      
      if (part1.length < 2) {
        if (isLetter) part1 += char;
      } else if (part2.length < 2) {
        if (isDigit) part2 += char;
      } else if (part3.length < 2) {
        if (isLetter) part3 += char;
      } else if (part4.length < 4) {
        if (isDigit) part4 += char;
      }
    }
    
    let formatted = part1;
    if (part1.length === 2 && part2.length > 0) {
      formatted += ' ' + part2;
    }
    if (part2.length === 2 && part3.length > 0) {
      formatted += ' ' + part3;
    }
    if (part3.length === 2 && part4.length > 0) {
      formatted += ' ' + part4;
    }
    return formatted;
  };

  const handleVehicleNumberChange = (e) => {
    setVehicleNumber(formatVehicleNumber(e.target.value));
  };

  const filterRef = useRef(null)
  const sortRef = useRef(null)

  useClickOutside(filterRef, () => setIsFilterOpen(false))
  useClickOutside(sortRef, () => setIsSortOpen(false))

  const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (driverFilter !== 'all' ? 1 : 0);
  const hasActiveFilters = activeFilterCount > 0 || searchQuery !== '' || sortBy !== 'vehicle_id' || sortOrder !== 'asc';

  const handleResetAll = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setDriverFilter('all')
    setSortBy('vehicle_id')
    setSortOrder('asc')
  };

  const fetchFleet = async () => {
    const { data: fleet, error: fleetError } = await supabase
      .from('Fleet')
      .select(`
        id,
        vehicle_number,
        status,
        location,
        driver_id,
        profiles:driver_id (
          full_name,
          email,
          phone
        )
      `)

    if (fleetError) {
      setFetchError('Could not fetch fleet data')
      setFleetData(null)
      console.log(fleetError)
      return
    }

    const { data: drivers, error: driversError } = await supabase
      .from('driver')
      .select('id, license_number, status, verified')

    if (driversError) {
      console.log('Error fetching drivers metadata:', driversError)
    }

    // Fetch running loads to accurately determine "Running" status
    const { data: runningLoads } = await supabase
      .from('Load')
      .select('driver_id')
      .eq('status', 'Running')

    const runningDriverIds = new Set((runningLoads || []).map(l => l.driver_id))

    const mappedFleet = (fleet || []).map(vehicle => {
      const driverMeta = (drivers || []).find(d => d.id === vehicle.driver_id)
      const isRunning = vehicle.driver_id && runningDriverIds.has(vehicle.driver_id)
      return {
        ...vehicle,
        status: isRunning ? 'Running' : 'Stopped',
        license_number: driverMeta?.license_number || 'N/A',
        driver_status: driverMeta?.verified ? 'Verified' : 'Unverified'
      }
    })

    setFleetData(mappedFleet)
    setFetchError(null)
  }

  const handleVerifyDriver = async (driverId) => {
    if (!driverId) return;
    try {
      const response = await fetch(`${API}/api/driver/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: driverId,
          verificationStatus: 'Verified'
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to verify driver');
      }

      alert('Driver successfully verified!');
      fetchFleet();
    } catch (err) {
      alert('Error verifying driver: ' + err.message);
    }
  };

  useEffect(() => {
    fetchFleet()
  }, [])

  // Filter
  const filteredFleet = fleetData ? fleetData.filter(vehicle => {
    const q = searchQuery.toLowerCase();
    const isRunning = vehicle.status === 'Running';
    const driverName = vehicle.profiles?.full_name || '';
    const hasDriver = !!vehicle.driver_id;
    const vid = vehicle.vehicle_number || '';
    const loc = vehicle.location || '';

    const matchesSearch =
      vid.toLowerCase().includes(q) ||
      loc.toLowerCase().includes(q) ||
      driverName.toLowerCase().includes(q);

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'running' && isRunning) ||
      (statusFilter === 'stopped' && !isRunning);

    const matchesDriver = driverFilter === 'all' ||
      (driverFilter === 'assigned' && hasDriver) ||
      (driverFilter === 'unassigned' && !hasDriver);

    return matchesSearch && matchesStatus && matchesDriver;
  }) : [];

  // Sort
  const sortedFleet = [...filteredFleet].sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortBy === 'vehicle_id') {
      valA = a.vehicle_number || '';
      valB = b.vehicle_number || '';
    } else if (sortBy === 'driver') {
      valA = a.profiles?.full_name || '';
      valB = b.profiles?.full_name || '';
    } else if (sortBy === 'location') {
      valA = a.location || '';
      valB = b.location || '';
    }

    return sortOrder === 'asc'
      ? valA.localeCompare(valB)
      : valB.localeCompare(valA);
  });

  const handleAddFleetSubmit = async (e) => {
    e.preventDefault();
    setAddLoading(true);
    setAddError(null);
    try {
      // 1. Create driver user account via backend admin API
      const createUserRes = await fetch(`${API}/api/admin/create-user`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: driverEmail,
          password: driverPassword,
          full_name: driverName,
          phone: driverPhone,
          role: 'driver',
          license_number: driverLicense,
          status: 'Active'
        })
      });

      const createUserData = await createUserRes.json();
      if (!createUserRes.ok || createUserData.error) {
        throw new Error(createUserData.error || 'Failed to create driver account');
      }

      const newDriverId = createUserData.user_id;

      // 2. Onboard and link vehicle, setting verification to 'Verified'
      // Map 'Running' or 'Stopped' status to 'Active'/'Inactive'
      const mappedStatus = vehicleStatus === 'Running' ? 'Active' : 'Inactive';

      const onboardRes = await fetch(`${API}/api/driver/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: newDriverId,
          fullName: driverName,
          phone: driverPhone,
          licenseNumber: driverLicense,
          vehicleNumber: vehicleNumber,
          location: location || 'N/A',
          status: mappedStatus,
          verificationStatus: 'Verified'
        })
      });

      const onboardData = await onboardRes.json();
      if (!onboardRes.ok || onboardData.error) {
        throw new Error(onboardData.error || 'Failed to onboard vehicle and driver');
      }

      // 3. Reset states & close modal
      setIsAddModalOpen(false);
      setDriverName('');
      setDriverEmail('');
      setDriverPassword('');
      setDriverPhone('');
      setDriverLicense('');
      setVehicleNumber('');
      setLocation('');
      setVehicleStatus('Running');
      fetchFleet();
      alert('Fleet details added and driver account automatically verified!');
    } catch (err) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <div className="page fleet">
      <div className="header-actions-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
        <div className="header-title-area">
          <h2>Fleet Overview</h2>
          <p>Manage and monitor real-time vehicle status and assignments.</p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
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
          + Add Fleet
        </button>
      </div>

        <div className="search-filter-sort-wrapper">
          {/* Search Box */}
          <div className="search-box-container">
            <input
              type="text"
              placeholder="Search fleet..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-v3"
            />
            <span className="search-icon-v3" style={{ display: 'flex', alignItems: 'center' }}><Search size={14} /></span>
          </div>

          {/* Sort Trigger Button & Popover */}
          <div style={{ position: 'relative' }} ref={sortRef}>
            <button
              className={`sort-trigger-btn ${sortBy !== 'vehicle_id' || sortOrder !== 'asc' ? 'active' : ''}`}
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
                  <button className="clear-btn" onClick={() => { setSortBy('vehicle_id'); setSortOrder('asc'); }}>Reset</button>
                </div>
                <div className="popover-body-v3">
                  <div className="popover-field-v3">
                    <label>Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="popover-input-v3"
                    >
                      <option value="vehicle_id">Vehicle ID</option>
                      <option value="driver">Driver Name</option>
                      <option value="location">Location</option>
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
                    <label>Vehicle Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="popover-input-v3"
                    >
                      <option value="all">All Statuses</option>
                      <option value="running">Running</option>
                      <option value="stopped">Stopped</option>
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

      {fleetData && fleetData.length === 0 && (
        <p>No vehicles found! Add some trucks or check RLS.</p>
      )}

      {sortedFleet && sortedFleet.length === 0 && fleetData && fleetData.length > 0 && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No vehicles match the search criteria.</p>
      )}

      {sortedFleet && sortedFleet.length > 0 && (
        <div className="fleet-list">
          {sortedFleet.map((vehicle) => {
            const isRunning = vehicle.status === 'Running' || vehicle.status === 'Active';
            const leftBarBg = isRunning
              ? 'linear-gradient(180deg, #10b981, #059669)'
              : 'linear-gradient(180deg, #ef4444, #dc2626)';

            return (
              <div key={vehicle.id} className="fleet-card" style={{
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
                  background: leftBarBg
                }} />

                {/* Card Header */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    {/* Peach Truck Icon container */}
                    <div style={{
                      width: '42px',
                      height: '42px',
                      borderRadius: '12px',
                      background: 'rgba(249, 115, 22, 0.08)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      border: '1px solid rgba(249, 115, 22, 0.15)',
                      color: '#f97316'
                    }}>
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>VEHICLE REF</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                        {vehicle.vehicle_number}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                    {/* Active Status Badge */}
                    <span style={{
                      background: isRunning ? 'rgba(16,185,129,0.08)' : 'rgba(239, 68, 68, 0.08)',
                      color: isRunning ? '#10b981' : '#ef4444',
                      borderRadius: '20px',
                      padding: '6px 12px',
                      fontSize: '0.75rem',
                      fontWeight: '700',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <span style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        background: isRunning ? '#10b981' : '#ef4444',
                        display: 'inline-block'
                      }} />
                      {isRunning ? 'Active' : 'Inactive'}
                    </span>

                    {/* Verification Status Badge */}
                    {vehicle.driver_id && (
                      <span style={{
                        background: vehicle.driver_status === 'Verified' ? 'rgba(16,185,129,0.08)' : 'rgba(245, 158, 11, 0.08)',
                        color: vehicle.driver_status === 'Verified' ? '#10b981' : '#f59e0b',
                        borderRadius: '20px',
                        padding: '6px 12px',
                        fontSize: '0.75rem',
                        fontWeight: '700',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}>
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: vehicle.driver_status === 'Verified' ? '#10b981' : '#f59e0b',
                          display: 'inline-block'
                        }} />
                        {vehicle.driver_status === 'Verified' ? 'Verified' : 'Unverified'}
                      </span>
                    )}
                  </div>
                </div>

                {/* Driver Info section in a custom block */}
                <div style={{
                  background: 'var(--bg-inset, #f8fafc)',
                  padding: '16px',
                  borderRadius: '16px',
                  border: '1px solid var(--border-color, #e2e8f0)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assigned Driver</span>
                    <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary, #1e293b)' }}>
                      {vehicle.profiles?.full_name || 'None'}
                    </span>
                  </div>

                  {vehicle.profiles && (
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', borderTop: '1px solid var(--border-color, rgba(0,0,0,0.06))', paddingTop: '10px' }}>
                      <div>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Email</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary, #64748b)', wordBreak: 'break-all' }}>{vehicle.profiles.email || 'N/A'}</span>
                      </div>
                      <div>
                        <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phone</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-secondary, #64748b)' }}>{vehicle.profiles.phone || 'N/A'}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Location and Metadata Section */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--bg-inset, #f8fafc)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Location</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary, #1e293b)' }}>{vehicle.location || 'N/A'}</span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>License Plate</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary, #1e293b)' }}>
                      {vehicle.license_number || 'N/A'}
                    </span>
                  </div>
                </div>

                {/* Verify Button for Sellers */}
                {vehicle.driver_id && vehicle.driver_status !== 'Verified' && (
                  <button
                    onClick={() => handleVerifyDriver(vehicle.driver_id)}
                    style={{
                      width: '100%',
                      padding: '12px',
                      background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '12px',
                      fontWeight: 800,
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      boxShadow: '0 4px 12px rgba(249,115,22,0.2)',
                      transition: 'all 0.2s',
                      textAlign: 'center'
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = 'translateY(-1px)'}
                    onMouseLeave={e => e.currentTarget.style.transform = 'translateY(0)'}
                  >
                    Verify Driver Details
                  </button>
                )}
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
            maxWidth: '640px', padding: '32px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
            border: '1px solid var(--border-color, #e2e8f0)',
            position: 'relative',
            maxHeight: '90vh',
            overflowY: 'auto'
          }}>
            <h3 style={{ margin: '0 0 4px 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Add New Fleet & Driver</h3>
            <p style={{ margin: '0 0 20px 0', fontSize: '0.85rem', color: '#64748b' }}>
              Create a new driver credentials login and assign their vehicle details. The driver will be automatically verified.
            </p>

            {addError && (
              <div style={{
                padding: '12px 16px', background: '#fee2e2', color: '#ef4444',
                borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                marginBottom: '16px', border: '1px solid #fecaca'
              }}>
                ✗ {addError}
              </div>
            )}

            <form onSubmit={handleAddFleetSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                {/* Left Column: Driver Info */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Driver Credentials</h4>
                  
                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Full Name</label>
                    <input type="text" required value={driverName} onChange={e => setDriverName(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Driver Name" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Email</label>
                    <input type="email" required value={driverEmail} onChange={e => setDriverEmail(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="driver@email.com" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Password</label>
                    <input type="password" required value={driverPassword} onChange={e => setDriverPassword(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="Minimum 6 characters" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Phone Number</label>
                    <input type="text" required value={driverPhone} onChange={e => setDriverPhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="9876543210" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>License Number</label>
                    <input type="text" required value={driverLicense} onChange={e => setDriverLicense(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="KA0120200000000" />
                  </div>
                </div>

                {/* Right Column: Vehicle & Status */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <h4 style={{ margin: '0 0 4px 0', fontSize: '0.9rem', fontWeight: 800, color: '#f97316', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Vehicle Details</h4>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Vehicle Number</label>
                    <input type="text" required value={vehicleNumber} onChange={handleVehicleNumberChange} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="AA 00 AA 0000" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Current Location (Coordinates)</label>
                    <input type="text" value={location} onChange={handleLocationChange} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="XX.XXXX, XX.XXXX" />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '4px' }}>Status</label>
                    <select value={vehicleStatus} onChange={e => setVehicleStatus(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', outline: 'none', background: 'var(--bg-card, #ffffff)', color: 'var(--text-primary)' }}>
                      <option value="Running">Running</option>
                      <option value="Stopped">Stopped</option>
                      <option value="Maintenance">Maintenance</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '8px' }}>
                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: '10px 18px', borderRadius: '8px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer', fontWeight: 700, fontSize: '0.85rem' }}>Cancel</button>
                <button type="submit" disabled={addLoading} style={{ padding: '10px 22px', borderRadius: '8px', border: 'none', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', fontWeight: 700, fontSize: '0.85rem', cursor: 'pointer' }}>
                  {addLoading ? 'Adding...' : 'Add Fleet & Driver'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default Fleet