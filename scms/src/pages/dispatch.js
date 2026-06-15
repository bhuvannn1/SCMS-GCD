import { useEffect, useState, useRef } from "react"
import { Search, ArrowUpDown, Filter, Star } from 'lucide-react';
import supabase from "../config/SupabaseClient"
import useClickOutside from "../hooks/useClickOutside"

const Dispatch = () => {
  const [fetchError, setFetchError] = useState(null)
  const [dispatchData, setDispatchData] = useState(null)
  const [drivers, setDrivers] = useState([])



  // Converts ASCII digits in a string to the active locale's numeral script
  const localeDigits = (str) => {
    return str;
  };

  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [sortBy, setSortBy] = useState('load_index')
  const [sortOrder, setSortOrder] = useState('asc')

  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isSortOpen, setIsSortOpen] = useState(false)

  const filterRef = useRef(null)
  const sortRef = useRef(null)

  useClickOutside(filterRef, () => setIsFilterOpen(false))
  useClickOutside(sortRef, () => setIsSortOpen(false))

  const activeFilterCount = statusFilter !== 'all' ? 1 : 0;
  const hasActiveFilters = activeFilterCount > 0 || searchQuery !== '' || sortBy !== 'load_index' || sortOrder !== 'asc';

  const handleResetAll = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setSortBy('load_index')
    setSortOrder('asc')
  };

  useEffect(() => {


    const fetchLoads = async () => {
      const { data, error } = await supabase
        .from('Load')
        .select('assigned_driver, unassigned, assigned, driver_id')

      if (error) {
        setFetchError("Could not fetch dispatch data")
        setDispatchData(null)
        console.log(error)
        return
      }


      const processedData = data.map((item) => {
        if (item.unassigned === true) {
          return { ...item, assigned: false }
        }
        if (item.assigned === true) {
          return { ...item, unassigned: false }
        }
        return item
      })

      setDispatchData(processedData)
      setFetchError(null)
    }


    const fetchDrivers = async () => {
      const { data, error } = await supabase
        .from('driver')
        .select('driver_id, name, status, rating')
        .eq('status', 'Active')

      if (error) {
        console.log("Driver fetch error:", error)
        return
      }

      console.log("Fetched available drivers:", data)
      setDrivers(data || [])
    }

    fetchLoads()
    fetchDrivers()

  }, [])

  // We need to keep indices matching the original data but filter/sort properly.
  // So we add an originalIndex property.
  const processedDispatch = dispatchData ? dispatchData.map((item, idx) => ({
    ...item,
    originalIndex: idx
  })) : [];

  // Filter
  const filteredDispatch = processedDispatch.filter(item => {
    const q = searchQuery.toLowerCase();
    const driver = item.assigned_driver || '';
    const driverId = item.driver_id || '';
    const loadIdStr = `load #${item.originalIndex + 1}`;

    const matchesSearch =
      driver.toLowerCase().includes(q) ||
      driverId.toLowerCase().includes(q) ||
      loadIdStr.includes(q);

    const matchesStatus = statusFilter === 'all' ||
      (statusFilter === 'assigned' && item.assigned) ||
      (statusFilter === 'unassigned' && item.unassigned);

    return matchesSearch && matchesStatus;
  });

  // Sort
  const sortedDispatch = [...filteredDispatch].sort((a, b) => {
    let valA = '';
    let valB = '';

    if (sortBy === 'load_index') {
      valA = a.originalIndex;
      valB = b.originalIndex;
      return sortOrder === 'asc' ? valA - valB : valB - valA;
    } else if (sortBy === 'driver') {
      valA = a.assigned_driver || '';
      valB = b.assigned_driver || '';
    } else if (sortBy === 'status') {
      valA = a.unassigned ? 'Unassigned' : 'Assigned';
      valB = b.unassigned ? 'Unassigned' : 'Assigned';
    }

    return sortOrder === 'asc'
      ? String(valA).localeCompare(String(valB))
      : String(valB).localeCompare(String(valA));
  });

  return (
    <div className="page dispatch">
      <div className="header-actions-container">
        <div className="header-title-area">
          <h2>Dispatch Control</h2>
          <p>Manage unassigned loads and assign available drivers.</p>
        </div>

        <div className="search-filter-sort-wrapper">
          {/* Search Box */}
          <div className="search-box-container">
            <input
              type="text"
              placeholder="Search dispatches..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="search-input-v3"
            />
            <span className="search-icon-v3" style={{ display: 'flex', alignItems: 'center' }}><Search size={14} /></span>
          </div>

          {/* Sort Trigger Button & Popover */}
          <div style={{ position: 'relative' }} ref={sortRef}>
            <button
              className={`sort-trigger-btn ${sortBy !== 'load_index' || sortOrder !== 'asc' ? 'active' : ''}`}
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
                  <button className="clear-btn" onClick={() => { setSortBy('load_index'); setSortOrder('asc'); }}>Reset</button>
                </div>
                <div className="popover-body-v3">
                  <div className="popover-field-v3">
                    <label>Sort By</label>
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="popover-input-v3"
                    >
                      <option value="load_index">Load Number</option>
                      <option value="driver">Driver Name</option>
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
                  <button className="clear-btn" onClick={() => { setStatusFilter('all'); }}>Clear</button>
                </div>
                <div className="popover-body-v3">
                  <div className="popover-field-v3">
                    <label>Dispatch Status</label>
                    <select
                      value={statusFilter}
                      onChange={(e) => setStatusFilter(e.target.value)}
                      className="popover-input-v3"
                    >
                      <option value="all">All Statuses</option>
                      <option value="assigned">Assigned</option>
                      <option value="unassigned">Unassigned</option>
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
      </div>

      {fetchError && <p className="error">{fetchError}</p>}

      {dispatchData && dispatchData.length === 0 && (
        <p>No dispatch data available</p>
      )}

      {sortedDispatch && sortedDispatch.length === 0 && dispatchData && dispatchData.length > 0 && (
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No dispatches match the search criteria.</p>
      )}

      {sortedDispatch && sortedDispatch.length > 0 && (
        <div className="dispatch-list">
          {sortedDispatch.map((item) => {
            const index = item.originalIndex;
            const isAssigned = item.assigned;
            const leftBarBg = isAssigned
              ? 'linear-gradient(180deg, #10b981, #059669)'
              : 'linear-gradient(180deg, #ef4444, #dc2626)';

            return (
              <div key={index} className="dispatch-card" style={{
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
                    {/* Peach Clipboard Icon container */}
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
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1" ry="1"></rect></svg>
                    </div>
                    <div>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>DISPATCH REF</div>
                      <div style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)' }}>
                        Load #{index + 1}
                      </div>
                    </div>
                  </div>

                  {/* Status Badge */}
                  <span style={{
                    background: isAssigned ? 'rgba(16,185,129,0.08)' : 'rgba(239, 68, 68, 0.08)',
                    color: isAssigned ? '#10b981' : '#ef4444',
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
                      background: isAssigned ? '#10b981' : '#ef4444',
                      display: 'inline-block'
                    }} />
                    {isAssigned ? 'Assigned' : 'Unassigned'}
                  </span>
                </div>

                {/* Details Section */}
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
                      {item.assigned_driver || "None"}
                    </span>
                  </div>
                </div>

                {/* Metadata block */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', background: 'var(--bg-inset, #f8fafc)', padding: '16px', borderRadius: '16px', border: '1px solid var(--border-color, #e2e8f0)' }}>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Driver ID</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary, #1e293b)', fontFamily: 'monospace' }}>
                      {localeDigits(item.driver_id) || "Not linked"}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.62rem', fontWeight: 800, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dispatch Status</span>
                    <span style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-primary, #1e293b)' }}>
                      {item.unassigned ? "Unassigned" : item.assigned ? "Assigned" : "Unknown"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Show available drivers */}
      <div className="drivers-section" style={{ marginTop: '40px', background: 'white', padding: '24px', borderRadius: '20px', boxShadow: '0 10px 30px rgba(0,0,0,0.04)', border: '1px solid rgba(226, 232, 240, 0.8)' }}>
        <h3 style={{ margin: '0 0 16px 0', color: '#0f172a', fontSize: '1.25rem' }}>Available Drivers</h3>
        {drivers.length === 0 ? (
          <p style={{ color: '#64748b' }}>No drivers found</p>
        ) : (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {drivers.map((driver) => (
              <div key={driver.driver_id} style={{
                background: '#f8fafc',
                padding: '12px 20px',
                borderRadius: '16px',
                border: '1px solid #e2e8f0',
                display: 'flex',
                flexDirection: 'column',
                gap: '4px'
              }}>
                <span style={{ fontWeight: '700', color: '#0f172a', fontSize: '1rem' }}>{driver.name}</span>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: '#10b981', fontSize: '0.75rem', fontWeight: '800', textTransform: 'uppercase' }}>{driver.status}</span>
                  <span style={{ color: '#64748b', fontSize: '0.75rem' }}>•</span>
                  <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 'bold', display: 'inline-flex', alignItems: 'center', gap: '2px' }}><Star size={10} fill="#f59e0b" stroke="#f59e0b" /> {driver.rating || "N/A"}</span>
                </div>
                <span style={{ color: '#94a3b8', fontSize: '0.7rem', fontFamily: 'monospace' }}>ID: {localeDigits(driver.driver_id)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

    </div>
  )
}

export default Dispatch