import React, { useState, useEffect } from 'react';
import supabase from '../config/SupabaseClient';
import { useTheme } from '../context/ThemeContext';

const SettingsPage = () => {
    const { theme, toggleTheme } = useTheme();
    const [notifications, setNotifications] = useState({
        email: true,
        push: true,
        sms: false
    });
    const [profile, setProfile] = useState({ name: '', email: '', role: '' });
    const [isEditingName, setIsEditingName] = useState(false);
    const [tempName, setTempName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user) {
                const email = session.user.email;
                const name = session.user.user_metadata?.full_name || '';

                const { data: profileData } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();

                setProfile({ name, email, role: profileData?.role || session.user.user_metadata?.role || '' });
                setTempName(name);
            }
            setLoading(false);
        };
        fetchProfile();
    }, []);

    const handleSaveName = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
            await supabase.auth.updateUser({
                data: { full_name: tempName }
            });
            setProfile(prev => ({ ...prev, name: tempName }));
            setIsEditingName(false);
        }
    };

    const toggleNotification = (type) => {
        setNotifications(prev => ({
            ...prev,
            [type]: !prev[type]
        }));
    };

    const containerStyle = {
        padding: '24px',
        backgroundColor: 'transparent',
        minHeight: '100vh',
        color: 'var(--text-primary)',
        boxSizing: 'border-box'
    };

    const sectionStyle = {
        backgroundColor: 'var(--bg-card)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderRadius: '12px',
        padding: '24px',
        border: '1px solid var(--border-color)',
        marginBottom: '24px',
        boxShadow: 'var(--shadow-sm)'
    };

    const titleStyle = {
        margin: '0 0 16px 0',
        fontSize: '1.25rem',
        fontWeight: '600',
        color: '#f97316',
        textTransform: 'uppercase'
    };

    const rowStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '12px 0',
        borderBottom: '1px solid rgba(249, 115, 22, 0.2)'
    };

    const labelStyle = {
        fontWeight: '500',
        color: 'var(--text-primary)'
    };

    const toggleBtnStyle = (active) => ({
        backgroundColor: active ? '#f97316' : '#cbd5e1',
        border: 'none',
        borderRadius: '20px',
        width: '44px',
        height: '24px',
        position: 'relative',
        cursor: 'pointer',
        transition: 'background-color 0.3s ease'
    });

    const toggleCircleStyle = (active) => ({
        width: '20px',
        height: '20px',
        backgroundColor: 'white',
        borderRadius: '50%',
        position: 'absolute',
        top: '2px',
        left: active ? '22px' : '2px',
        transition: 'left 0.3s ease',
        boxShadow: '0 1px 3px rgba(0,0,0,0.2)'
    });

    return (
        <div style={containerStyle}>
            <h1 style={{ margin: '0 0 24px 0', color: 'var(--text-primary)' }}>Settings</h1>

            {/* Profile Information */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}>Profile Information</h2>
                {loading ? (
                    <p style={{ color: '#64748b' }}>Loading profile...</p>
                ) : (
                    <>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Full Name</span>
                            {isEditingName ? (
                                <div style={{ display: 'flex', gap: '8px' }}>
                                    <input
                                        type="text"
                                        value={tempName}
                                        onChange={(e) => setTempName(e.target.value)}
                                        style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', outline: 'none' }}
                                        autoFocus
                                    />
                                    <button onClick={handleSaveName} style={{ backgroundColor: '#10b981', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>Save</button>
                                    <button onClick={() => { setIsEditingName(false); setTempName(profile.name); }} style={{ backgroundColor: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer' }}>Cancel</button>
                                </div>
                            ) : (
                                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                                    <span style={{ color: '#64748b' }}>{profile.name || 'Not set'}</span>
                                    <button onClick={() => setIsEditingName(true)} style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', color: '#64748b', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.8rem' }}>Edit</button>
                                </div>
                            )}
                        </div>
                        <div style={rowStyle}>
                            <span style={labelStyle}>Email Address</span>
                            <span style={{ color: '#64748b' }}>{profile.email}</span>
                        </div>
                        <div style={{ ...rowStyle, borderBottom: 'none' }}>
                            <span style={labelStyle}>Account Role</span>
                            <span style={{ color: '#f97316', fontWeight: 'bold', textTransform: 'capitalize' }}>{profile.role || 'Unknown'}</span>
                        </div>
                    </>
                )}
            </div>

            {/* Notification Preferences */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}>Notification Preferences</h2>
                <div style={rowStyle}>
                    <span style={labelStyle}>Email Notifications</span>
                    <button style={toggleBtnStyle(notifications.email)} onClick={() => toggleNotification('email')}>
                        <div style={toggleCircleStyle(notifications.email)}></div>
                    </button>
                </div>
                <div style={rowStyle}>
                    <span style={labelStyle}>Push Notifications</span>
                    <button style={toggleBtnStyle(notifications.push)} onClick={() => toggleNotification('push')}>
                        <div style={toggleCircleStyle(notifications.push)}></div>
                    </button>
                </div>
                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                    <span style={labelStyle}>SMS Alerts</span>
                    <button style={toggleBtnStyle(notifications.sms)} onClick={() => toggleNotification('sms')}>
                        <div style={toggleCircleStyle(notifications.sms)}></div>
                    </button>
                </div>
            </div>

            {/* Appearance Settings */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}>Appearance</h2>
                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                    <span style={labelStyle}>Dark Theme</span>
                    <button style={toggleBtnStyle(theme === 'dark')} onClick={toggleTheme}>
                        <div style={toggleCircleStyle(theme === 'dark')}></div>
                    </button>
                </div>
            </div>

            {/* Security Settings */}
            <div style={sectionStyle}>
                <h2 style={titleStyle}>Security</h2>
                <div style={rowStyle}>
                    <span style={labelStyle}>Password</span>
                    <button style={{ backgroundColor: 'transparent', border: '1px solid #cbd5e1', padding: '6px 12px', borderRadius: '6px', color: '#64748b', cursor: 'pointer', fontWeight: '500' }}>
                        Change Password
                    </button>
                </div>
                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                    <span style={labelStyle}>Two-Factor Authentication</span>
                    <span style={{ color: '#10b981', fontWeight: 'bold', fontSize: '0.9rem' }}>Enabled</span>
                </div>
            </div>
        </div>
    );
};

export default SettingsPage;
