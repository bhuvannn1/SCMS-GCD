import { useEffect, useState, useRef } from "react"
import { Search, ArrowUpDown, Filter } from 'lucide-react';
import supabase from "../config/SupabaseClient"
import useClickOutside from "../hooks/useClickOutside"

const Driver = () => {
    const [fetchError, setFetchError] = useState(null)
    const [driverData, setDriverData] = useState(null)

    const [searchQuery, setSearchQuery] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')
    const [ratingFilter, setRatingFilter] = useState('all')
    const [sortBy, setSortBy] = useState('name')
    const [sortOrder, setSortOrder] = useState('asc')

    const [isFilterOpen, setIsFilterOpen] = useState(false)
    const [isSortOpen, setIsSortOpen] = useState(false)

    // Add Driver Modal State
    const [isAddModalOpen, setIsAddModalOpen] = useState(false)
    const [fullName, setFullName] = useState('')
    const [email, setEmail] = useState('')
    const [phone, setPhone] = useState('')
    const [password, setPassword] = useState('')
    const [licenseNumber, setLicenseNumber] = useState('')
    const driverStatus = 'Active'
    const [addLoading, setAddLoading] = useState(false)
    const [addError, setAddError] = useState(null)

    const filterRef = useRef(null)
    const sortRef = useRef(null)

    useClickOutside(filterRef, () => setIsFilterOpen(false))
    useClickOutside(sortRef, () => setIsSortOpen(false))

    const activeFilterCount = (statusFilter !== 'all' ? 1 : 0) + (ratingFilter !== 'all' ? 1 : 0);
    const hasActiveFilters = activeFilterCount > 0 || searchQuery !== '' || sortBy !== 'name' || sortOrder !== 'asc';

    const handleResetAll = () => {
        setSearchQuery('')
        setStatusFilter('all')
        setRatingFilter('all')
        setSortBy('name')
        setSortOrder('asc')
    };

    const fetchDrivers = async () => {
        const { data, error } = await supabase
            .from('driver')
            .select(`
                id,
                status,
                license_number,
                profiles (
                    full_name,
                    phone,
                    email
                )
            `)

        if (error) {
            setFetchError('Could not fetch drivers')
            setDriverData(null)
            console.log(error)
        }

        if (data) {
            setDriverData(data)
            setFetchError(null)
        }
    }

    useEffect(() => {
        fetchDrivers()
    }, [])

    // Extract unique statuses dynamically
    const uniqueStatuses = driverData ? Array.from(new Set(driverData.map(d => d.status).filter(Boolean))) : []

    // Filter
    const filteredDrivers = driverData ? driverData.filter(driver => {
        const q = searchQuery.toLowerCase();
        const name = driver.profiles?.full_name || '';
        const email = driver.profiles?.email || '';
        const license = driver.license_number || '';
        const matchesSearch =
            name.toLowerCase().includes(q) ||
            email.toLowerCase().includes(q) ||
            license.toLowerCase().includes(q);

        const matchesStatus = statusFilter === 'all' || driver.status === statusFilter;

        const matchesRating = ratingFilter === 'all'; // rating is omitted/mocked

        return matchesSearch && matchesStatus && matchesRating;
    }) : [];

    // Sort
    const sortedDrivers = [...filteredDrivers].sort((a, b) => {
        let valA = '';
        let valB = '';

        if (sortBy === 'name') {
            valA = a.profiles?.full_name || '';
            valB = b.profiles?.full_name || '';
        } else if (sortBy === 'license') {
            valA = a.license_number || '';
            valB = b.license_number || '';
        }

        return sortOrder === 'asc'
            ? String(valA).localeCompare(String(valB))
            : String(valB).localeCompare(String(valA));
    });

    const handleAddDriverSubmit = async (e) => {
        e.preventDefault();
        setAddLoading(true);
        setAddError(null);
        try {
            const API = process.env.REACT_APP_API_URL || "http://localhost:5000";
            const res = await fetch(`${API}/api/admin/create-user`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    email,
                    password,
                    full_name: fullName,
                    phone,
                    role: "driver",
                    license_number: licenseNumber,
                    status: driverStatus
                })
            });
            const data = await res.json();
            if (!res.ok || data.error) {
                throw new Error(data.error || "Failed to create driver");
            }
            // Reset and close
            setIsAddModalOpen(false);
            setFullName('');
            setEmail('');
            setPhone('');
            setPassword('');
            setLicenseNumber('');
            // Refresh driver list
            fetchDrivers();
        } catch (err) {
            setAddError(err.message);
        } finally {
            setAddLoading(false);
        }
    };

    return (
        <div className="page driver">
            <div className="header-actions-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', flexWrap: 'wrap', gap: '16px' }}>
                <div className="header-title-area">
                    <h2>Drivers Overview</h2>
                    <p>Manage and monitor driver statuses, ratings, and recent activity.</p>
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
                    + Add Driver
                </button>
            </div>

                <div className="search-filter-sort-wrapper">
                    {/* Search Box */}
                    <div className="search-box-container">
                        <input
                            type="text"
                            placeholder="Search drivers..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="search-input-v3"
                        />
                        <span className="search-icon-v3" style={{ display: 'flex', alignItems: 'center' }}><Search size={14} /></span>
                    </div>

                    {/* Sort Trigger Button & Popover */}
                    <div style={{ position: 'relative' }} ref={sortRef}>
                        <button
                            className={`sort-trigger-btn ${sortBy !== 'name' || sortOrder !== 'asc' ? 'active' : ''}`}
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
                                    <button className="clear-btn" onClick={() => { setSortBy('name'); setSortOrder('asc'); }}>Reset</button>
                                </div>
                                <div className="popover-body-v3">
                                    <div className="popover-field-v3">
                                        <label>Sort By</label>
                                        <select
                                            value={sortBy}
                                            onChange={(e) => setSortBy(e.target.value)}
                                            className="popover-input-v3"
                                        >
                                            <option value="name">Driver Name</option>
                                            <option value="rating">Rating</option>
                                            <option value="last_trip">Last Trip</option>
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
                                    <button className="clear-btn" onClick={() => { setStatusFilter('all'); setRatingFilter('all'); }}>Clear</button>
                                </div>
                                <div className="popover-body-v3">
                                    <div className="popover-field-v3">
                                        <label>Driver Status</label>
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
                                        <label>Minimum Rating</label>
                                        <select
                                            value={ratingFilter}
                                            onChange={(e) => setRatingFilter(e.target.value)}
                                            className="popover-input-v3"
                                        >
                                            <option value="all">Any Rating</option>
                                            <option value="4.5">4.5 & Above</option>
                                            <option value="4.0">4.0 & Above</option>
                                            <option value="3.0">3.0 & Above</option>
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

            {fetchError && <p className="error">{fetchError}</p>}

            {driverData && driverData.length === 0 && (
                <p>No drivers found! Add some drivers.</p>
            )}

            {sortedDrivers && sortedDrivers.length === 0 && driverData && driverData.length > 0 && (
                <p style={{ color: 'var(--text-secondary)', textAlign: 'center', marginTop: '20px' }}>No drivers match the search criteria.</p>
            )}

            {sortedDrivers && sortedDrivers.length > 0 && (
                <div className="driver-list">
                    {sortedDrivers.map((driver) => (
                        <div key={driver.id} className="driver-card">

                            <div className="driver-header">
                                <div className="driver-header-left">
                                    <div className="driver-icon">
                                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
                                    </div>
                                    <h3>{driver.profiles?.full_name || 'Driver'}</h3>
                                </div>
                                <span className="driver-header-badge" style={{ fontSize: '0.75rem' }}>
                                    ID: {driver.id ? `${driver.id.slice(0, 8)}...` : 'N/A'}
                                </span>
                            </div>

                            <div className="driver-details">

                                <div className="detail-item full-width">
                                    <span className="detail-label">EMAIL / PHONE</span>
                                    <span className="detail-value" style={{ textTransform: 'none' }}>
                                        {driver.profiles?.email || 'N/A'} {driver.profiles?.phone ? `| ${driver.profiles.phone}` : ''}
                                    </span>
                                </div>

                                <div className="detail-item">
                                    <span className="detail-label">LICENSE</span>
                                    <span className="detail-value">{driver.license_number || "N/A"}</span>
                                </div>

                                <div className="detail-item stat-status">
                                    <span className="detail-label">STATUS</span>
                                    <span className="detail-value">{driver.status}</span>
                                </div>

                            </div>

                        </div>
                    ))}
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
                        maxWidth: '520px', padding: '32px',
                        boxShadow: '0 24px 60px rgba(0,0,0,0.15)',
                        border: '1px solid var(--border-color, #e2e8f0)',
                        position: 'relative'
                    }}>
                        <h3 style={{ margin: '0 0 8px 0', fontSize: '1.25rem', fontWeight: 800, color: '#0f172a' }}>Add New Driver</h3>
                        <p style={{ margin: '0 0 24px 0', fontSize: '0.875rem', color: '#64748b' }}>Create a secure driver profile and system account.</p>

                        {addError && (
                            <div style={{
                                padding: '12px 16px', background: '#fee2e2', color: '#ef4444',
                                borderRadius: '12px', fontSize: '0.85rem', fontWeight: 600,
                                marginBottom: '16px', border: '1px solid #fecaca'
                            }}>
                                ✗ {addError}
                            </div>
                        )}

                        <form onSubmit={handleAddDriverSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div>
                                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Full Name</label>
                                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="John Doe" />
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Email</label>
                                    <input type="email" required value={email} onChange={e => setEmail(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="john@example.com" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Password</label>
                                    <input type="password" required value={password} onChange={e => setPassword(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="••••••••" />
                                </div>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>Phone</label>
                                    <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="+91 98765 43210" />
                                </div>
                                <div>
                                    <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', marginBottom: '6px' }}>License Number</label>
                                    <input type="text" required value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid #cbd5e1', outline: 'none' }} placeholder="DL-14201100..." />
                                </div>
                            </div>

                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '12px' }}>
                                <button type="button" onClick={() => setIsAddModalOpen(false)} style={{ padding: '12px 20px', borderRadius: '12px', border: '1px solid #cbd5e1', background: 'transparent', cursor: 'pointer', fontWeight: 700 }}>Cancel</button>
                                <button type="submit" disabled={addLoading} style={{ padding: '12px 24px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', fontWeight: 700, cursor: 'pointer' }}>
                                    {addLoading ? 'Creating...' : 'Create Driver'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}

export default Driver