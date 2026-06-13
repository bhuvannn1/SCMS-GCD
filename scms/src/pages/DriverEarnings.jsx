import React, { useState } from 'react';
import supabase from '../config/SupabaseClient';

const DriverEarnings = () => {
    const [searchId, setSearchId] = useState('');
    const [earning, setEarning] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const handleSearch = async (e) => {
        e.preventDefault();
        const cleanId = searchId.trim();
        if (!cleanId) return;

        setLoading(true);
        setError(null);
        setEarning(null);

        try {
            // Search specifically in driver_earnings table using id
            const { data, error: dbError } = await supabase
                .from('driver_earnings')
                .select('*')
                .eq('id', cleanId)
                .maybeSingle();

            if (dbError) throw dbError;

            if (data) {
                setEarning(data);
            } else {
                setError('No earning record found for this ID.');
            }
        } catch (err) {
            console.error('Search error:', err);
            setError('An error occurred while fetching data. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="driver-earnings-container" style={styles.container}>
            <div className="earnings-glass-card" style={styles.glassCard}>
                <header style={styles.header}>
                    <div style={styles.iconContainer}>
                        <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <line x1="12" y1="1" x2="12" y2="23"></line>
                            <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
                        </svg>
                    </div>
                    <h1 style={styles.title}>Driver Earnings</h1>
                    <p style={styles.subtitle}>Enter your Earning ID to track and verify your payments</p>
                </header>

                <form onSubmit={handleSearch} style={styles.searchForm}>
                    <div style={styles.inputWrapper}>
                        <input 
                            type="text" 
                            placeholder="Ex: EARN-78291..." 
                            value={searchId}
                            onChange={(e) => setSearchId(e.target.value)}
                            style={styles.input}
                        />
                        <button 
                            type="submit" 
                            disabled={loading}
                            style={loading ? {...styles.button, opacity: 0.7} : styles.button}
                        >
                            {loading ? (
                                <span className="spinner" style={styles.spinner}></span>
                            ) : 'Fetch Earnings'}
                        </button>
                    </div>
                </form>

                {error && (
                    <div className="error-message" style={styles.errorBox}>
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{marginRight: '10px'}}>
                            <circle cx="12" cy="12" r="10"></circle>
                            <line x1="12" y1="8" x2="12" y2="12"></line>
                            <line x1="12" y1="16" x2="12.01" y2="16"></line>
                        </svg>
                        {error}
                    </div>
                )}

                {earning && (
                    <div className="earning-details" style={styles.resultCard}>
                        <div style={styles.statusBadge}>
                            <div style={styles.pulseDot}></div>
                            Verified Record
                        </div>

                        <div style={styles.amountSection}>
                            <span style={styles.currencyLabel}>TOTAL EARNED</span>
                            <div style={styles.amountWrapper}>
                                <span style={styles.currencySymbol}>₹</span>
                                <h2 style={styles.amountText}>
                                    {Number(earning.amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </h2>
                            </div>
                        </div>

                        <div style={styles.infoGrid}>
                            <div style={styles.infoItem}>
                                <label style={styles.infoLabel}>EARNING ID</label>
                                <span style={styles.infoValue}>{earning.id}</span>
                            </div>
                            <div style={styles.infoItem}>
                                <label style={styles.infoLabel}>DRIVER ID</label>
                                <span style={styles.infoValue}>{earning.driver_id || '---'}</span>
                            </div>
                            <div style={styles.infoItem}>
                                <label style={styles.infoLabel}>DATE</label>
                                <span style={styles.infoValue}>
                                    {earning.earned_at ? new Date(earning.earned_at).toLocaleDateString() : 'N/A'}
                                </span>
                            </div>
                            <div style={styles.infoItem}>
                                <label style={styles.infoLabel}>STATUS</label>
                                <span style={{...styles.infoValue, color: '#10b981'}}>Paid</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            <style>
                {`
                @keyframes pulse {
                    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                    70% { transform: scale(1); box-shadow: 0 0 0 10px rgba(16, 185, 129, 0); }
                    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
                }
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                @keyframes slideUp {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .earning-details {
                    animation: slideUp 0.4s ease-out forwards;
                }
                .spinner {
                    display: inline-block;
                    width: 20px;
                    height: 20px;
                    border: 3px solid rgba(255,255,255,.3);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: spin 1s ease-in-out infinite;
                }
                `}
            </style>
        </div>
    );
};

const styles = {
    container: {
        padding: '40px 20px',
        minHeight: '80vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        background: '#f8fafc',
    },
    glassCard: {
        width: '100%',
        maxWidth: '600px',
        background: '#ffffff',
        padding: '40px',
        borderRadius: '24px',
        boxShadow: '0 20px 40px rgba(0,0,0,0.06)',
        border: '1px solid #e2e8f0',
    },
    header: {
        textAlign: 'center',
        marginBottom: '32px',
    },
    iconContainer: {
        width: '64px',
        height: '64px',
        background: 'rgba(249, 115, 22, 0.1)',
        borderRadius: '16px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        margin: '0 auto 20px',
    },
    title: {
        fontSize: '2.2rem',
        fontWeight: '800',
        color: '#1e293b',
        margin: '0 0 8px 0',
        letterSpacing: '-0.025em',
    },
    subtitle: {
        color: '#64748b',
        fontSize: '1rem',
        margin: 0,
    },
    searchForm: {
        marginBottom: '32px',
    },
    inputWrapper: {
        display: 'flex',
        gap: '12px',
    },
    input: {
        flex: 1,
        padding: '16px 20px',
        borderRadius: '14px',
        border: '2px solid #e2e8f0',
        fontSize: '1rem',
        outline: 'none',
        transition: 'all 0.2s',
        color: '#1e293b',
        fontWeight: '500',
        '&:focus': {
            borderColor: '#f97316',
            boxShadow: '0 0 0 4px rgba(249, 115, 22, 0.1)',
        }
    },
    button: {
        backgroundColor: '#f97316',
        color: 'white',
        border: 'none',
        padding: '0 28px',
        borderRadius: '14px',
        fontWeight: '700',
        fontSize: '1rem',
        cursor: 'pointer',
        transition: 'all 0.2s',
        boxShadow: '0 4px 12px rgba(249, 115, 22, 0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    errorBox: {
        padding: '16px',
        background: '#fff1f2',
        color: '#e11d48',
        borderRadius: '12px',
        marginBottom: '24px',
        display: 'flex',
        alignItems: 'center',
        fontSize: '0.95rem',
        fontWeight: '500',
        border: '1px solid #ffe4e6',
    },
    resultCard: {
        background: '#f8fafc',
        borderRadius: '20px',
        padding: '32px',
        border: '1px solid #e2e8f0',
        position: 'relative',
        overflow: 'hidden',
    },
    statusBadge: {
        position: 'absolute',
        top: '20px',
        right: '20px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '0.8rem',
        fontWeight: '700',
        color: '#10b981',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
        background: 'rgba(16, 185, 129, 0.1)',
        padding: '6px 12px',
        borderRadius: '20px',
    },
    pulseDot: {
        width: '8px',
        height: '8px',
        background: '#10b981',
        borderRadius: '50%',
        animation: 'pulse 2s infinite',
    },
    amountSection: {
        textAlign: 'center',
        marginBottom: '32px',
        paddingBottom: '24px',
        borderBottom: '1px dashed #cbd5e1',
    },
    currencyLabel: {
        display: 'block',
        fontSize: '0.75rem',
        fontWeight: '800',
        color: '#94a3b8',
        marginBottom: '8px',
        letterSpacing: '0.1em',
    },
    amountWrapper: {
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: '4px',
    },
    currencySymbol: {
        fontSize: '1.8rem',
        fontWeight: '800',
        color: '#10b981',
    },
    amountText: {
        fontSize: '3.8rem',
        fontWeight: '900',
        color: '#1e293b',
        margin: 0,
        lineHeight: 1,
    },
    infoGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(2, 1fr)',
        gap: '24px',
    },
    infoItem: {
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
    },
    infoLabel: {
        fontSize: '0.7rem',
        fontWeight: '700',
        color: '#94a3b8',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
    },
    infoValue: {
        fontSize: '1rem',
        fontWeight: '600',
        color: '#334155',
        fontFamily: '"JetBrains Mono", monospace',
    },
    spinner: {
        width: '20px',
        height: '20px',
    }
};

export default DriverEarnings;

