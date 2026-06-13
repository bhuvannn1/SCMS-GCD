import React, { useState, useEffect, useRef } from 'react';
import { Moon, Sun, Tag, Calendar, Settings, LogOut } from 'lucide-react';
import { NavLink, useNavigate } from 'react-router-dom';
import supabase from '../config/SupabaseClient';
import GoogleTranslate from './GoogleTranslate';
import { useTheme } from '../context/ThemeContext';
import useClickOutside from '../hooks/useClickOutside';

const DriverSidebar = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [profile, setProfile] = useState({ name: '', email: '', role: '', memberSince: '' });
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef();

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const email = session.user.email;
        const name = session.user.user_metadata?.full_name || '';
        const createdAt = session.user.created_at;
        const { data: profileData } = await supabase.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        setProfile({
          name: name || email.split('@')[0],
          email,
          role: profileData?.role || session.user.user_metadata?.role || 'driver',
          memberSince: createdAt ? new Date(createdAt).toLocaleDateString('en-IN', { year: 'numeric', month: 'long' }) : ''
        });
      }
    };
    fetchProfile();
  }, []);

  useClickOutside(profileRef, () => setIsProfileOpen(false));

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const navLinks = [
    { to: "/driver/hub", label: 'Driver Hub' },
    { to: "/orders", label: 'Assigned Loads' },
    { to: "/map", label: 'Tracking' },
    { to: "/driver/earnings", label: 'Earnings' }
  ];

  return (
    <>
      <header className="top-navbar">
        {/* Left: Brand Name & Hamburger */}
        <div className="top-navbar-left">
          <button
            className="hamburger-menu"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            ☰
          </button>
          <div className="top-navbar-brand">
            <h2>IGNIS</h2>
          </div>
        </div>

        {/* Center: Desktop Nav Links */}
        <nav className="top-nav-links">
          {navLinks.map((link, index) => (
            <NavLink
              key={index}
              to={link.to}
              className={({ isActive }) => "top-nav-item" + (isActive ? " active" : "")}
            >
              <span>{link.label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Right: Actions */}
        <div className="top-navbar-right">
          <GoogleTranslate />
          <button 
            onClick={toggleTheme} 
            className="theme-toggle-nav-btn" 
            title="Toggle Light/Dark Theme"
            style={{
              background: 'none',
              border: 'none',
              fontSize: '1.25rem',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '8px',
              color: 'var(--text-primary)',
              transition: 'transform 0.2s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.1)'}
            onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
          >
            {theme === 'light' ? <Moon size={20} /> : <Sun size={20} />}
          </button>

          {/* Profile Dropdown */}
          <div className="profile-menu-container" ref={profileRef} style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <button 
              onClick={() => setIsProfileOpen(!isProfileOpen)}
              className="profile-avatar-btn"
              title="View Profile Details"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                color: 'white',
                border: 'none',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                cursor: 'pointer',
                fontWeight: 'bold',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1rem',
                margin: '0 8px',
                boxShadow: '0 2px 8px rgba(249, 115, 22, 0.3)',
                transition: 'transform 0.2s'
              }}
              onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
              onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
            >
              {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
            </button>
            
            {isProfileOpen && (
              <div 
                className="profile-dropdown-card"
                style={{
                  position: 'absolute',
                  right: '8px',
                  top: '46px',
                  backgroundColor: 'var(--bg-card, #ffffff)',
                  border: '1px solid var(--border-color, rgba(249, 115, 22, 0.3))',
                  borderRadius: '12px',
                  boxShadow: 'var(--shadow-lg, 0 10px 25px rgba(0,0,0,0.1))',
                  padding: '16px',
                  minWidth: '240px',
                  zIndex: 1000,
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid var(--border-color, rgba(0,0,0,0.06))', paddingBottom: '12px', marginBottom: '4px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #f97316 0%, #fb923c 100%)',
                    color: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '1.25rem',
                    fontWeight: 'bold'
                  }}>
                    {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div style={{ overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 'bold', color: 'var(--text-primary, #1e293b)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                        {profile.name}
                      </h4>
                      <span 
                        style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: '#10b981',
                          display: 'inline-block',
                          boxShadow: '0 0 8px #10b981',
                          animation: 'pulse 1.5s infinite'
                        }}
                        title="Online"
                      ></span>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', wordBreak: 'break-all' }}>
                      {profile.email}
                    </span>
                  </div>
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.85rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ color: 'var(--text-secondary, #64748b)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Tag size={14} /> Role:
                    </span>
                    <span style={{ fontWeight: 'bold', color: 'var(--text-primary, #1e293b)' }}>
                      {profile.role ? (profile.role.charAt(0).toUpperCase() + profile.role.slice(1)) : 'Driver'}
                    </span>
                  </div>
                  {profile.memberSince && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ color: 'var(--text-secondary, #64748b)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Calendar size={14} /> Joined:
                      </span>
                      <span style={{ color: 'var(--text-primary, #1e293b)', fontSize: '0.8rem' }}>{profile.memberSince}</span>
                    </div>
                  )}
                </div>

                <div style={{ borderTop: '1px solid var(--border-color, rgba(0,0,0,0.06))', paddingTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <button 
                    onClick={() => { setIsProfileOpen(false); navigate('/settings'); }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      background: 'none',
                      border: 'none',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-bg, rgba(249, 115, 22, 0.1))'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <Settings size={14} /> Settings
                  </button>
                  
                  <button 
                    onClick={handleLogout}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      width: '100%',
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: 'none',
                      padding: '8px 10px',
                      borderRadius: '6px',
                      color: '#ef4444',
                      fontSize: '0.85rem',
                      fontWeight: 'bold',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'background 0.2s, color 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = '#ef4444'; e.currentTarget.style.color = '#ffffff'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#ef4444'; }}
                  >
                    <LogOut size={14} /> Log Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Mobile Drawer Overlay */}
      <div
        className={`mobile-drawer-overlay ${isMobileMenuOpen ? 'open' : ''}`}
        onClick={() => setIsMobileMenuOpen(false)}
      ></div>

      {/* Mobile Drawer */}
      <nav className={`mobile-drawer ${isMobileMenuOpen ? 'open' : ''}`}>
        {navLinks.map((link, index) => (
          <NavLink
            key={index}
            to={link.to}
            onClick={() => setIsMobileMenuOpen(false)}
            className={({ isActive }) => "top-nav-item" + (isActive ? " active" : "")}
          >
            <span>{link.label}</span>
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          style={{
            margin: 'auto 24px 24px 24px',
            backgroundColor: '#f97316',
            color: 'white',
            border: 'none',
            padding: '12px 16px',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            marginTop: 'auto'
          }}
        >
          Logout
        </button>
      </nav>
    </>
  );
};

export default DriverSidebar;
