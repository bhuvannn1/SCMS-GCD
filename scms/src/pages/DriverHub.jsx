import React, { useState, useEffect, useCallback, useRef } from 'react';
import { UserCheck, Truck, Coffee, IndianRupee, CheckCircle, BarChart3, MapPin, Navigation, Clock, Camera, Leaf, Loader2, X, Compass, Shield, AlertTriangle, Flag, Ban, XCircle, Check } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Polyline } from 'react-leaflet';
import L from 'leaflet';
import supabase from '../config/SupabaseClient';

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

// Custom pin markers for start/end points
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

// Active truck marker for driver position
const activeTruckIcon = new L.divIcon({
  className: 'driver-truck-marker',
  html: `
    <div style="
      background-color: #fff;
      border: 2px solid #3b82f6;
      border-radius: 50%;
      width: 38px;
      height: 38px;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 12px rgba(59,130,246,0.3);
    ">
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1" y="3" width="15" height="13"></rect>
        <polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon>
        <circle cx="5.5" cy="18.5" r="2.5"></circle>
        <circle cx="18.5" cy="18.5" r="2.5"></circle>
      </svg>
    </div>
  `,
  iconSize: [38, 38],
  iconAnchor: [19, 19],
  popupAnchor: [0, -19]
});

// ─── Helpers ─────────────────────────────────────────────────────────────────
const fmt = (n) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 });

// ─── Mini Bar Chart ───────────────────────────────────────────────────────────
const BarChart = ({ data, label }) => {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: '6px', height: '100px', padding: '0 4px' }}>
        {data.map((d, i) => (
          <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-secondary,#64748b)', fontWeight: 600 }}>
              {d.value > 0 ? `₹${(d.value / 1000).toFixed(1)}k` : ''}
            </span>
            <div
              title={`${d.label}: ₹${fmt(d.value)}`}
              style={{
                width: '100%',
                height: `${Math.max((d.value / max) * 80, d.value > 0 ? 8 : 2)}px`,
                background: d.value > 0
                  ? 'linear-gradient(180deg,#f97316 0%,#ea580c 100%)'
                  : 'var(--border-color,#e2e8f0)',
                borderRadius: '6px 6px 0 0',
                transition: 'height 0.5s ease',
                cursor: 'default',
              }}
            />
            <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary,#64748b)', fontWeight: 600, textAlign: 'center' }}>
              {d.label}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Circular Performance Score ───────────────────────────────────────────────
const ScoreGauge = ({ score }) => {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const dash = circ * (score / 100);
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const label = score >= 80 ? 'Excellent' : score >= 60 ? 'Good' : 'Needs Work';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
      <div style={{ position: 'relative', width: '110px', height: '110px' }}>
        <svg width="110" height="110" style={{ transform: 'rotate(-90deg)' }}>
          <circle cx="55" cy="55" r={r} fill="none" stroke="var(--border-color,#e2e8f0)" strokeWidth="10" />
          <circle
            cx="55" cy="55" r={r} fill="none"
            stroke={color} strokeWidth="10"
            strokeDasharray={`${dash} ${circ}`}
            strokeLinecap="round"
            style={{ transition: 'stroke-dasharray 1s ease' }}
          />
        </svg>
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{ fontSize: '1.5rem', fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary,#64748b)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>/100</span>
        </div>
      </div>
      <span style={{ fontSize: '0.78rem', fontWeight: 700, color }}>{label}</span>
    </div>
  );
};

// ─── Status pill colors ───────────────────────────────────────────────────────
const STATUS_CONFIG = {
  available: { color: '#10b981', bg: 'rgba(16,185,129,0.12)', label: 'Available', icon: UserCheck, next: 'on_trip' },
  on_trip: { color: '#f97316', bg: 'rgba(249,115,22,0.12)', label: 'On Trip', icon: Truck, next: 'on_break' },
  on_break: { color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'On Break', icon: Coffee, next: 'available' },
};

// ─── Section Card wrapper ─────────────────────────────────────────────────────
const Card = ({ title, subtitle, children, style = {} }) => (
  <div style={{
    background: 'var(--bg-card,#fff)',
    border: '1px solid var(--border-color,#e2e8f0)',
    borderRadius: '18px',
    padding: '22px 24px',
    boxShadow: 'var(--shadow-md,0 2px 8px rgba(0,0,0,0.05))',
    ...style,
  }}>
    {title && (
      <div style={{ marginBottom: '16px' }}>
        <h3 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary,#1e293b)' }}>{title}</h3>
        {subtitle && <p style={{ margin: '3px 0 0', fontSize: '0.78rem', color: 'var(--text-secondary,#64748b)' }}>{subtitle}</p>}
      </div>
    )}
    {children}
  </div>
);

// ─── Main Component ───────────────────────────────────────────────────────────
const DriverHub = () => {
  const [user, setUser] = useState(null);

  // Profile status & completeness state
  const [profileComplete, setProfileComplete] = useState(true);
  const [profileLoading, setProfileLoading] = useState(true);

  // Driver/Fleet form state
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [licenseNumber, setLicenseNumber] = useState('');
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [vehicleLocation, setVehicleLocation] = useState('');
  
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
    setVehicleLocation(formatCoordinateString(e.target.value));
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

  const [vehicleActive, setVehicleActive] = useState(true);
  const [verificationStatus, setVerificationStatus] = useState('Unverified');

  // earnings search (legacy)
  const [searchId, setSearchId] = useState('');
  const [earning, setEarning] = useState(null);
  const [earningsLoading, setEarningsLoading] = useState(false);
  const [earningsError, setEarningsError] = useState(null);

  // all earnings for this driver
  const [allEarnings, setAllEarnings] = useState([]);
  const [earningsPeriod, setEarningsPeriod] = useState('weekly'); // weekly | monthly

  // trips
  const [trips, setTrips] = useState([]);
  const [tripsLoading, setTripsLoading] = useState(true);

  // status
  const [status, setStatus] = useState('available');
  const [statusLoading, setStatusLoading] = useState(false);
  // proof upload
  const [uploadingFor, setUploadingFor] = useState(null); // load_id
  const [uploadMsg, setUploadMsg] = useState({});

  // reroute notifications
  const [rerouteAlerts, setRerouteAlerts] = useState([]);
  const [dismissedAlerts, setDismissedAlerts] = useState([]);

  // Routing Modal States
  const [activeRouteTrip, setActiveRouteTrip] = useState(null);
  const [activeRouteData, setActiveRouteData] = useState(null);
  const [activeRouteLoading, setActiveRouteLoading] = useState(false);
  const [activeRouteError, setActiveRouteError] = useState(null);

  // ── Duty-Time / GPS Enforcement State ────────────────────────────────────
  // const [dutySession, setDutySession] = useState(null);       // active DB session
  const [checkpoints, setCheckpoints] = useState([]);          // route checkpoints
  const [driveMinutes, setDriveMinutes] = useState(0);         // local timer (minutes)
  const [dutyTimerActive, setDutyTimerActive] = useState(false);
  const [journeyLoadId, setJourneyLoadId] = useState(null);    // which load timer is for
  const [journeyStarting, setJourneyStarting] = useState(null); // load_id being started
  const [checkingIn, setCheckingIn] = useState(null);          // checkpoint_id being checked in
  const [breachModalOpen, setBreachModalOpen] = useState(false);
  const [gpsCoords, setGpsCoords] = useState(null);            // { lat, lng }
  const [gpsError, setGpsError] = useState(null);
  const dutyTimerRef = useRef(null);
  const gpsWatchRef = useRef(null);
  const driveMinutesRef = useRef(0);                           // ref for use inside intervals

  const handleOpenRoute = async (trip) => {
    setActiveRouteTrip(trip);
    setActiveRouteLoading(true);
    setActiveRouteError(null);
    setActiveRouteData(null);
    try {
      const response = await fetch(`${API}/api/route/optimize?pickup=${encodeURIComponent(trip.pickup)}&drop=${encodeURIComponent(trip.drop)}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Failed to calculate route");
      }
      setActiveRouteData(data);
    } catch (err) {
      setActiveRouteError(err.message);
    } finally {
      setActiveRouteLoading(false);
    }
  };

  const getParsedVehicleCoords = () => {
    if (!vehicleLocation) return null;
    const parts = vehicleLocation.split(',');
    if (parts.length === 2) {
      const lat = parseFloat(parts[0].trim());
      const lng = parseFloat(parts[1].trim());
      if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
        return [lat, lng];
      }
    }
    return null;
  };

  // ── Duty helpers ──────────────────────────────────────────────────────────
  const fmtDutyTime = (mins) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${String(m).padStart(2, '0')}m`;
  };

  const dutyColor = (mins) => {
    if (mins >= 480) return '#ef4444';
    if (mins >= 360) return '#f59e0b';
    return '#10b981';
  };

  const dutyLabel = (mins) => {
    if (mins >= 480) return <span style={{display:'flex', alignItems:'center', gap:'4px'}}><Ban size={14}/> REST REQUIRED</span>;
    if (mins >= 360) return <span style={{display:'flex', alignItems:'center', gap:'4px'}}><AlertTriangle size={14}/> Approaching Limit</span>;
    return <span style={{display:'flex', alignItems:'center', gap:'4px'}}><CheckCircle size={14}/> Under Limit</span>;
  };

  // Fetch or restore duty status for today
  const fetchDutyStatus = useCallback(async (driverId, loadId) => {
    try {
      const params = new URLSearchParams({ driver_id: driverId });
      if (loadId) params.append('load_id', loadId);
      const res = await fetch(`${API}/api/driver/duty-status?${params}`);
      const data = await res.json();
      if (data.session) {
        const saved = data.session.total_drive_minutes || 0;
        setDriveMinutes(saved);
        driveMinutesRef.current = saved;
        setJourneyLoadId(data.session.load_id);
        if (data.session.status === 'active') {
          setDutyTimerActive(true);
        }
      }
      if (data.checkpoints?.length > 0) {
        setCheckpoints(data.checkpoints);
      }
    } catch (e) {
      console.warn('fetchDutyStatus failed:', e.message);
    }
  }, []);

  // Start journey: POST to backend, then start local timer
  const handleStartJourney = async (trip) => {
    if (!user) return;
    if (driveMinutesRef.current >= 480) {
      setBreachModalOpen(true);
      // Log breach
      await fetch(`${API}/api/driver/report-breach`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: user.id,
          load_id: trip.load_id,
          seller_id: trip.seller_id || null,
          drive_minutes_at_breach: driveMinutesRef.current,
          gps_lat: gpsCoords?.lat || null,
          gps_lng: gpsCoords?.lng || null,
        })
      }).catch(() => {});
      return;
    }
    setJourneyStarting(trip.load_id);
    try {
      const res = await fetch(`${API}/api/driver/start-journey`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          driver_id: user.id,
          load_id: trip.load_id,
          pickup: trip.pickup,
          drop: trip.drop,
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setJourneyLoadId(trip.load_id);
      setCheckpoints(data.checkpoints || []);
      setDutyTimerActive(true);
    } catch (err) {
      alert('Error starting journey: ' + err.message);
    } finally {
      setJourneyStarting(null);
    }
  };

  // Check in at a checkpoint
  const handleCheckIn = async (cpId) => {
    setCheckingIn(cpId);
    try {
      await fetch(`${API}/api/driver/checkin-checkpoint`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ checkpoint_id: cpId })
      });
      setCheckpoints(prev => prev.map(cp =>
        cp.id === cpId ? { ...cp, reached_at: new Date().toISOString() } : cp
      ));
    } catch (err) {
      alert('Check-in failed: ' + err.message);
    } finally {
      setCheckingIn(null);
    }
  };

  // ── Init ──────────────────────────────────────────────────────────────────
  const fetchDriverState = useCallback(async (sessionUser) => {
    // 1. Fetch profiles
    const { data: profileRow } = await supabase
      .from('profiles')
      .select('full_name, phone')
      .eq('id', sessionUser.id)
      .maybeSingle();

    // 2. Fetch driver metadata
    const { data: driverRow } = await supabase
      .from('driver')
      .select('license_number, status, verified')
      .eq('id', sessionUser.id)
      .maybeSingle();

    // 3. Fetch fleet vehicle details
    const { data: fleetRow } = await supabase
      .from('Fleet')
      .select('id, vehicle_number, location, status')
      .eq('driver_id', sessionUser.id)
      .maybeSingle();

    const localStatus = localStorage.getItem(`driver_status_${sessionUser.id}`) || 'available';
    setStatus(localStatus);

    const isComplete = !!(profileRow?.full_name && profileRow?.phone && driverRow?.license_number && fleetRow?.vehicle_number);
    setProfileComplete(isComplete);

    setFullName(profileRow?.full_name || '');
    setPhone(profileRow?.phone || '');
    setLicenseNumber(driverRow?.license_number || '');
    setVerificationStatus(driverRow?.verified ? 'Verified' : 'Unverified');

    setVehicleNumber(formatVehicleNumber(fleetRow?.vehicle_number || ''));
    setVehicleLocation(formatCoordinateString(fleetRow?.location || ''));
    setVehicleActive(fleetRow ? (fleetRow.status === 'Active' || fleetRow.status === 'Running') : true);
    setProfileLoading(false);
  }, []);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) return;
      setUser(session.user);

      // Load dismissed alert IDs from localStorage
      const savedDismissed = JSON.parse(localStorage.getItem(`dismissed_reroutes_${session.user.id}`) || '[]');
      setDismissedAlerts(savedDismissed);

      await fetchDriverState(session.user);

      // Fetch trips (Load table where driver_id matches)
      const { data: loads } = await supabase
        .from('Load')
        .select('*')
        .eq('driver_id', session.user.id);
      setTrips(loads || []);
      setTripsLoading(false);

      // Fetch all earnings for this driver
      const { data: earns } = await supabase
        .from('driver_earnings')
        .select('*')
        .eq('driver_id', session.user.id)
        .order('earned_at', { ascending: false });
      setAllEarnings(earns || []);

      // Fetch warehouse lookup map
      const { data: whData } = await supabase
        .from('warehouses')
        .select('id, name');
      const whMap = {};
      if (whData) {
        whData.forEach(w => {
          whMap[w.id] = w.name;
        });
      }

      // Fetch fleet row id to query reroutes
      const { data: fleetRow } = await supabase
        .from('Fleet')
        .select('id')
        .eq('driver_id', session.user.id)
        .maybeSingle();

      if (fleetRow?.id) {
        const { data: reroutes } = await supabase
          .from('truck_reroutes')
          .select('id, reason, triggered_at, from_warehouse_id, to_warehouse_id')
          .eq('fleet_id', fleetRow.id)
          .order('triggered_at', { ascending: false })
          .limit(5);

        const mappedReroutes = (reroutes || []).map(r => ({
          ...r,
          from_warehouse_name: whMap[r.from_warehouse_id] || 'Previous Warehouse',
          to_warehouse_name: whMap[r.to_warehouse_id] || 'New Warehouse'
        }));
        setRerouteAlerts(mappedReroutes);
      }
    };
    init();
  }, [fetchDriverState]);

  // ── GPS watchPosition effect ───────────────────────────────────────────────
  useEffect(() => {
    if (!user) return;
    if (!navigator.geolocation) {
      setGpsError('GPS not available on this device');
      return;
    }
    let lastUpdateTime = 0;
    const GPS_UPDATE_INTERVAL_MS = 30000; // update Fleet table every 30s

    gpsWatchRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setGpsCoords({ lat, lng });
        setGpsError(null);
        // Update vehicleLocation display string
        setVehicleLocation(`${lat.toFixed(6)}, ${lng.toFixed(6)}`);

        // Throttle DB updates to every 30 seconds
        const now = Date.now();
        if (now - lastUpdateTime > GPS_UPDATE_INTERVAL_MS) {
          lastUpdateTime = now;
          try {
            await supabase
              .from('Fleet')
              .update({ location: `${lat.toFixed(6)}, ${lng.toFixed(6)}` })
              .eq('driver_id', user.id);
          } catch (e) { /* silent */ }

          // Breach check: if duty timer active and over 480m, driver is moving illegally
          if (dutyTimerActive && driveMinutesRef.current >= 480) {
            setBreachModalOpen(true);
            // Auto-report breach
            fetch(`${API}/api/driver/report-breach`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                driver_id: user.id,
                load_id: journeyLoadId,
                drive_minutes_at_breach: driveMinutesRef.current,
                gps_lat: lat,
                gps_lng: lng,
              })
            }).catch(() => {});
          }
        }
      },
      (err) => setGpsError('GPS error: ' + err.message),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 10000 }
    );

    return () => {
      if (gpsWatchRef.current !== null) {
        navigator.geolocation.clearWatch(gpsWatchRef.current);
      }
    };
  }, [user, dutyTimerActive, journeyLoadId]);

  // ── Duty Timer effect ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!dutyTimerActive || !user) return;
    // Increment drive minutes every 60 seconds
    dutyTimerRef.current = setInterval(() => {
      setDriveMinutes(prev => {
        const next = prev + 1;
        driveMinutesRef.current = next;
        // Every 5 minutes sync to backend
        if (next % 5 === 0) {
          fetch(`${API}/api/driver/update-drive-time`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              driver_id: user.id,
              load_id: journeyLoadId,
              total_drive_minutes: next
            })
          }).catch(() => {});
        }
        // Stop timer at 480 minutes (8h)
        if (next >= 480) {
          clearInterval(dutyTimerRef.current);
          setDutyTimerActive(false);
        }
        return next;
      });
    }, 60000); // every 60 seconds = 1 drive minute

    return () => clearInterval(dutyTimerRef.current);
  }, [dutyTimerActive, user, journeyLoadId]);

  // ── Restore duty session on mount ────────────────────────────────────────
  useEffect(() => {
    if (user) {
      fetchDutyStatus(user.id, null);
    }
  }, [user, fetchDutyStatus]);

  // ── Earnings chart data ───────────────────────────────────────────────────
  const buildChartData = () => {
    const now = new Date();
    if (earningsPeriod === 'weekly') {
      // Last 7 days
      return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(now);
        d.setDate(now.getDate() - (6 - i));
        const dayStr = d.toLocaleDateString('en-IN', { weekday: 'short' });
        const value = allEarnings
          .filter(e => {
            const ed = new Date(e.earned_at);
            return ed.toDateString() === d.toDateString();
          })
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);
        return { label: dayStr, value };
      });
    } else {
      // Last 6 months
      return Array.from({ length: 6 }, (_, i) => {
        const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
        const label = d.toLocaleDateString('en-IN', { month: 'short' });
        const value = allEarnings
          .filter(e => {
            const ed = new Date(e.earned_at);
            return ed.getMonth() === d.getMonth() && ed.getFullYear() === d.getFullYear();
          })
          .reduce((sum, e) => sum + Number(e.amount || 0), 0);
        return { label, value };
      });
    }
  };

  const chartData = buildChartData();
  const activeAlerts = rerouteAlerts.filter(a => !dismissedAlerts.includes(a.id));

  // ── Stats ─────────────────────────────────────────────────────────────────
  const totalEarned = allEarnings.reduce((s, e) => s + Number(e.amount || 0), 0);
  const completedTrips = trips.filter(t => ['delivered', 'completed', 'Confirmed'].includes(t.status)).length;
  const totalTrips = trips.length;

  // Performance score: blend of completion rate + earnings (capped at 100)
  const completionRate = totalTrips > 0 ? (completedTrips / totalTrips) * 100 : 0;
  const earningsScore = Math.min((totalEarned / 50000) * 40, 40); // max 40 pts for ₹50k+
  const performanceScore = Math.min(Math.round(completionRate * 0.6 + earningsScore), 100);

  // ── Status toggle ─────────────────────────────────────────────────────────
  const handleStatusToggle = async () => {
    if (!user || statusLoading) return;
    const nextStatus = STATUS_CONFIG[status].next;
    setStatusLoading(true);
    setStatus(nextStatus);

    const nextActive = nextStatus !== 'on_break';
    const nextVehicleStatus = nextActive ? 'Active' : 'Inactive';

    try {
      const response = await fetch(`${API}/api/driver/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          status: nextVehicleStatus
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to update status');
      }

      localStorage.setItem(`driver_status_${user.id}`, nextStatus);
      setVehicleActive(nextActive);
    } catch (err) {
      console.error(err);
      alert("Error changing status: " + err.message);
    } finally {
      setStatusLoading(false);
    }
  };

  // ── Onboarding submit ─────────────────────────────────────────────────────
  const handleOnboardingSubmit = async (e) => {
    e.preventDefault();
    setProfileLoading(true);
    try {
      const response = await fetch(`${API}/api/driver/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          fullName,
          phone,
          licenseNumber,
          vehicleNumber,
          location: vehicleLocation,
          status: vehicleActive ? 'Active' : 'Inactive',
          driverStatus: status || 'available'
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to onboard driver');
      }

      setProfileComplete(true);
      setVerificationStatus('Unverified');
      await fetchDriverState(user);
    } catch (err) {
      alert("Error saving details: " + err.message);
    } finally {
      setProfileLoading(false);
    }
  };

  // ── Profile update submit ─────────────────────────────────────────────────
  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    setStatusLoading(true);
    try {
      const response = await fetch(`${API}/api/driver/onboard`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: user.id,
          phone,
          licenseNumber,
          vehicleNumber,
          location: vehicleLocation,
          status: vehicleActive ? 'Active' : 'Inactive'
        }),
      });

      const resData = await response.json();
      if (!response.ok) {
        throw new Error(resData.error || 'Failed to update profile');
      }

      alert("Driver profile and Fleet details updated successfully!");
      await fetchDriverState(user);
    } catch (err) {
      alert("Error updating details: " + err.message);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDismissAlert = (alertId) => {
    if (!user) return;
    const updated = [...dismissedAlerts, alertId];
    setDismissedAlerts(updated);
    localStorage.setItem(`dismissed_reroutes_${user.id}`, JSON.stringify(updated));
  };

  // ── Earnings search ───────────────────────────────────────────────────────
  const handleSearch = async (e) => {
    e.preventDefault();
    const cleanId = searchId.trim();
    if (!cleanId) return;
    setEarningsLoading(true);
    setEarningsError(null);
    setEarning(null);
    try {
      const { data, error: dbError } = await supabase
        .from('driver_earnings')
        .select('*')
        .eq('earning_id', cleanId)
        .maybeSingle();
      if (dbError) throw dbError;
      if (data) setEarning(data);
      else setEarningsError('No earning record found for this ID.');
    } catch (err) {
      setEarningsError('An error occurred while fetching data.');
    } finally {
      setEarningsLoading(false);
    }
  };

  // ── Proof upload ──────────────────────────────────────────────────────────
  const handleProofUpload = async (loadId, file) => {
    if (!file || !user) return;
    setUploadingFor(loadId);
    setUploadMsg(prev => ({ ...prev, [loadId]: null }));
    try {
      const ext = file.name.split('.').pop();
      const path = `delivery-proofs/${user.id}/${loadId}_${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
          .from('deliveries')
          .upload(path, file, { upsert: true });

      if (upErr) throw upErr;

      // Optionally save the proof URL to the Load record
      const { data: { publicUrl } } = supabase.storage.from('deliveries').getPublicUrl(path);
      await supabase.from('Load').update({ proof_url: publicUrl }).eq('load_id', loadId);

      setUploadMsg(prev => ({ ...prev, [loadId]: { ok: true, msg: 'Proof uploaded successfully!' } }));
    } catch (err) {
      setUploadMsg(prev => ({ ...prev, [loadId]: { ok: false, msg: 'Upload failed. Try again.' } }));
    } finally {
      setUploadingFor(null);
    }
  };

  // ── Google Maps link ──────────────────────────────────────────────────────
  const mapsLink = (pickup, drop) => {
    if (!pickup) return null;
    const origin = encodeURIComponent(pickup + ', India');
    const dest = encodeURIComponent((drop || pickup) + ', India');
    return `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}&travelmode=driving`;
  };

  const sc = STATUS_CONFIG[status] || STATUS_CONFIG.available;

  // ─────────────────────────────────────────────────────────────────────────
  if (profileLoading) {
    return (
      <div className="page" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80vh', color: 'var(--text-secondary)' }}>
        <h3>Loading Profile & Fleet details...</h3>
      </div>
    );
  }

  if (!profileComplete) {
    return (
      <div className="page" style={{ maxWidth: '600px', margin: '40px auto', animation: 'fadeIn 0.5s ease-out' }}>
        <Card title="Initialize Driver & Fleet Profile" subtitle="Please fill in your details to activate your account and start accepting loads.">
          <form onSubmit={handleOnboardingSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Driver Name</label>
                <input type="text" required value={fullName} onChange={e => setFullName(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="Your Name" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Email Address</label>
                <input type="email" readOnly value={user?.email || ''} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Phone Number</label>
                <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="+91 98765 43210" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>License Number</label>
                <input type="text" required value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="DL-14201100..." />
              </div>
            </div>

            <div style={{ borderTop: '1px dashed var(--border-color)', paddingTop: '20px', marginTop: '10px' }}>
              <h4 style={{ margin: '0 0 16px 0', fontSize: '0.85rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-primary)' }}>Vehicle Details</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Vehicle Number</label>
                  <input type="text" required value={vehicleNumber} onChange={handleVehicleNumberChange} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="AA 00 AA 0000" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '6px' }}>Current Location (Coordinates)</label>
                  <input type="text" value={vehicleLocation} onChange={handleLocationChange} style={{ width: '100%', padding: '12px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="XX.XXXX, XX.XXXX" />
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '10px' }}>
              <input type="checkbox" id="active-chk" checked={vehicleActive} onChange={e => setVehicleActive(e.target.checked)} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
              <label htmlFor="active-chk" style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>Mark vehicle as Active (Accepting Loads)</label>
            </div>

            <button type="submit" style={{ width: '100%', padding: '14px', borderRadius: '12px', border: 'none', background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)', color: 'white', fontWeight: 800, cursor: 'pointer', marginTop: '10px', boxShadow: '0 4px 14px rgba(249,115,22,0.3)', transition: 'transform 0.2s' }}>
              Save Details & Initialize Account
            </button>
          </form>
        </Card>
      </div>
    );
  }

  return (
    <div className="page" style={{ maxWidth: '1200px', margin: '0 auto' }}>

      {/* ── BREACH GUARD MODAL ────────────────────────────────────────────── */}
      {breachModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, zIndex: 9999,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          backdropFilter: 'blur(6px)',
          animation: 'fadeIn 0.2s ease-out',
        }}>
          <div style={{
            background: '#fff',
            borderRadius: '20px',
            padding: '36px 40px',
            maxWidth: '440px',
            width: '90%',
            textAlign: 'center',
            border: '3px solid #ef4444',
            boxShadow: '0 20px 60px rgba(239,68,68,0.35)',
            animation: 'slideUp 0.3s ease-out',
          }}>
            <div style={{
              width: '64px', height: '64px',
              borderRadius: '50%',
              background: 'rgba(239,68,68,0.1)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 16px',
            }}>
              <AlertTriangle size={32} style={{ color: '#ef4444' }} />
            </div>
            <h2 style={{ margin: '0 0 8px', color: '#ef4444', fontWeight: 900, fontSize: '1.3rem' }}>
              <Ban size={20} /> Driving Limit Breached!
            </h2>
            <p style={{ margin: '0 0 12px', color: '#64748b', fontSize: '0.9rem', lineHeight: 1.6 }}>
              You have exceeded the <strong>8-hour daily driving limit</strong> as per India's Motor Vehicles Act.
              Your trip has been <strong>flagged</strong> and the seller has been notified.
            </p>
            <div style={{
              background: 'rgba(239,68,68,0.08)', borderRadius: '12px',
              padding: '12px 16px', marginBottom: '20px',
              border: '1px solid rgba(239,68,68,0.2)',
            }}>
              <span style={{ fontWeight: 800, color: '#ef4444', fontSize: '1.4rem' }}>
                {fmtDutyTime(driveMinutes)}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.85rem', marginLeft: '8px' }}>/ 8h 00m limit</span>
            </div>
            <p style={{ margin: '0 0 20px', color: '#64748b', fontSize: '0.82rem' }}>
              ₹500 penalty has been logged. Please pull over and rest for 8 hours before resuming.
            </p>
            <button
              onClick={() => setBreachModalOpen(false)}
              style={{
                width: '100%', padding: '12px', borderRadius: '10px',
                border: 'none', background: '#ef4444',
                color: 'white', fontWeight: 800, fontSize: '0.95rem',
                cursor: 'pointer',
              }}
            >
              I Understand — Pull Over Now
            </button>
          </div>
        </div>
      )}

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)' }}>
            Driver Hub
          </h2>
          <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Your earnings, trips, status & delivery tools — all in one place.
          </p>
        </div>

        {/* Live Status Toggle */}
        <button
          onClick={handleStatusToggle}
          disabled={statusLoading}
          style={{
            background: sc.bg,
            color: sc.color,
            border: `2px solid ${sc.color}`,
            padding: '10px 20px',
            borderRadius: '50px',
            fontWeight: 800,
            fontSize: '0.9rem',
            cursor: 'pointer',
            transition: 'all 0.25s',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            minWidth: '160px',
            justifyContent: 'center',
          }}
          title="Click to change your status"
        >
          {sc.icon && <sc.icon size={16} />}
          <span>{sc.label}</span>
          <span style={{ fontSize: '0.7rem', opacity: 0.7, fontWeight: 600 }}>▼ tap</span>
        </button>
      </div>

      {/* ── Reroute Alerts ──────────────────────────────────────────────── */}
      {activeAlerts.map(alert => (
        <div key={alert.id} style={{
          background: 'rgba(249, 115, 22, 0.1)',
          border: '1px solid #fdba74',
          borderLeft: '5px solid #f97316',
          borderRadius: '12px',
          padding: '16px 20px',
          marginBottom: '18px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'slideUp 0.3s ease-out',
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, fontSize: '0.9rem', color: '#ea580c', marginBottom: '4px' }}>
              <AlertTriangle size={18} /> Route Updated (Order Rerouted)
            </div>
            <p style={{ margin: 0, fontSize: '0.82rem', color: 'var(--text-primary)' }}>
              Your destination has been changed from <strong>{alert.from_warehouse_name}</strong> to <strong>{alert.to_warehouse_name}</strong>.
            </p>
            {alert.reason && (
              <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                Reason: {alert.reason}
              </p>
            )}
          </div>
          <button
            onClick={() => handleDismissAlert(alert.id)}
            style={{
              background: 'none',
              border: 'none',
              color: '#f97316',
              cursor: 'pointer',
              fontWeight: 800,
              fontSize: '0.8rem',
              textDecoration: 'underline',
              padding: '6px 12px'
            }}
          >
            Acknowledge
          </button>
        </div>
      ))}

      {/* ── DUTY TIME MONITOR CARD ──────────────────────────────────────── */}
      <Card style={{ marginBottom: '18px', border: driveMinutes >= 480 ? '2px solid #ef4444' : driveMinutes >= 360 ? '2px solid #f59e0b' : '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px' }}>
          {/* Left: Title & GPS Status */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px',
              background: `rgba(${driveMinutes >= 480 ? '239,68,68' : driveMinutes >= 360 ? '245,158,11' : '16,185,129'},0.12)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Shield size={22} style={{ color: dutyColor(driveMinutes) }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>Duty Time Monitor</h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: gpsCoords ? '#10b981' : '#94a3b8', animation: gpsCoords ? 'pulse 2s infinite' : 'none' }} />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
                  {gpsCoords
                    ? `GPS Active — ${gpsCoords.lat.toFixed(4)}, ${gpsCoords.lng.toFixed(4)}`
                    : gpsError ? <><AlertTriangle size={12}/> {gpsError}</> : 'Acquiring GPS...'}
                </span>
              </div>
            </div>
          </div>

          {/* Center: Drive Time + Progress Bar */}
          <div style={{ flex: 1, minWidth: '220px', maxWidth: '400px', position: 'relative' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', letterSpacing: '0.5px' }}>Drive Time Today</span>
              <span style={{ fontWeight: 900, fontSize: '1.1rem', color: dutyColor(driveMinutes) }}>
                {fmtDutyTime(driveMinutes)} <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>/ 8h 00m</span>
              </span>
            </div>
            <div style={{ width: '100%', height: '10px', background: 'var(--bg-primary,#f1f5f9)', borderRadius: '99px', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                height: '100%',
                width: `${Math.min((driveMinutes / 480) * 100, 100)}%`,
                background: driveMinutes >= 480 ? '#ef4444' : driveMinutes >= 360
                  ? 'linear-gradient(90deg,#f59e0b,#ea580c)'
                  : 'linear-gradient(90deg,#10b981,#3b82f6)',
                borderRadius: '99px',
                transition: 'width 1s ease, background 0.5s ease',
              }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
              <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)' }}>0h</span>
              <span style={{ fontSize: '0.65rem', color: '#f59e0b' }}>6h <AlertTriangle size={10} style={{ display: 'inline' }}/></span>
              <span style={{ fontSize: '0.65rem', color: '#ef4444' }}>8h <Ban size={10} style={{ display: 'inline' }}/></span>
            </div>
          </div>

          {/* Right: Status Label + Timer Indicator */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
            <div style={{
              padding: '6px 14px', borderRadius: '20px', fontWeight: 800, fontSize: '0.82rem',
              background: `rgba(${driveMinutes >= 480 ? '239,68,68' : driveMinutes >= 360 ? '245,158,11' : '16,185,129'},0.12)`,
              color: dutyColor(driveMinutes),
              border: `1px solid ${dutyColor(driveMinutes)}40`,
            }}>
              {dutyLabel(driveMinutes)}
            </div>
            {dutyTimerActive && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#f97316', animation: 'pulse 1s infinite' }} />
                Timer Running
              </div>
            )}
            {!dutyTimerActive && driveMinutes > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>Timer paused</span>
            )}
            {checkpoints.length > 0 && (
              <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                {checkpoints.filter(c => c.reached_at).length}/{checkpoints.length} checkpoints reached
              </span>
            )}
          </div>
        </div>
      </Card>

      {/* ── Row 1: Summary Stats + Performance Score ──────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr auto', gap: '14px', marginBottom: '18px' }}>
        {[
          { label: 'Total Earned', value: `₹${fmt(totalEarned)}`, icon: <IndianRupee size={20} style={{ color: '#f97316' }} />, color: '#f97316' },
          { label: 'Total Trips', value: totalTrips, icon: <Truck size={20} style={{ color: '#6366f1' }} />, color: '#6366f1' },
          { label: 'Completed', value: completedTrips, icon: <CheckCircle size={20} style={{ color: '#10b981' }} />, color: '#10b981' },
        ].map(({ label, value, icon, color }) => (
          <Card key={label} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center' }}>{icon}</div>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</span>
            <span style={{ fontSize: '1.6rem', fontWeight: 900, color, lineHeight: 1 }}>{value}</span>
          </Card>
        ))}

        {/* Performance Score */}
        <Card style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minWidth: '130px' }}>
          <ScoreGauge score={performanceScore} />
        </Card>
      </div>

      {/* ── Row 2: Earnings Chart + Trip Log ──────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: '14px', marginBottom: '18px' }}>

        {/* Earnings Chart */}
        <Card
          title="Earnings Trend"
          subtitle="Based on your recorded earnings"
          style={{ display: 'flex', flexDirection: 'column' }}
        >
          <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
            {['weekly', 'monthly'].map(p => (
              <button
                key={p}
                onClick={() => setEarningsPeriod(p)}
                style={{
                  padding: '5px 14px',
                  borderRadius: '20px',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  cursor: 'pointer',
                  background: earningsPeriod === p ? '#f97316' : 'var(--bg-primary,#f8fafc)',
                  color: earningsPeriod === p ? 'white' : 'var(--text-secondary)',
                  transition: 'all 0.2s',
                }}
              >
                {p === 'weekly' ? '7 Days' : '6 Months'}
              </button>
            ))}
          </div>
          {allEarnings.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '20px', color: 'var(--text-secondary)', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}><BarChart3 size={32} style={{ color: 'var(--text-secondary)' }} /></div>
            <span style={{ fontSize: '0.83rem' }}>No earnings recorded yet.<br />Earnings will appear here once your earning IDs are in the system.</span>
            </div>
          ) : (
            <BarChart data={chartData} />
          )}
        </Card>

        {/* Trip Log */}
        <Card title="Trip Log" subtitle="All loads assigned to you">
          {tripsLoading ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center' }}>Loading trips...</p>
          ) : trips.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}><Truck size={32} style={{ color: 'var(--text-secondary)' }} /></div>
            <p style={{ fontSize: '0.85rem' }}>No trips assigned yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '260px', overflowY: 'auto', paddingRight: '4px' }}>
              {trips.map((trip, idx) => {
                const isPaid = trip.payment_status === 'paid';
                const mLink = mapsLink(trip.pickup, trip.drop);
                const msg = uploadMsg[trip.load_id];
                return (
                  <div key={trip.load_id || idx} style={{
                    background: 'var(--bg-primary,#f8fafc)',
                    border: '1px solid var(--border-color,#e2e8f0)',
                    borderRadius: '12px',
                    padding: '12px 14px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '6px',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>
                        {trip.customer || 'Unknown Customer'}
                      </span>
                      <span style={{
                        fontSize: '0.7rem', fontWeight: 700,
                        padding: '2px 9px', borderRadius: '20px',
                        background: isPaid ? 'rgba(16,185,129,0.12)' : 'rgba(249,115,22,0.1)',
                      }}>
                        <span style={{ fontWeight: 600, color: isPaid ? '#10b981' : '#3b82f6', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {isPaid ? <><CheckCircle size={12}/> Paid</> : trip.status || 'Active'}
                        </span>
                      </span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <MapPin size={12} /> {trip.pickup || 'N/A'} → {trip.drop || 'N/A'}
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginTop: '2px', flexWrap: 'wrap', alignItems: 'center' }}>
                      {/* Google Maps */}
                      {mLink && (
                        <a
                          href={mLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{
                            fontSize: '0.72rem', fontWeight: 700,
                            padding: '4px 10px', borderRadius: '6px',
                            background: 'rgba(99,102,241,0.1)', color: '#6366f1',
                            textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: '4px',
                            transition: 'background 0.2s',
                          }}
                          onMouseEnter={e => e.currentTarget.style.background = 'rgba(99,102,241,0.2)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'rgba(99,102,241,0.1)'}
                        >
                          <Navigation size={12} /> Navigate
                        </a>
                      )}

                      {/* Smart Route */}
                      <button
                        onClick={() => handleOpenRoute(trip)}
                        type="button"
                        style={{
                          fontSize: '0.72rem', fontWeight: 700,
                          padding: '4px 10px', borderRadius: '6px',
                          border: 'none',
                          background: 'rgba(249,115,22,0.1)', color: '#f97316',
                          display: 'inline-flex', alignItems: 'center', gap: '4px',
                          cursor: 'pointer',
                          transition: 'background 0.2s',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(249,115,22,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(249,115,22,0.1)'}
                      >
                        <Compass size={12} /> View Route
                      </button>

                      {/* Proof Upload */}
                      <label
                        htmlFor={`proof-${trip.load_id}`}
                        style={{
                          fontSize: '0.72rem', fontWeight: 700,
                          padding: '4px 10px', borderRadius: '6px',
                          background: 'rgba(16,185,129,0.1)', color: '#10b981',
                          cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px',
                          transition: 'background 0.2s',
                          opacity: uploadingFor === trip.load_id ? 0.6 : 1,
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(16,185,129,0.2)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'rgba(16,185,129,0.1)'}
                        title="Upload delivery proof (photo/PDF)"
                      >
                        {uploadingFor === trip.load_id ? (
                          <><Clock size={12} /> Uploading...</>
                        ) : (
                          <><Camera size={12} /> Upload Proof</>
                        )}
                      </label>
                      <input
                        id={`proof-${trip.load_id}`}
                        type="file"
                        accept="image/*,application/pdf"
                        style={{ display: 'none' }}
                        onChange={e => {
                          const file = e.target.files[0];
                          if (file) handleProofUpload(trip.load_id, file);
                          e.target.value = '';
                        }}
                      />

                      {/* Proof status message */}
                      {msg && (
                        <span style={{ fontSize: '0.7rem', color: msg.ok ? '#10b981' : '#ef4444', fontWeight: 600 }}>
                          {msg.ok ? <CheckCircle size={10} style={{ display: 'inline' }} /> : <AlertTriangle size={10} style={{ display: 'inline' }} />} {msg.msg}
                        </span>
                      )}

                      {/* Existing proof link */}
                      {trip.proof_url && (
                        <a href={trip.proof_url} target="_blank" rel="noopener noreferrer"
                          style={{ fontSize: '0.7rem', color: '#6366f1', fontWeight: 600 }}>
                          View Proof ↗
                        </a>
                      )}

                      {/* ── START JOURNEY Button ─────────────────────────── */}
                      {!['delivered','completed'].includes(trip.status) && (
                        <button
                          id={`start-journey-${trip.load_id}`}
                          onClick={() => handleStartJourney(trip)}
                          disabled={journeyStarting === trip.load_id || (journeyLoadId && journeyLoadId !== trip.load_id)}
                          type="button"
                          style={{
                            fontSize: '0.72rem', fontWeight: 700,
                            padding: '4px 10px', borderRadius: '6px',
                            border: 'none',
                            background: journeyLoadId === trip.load_id
                              ? 'rgba(99,102,241,0.1)'
                              : driveMinutes >= 480
                              ? 'rgba(239,68,68,0.1)'
                              : 'rgba(16,185,129,0.12)',
                            color: journeyLoadId === trip.load_id ? '#6366f1' : driveMinutes >= 480 ? '#ef4444' : '#10b981',
                            display: 'inline-flex', alignItems: 'center', gap: '4px',
                            cursor: journeyStarting === trip.load_id ? 'wait' : 'pointer',
                            opacity: (journeyLoadId && journeyLoadId !== trip.load_id) ? 0.4 : 1,
                            transition: 'all 0.2s',
                          }}
                        >
                          {journeyStarting === trip.load_id ? (
                            <><Loader2 size={11} /> Starting...</>
                          ) : journeyLoadId === trip.load_id ? (
                            <><Flag size={11} /> Journey Active</>  
                          ) : driveMinutes >= 480 ? (
                            <><AlertTriangle size={11} /> Limit Reached</>
                          ) : (
                            <><Truck size={11} /> Start Journey</>
                          )}
                        </button>
                      )}
                    </div>

                    {/* ── CHECKPOINT PANEL (shown when this is the active journey) */}
                    {journeyLoadId === trip.load_id && checkpoints.length > 0 && (
                      <div style={{
                        marginTop: '10px',
                        padding: '10px 12px',
                        background: 'rgba(99,102,241,0.04)',
                        border: '1px solid rgba(99,102,241,0.15)',
                        borderRadius: '10px',
                      }}>
                        <div style={{ fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#6366f1', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Flag size={10} /> Rest Checkpoints
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          {checkpoints.map(cp => (
                            <div key={cp.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flex: 1 }}>
                                <div style={{
                                  width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                                  background: cp.reached_at ? 'rgba(16,185,129,0.15)' : 'rgba(99,102,241,0.1)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}>
                                  {cp.reached_at
                                    ? <CheckCircle size={11} style={{ color: '#10b981' }} />
                                    : <MapPin size={11} style={{ color: '#6366f1' }} />
                                  }
                                </div>
                                <div>
                                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>{cp.label}</span>
                                  <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginLeft: '4px' }}>~{cp.approx_km} km</span>
                                </div>
                              </div>
                              {cp.reached_at ? (
                                <span style={{ fontSize: '0.65rem', color: '#10b981', fontWeight: 700 }}>
                                  <Check size={12}/> {new Date(cp.reached_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              ) : (
                                <button
                                  onClick={() => handleCheckIn(cp.id)}
                                  disabled={checkingIn === cp.id}
                                  style={{
                                    fontSize: '0.65rem', fontWeight: 700, padding: '3px 8px',
                                    borderRadius: '5px', border: 'none', cursor: 'pointer',
                                    background: '#6366f1', color: 'white',
                                    opacity: checkingIn === cp.id ? 0.6 : 1,
                                  }}
                                >
                                  {checkingIn === cp.id ? '...' : 'Check In'}
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Show checkpoint panel even when journey not started yet but checkpoints exist */}
                    {journeyLoadId !== trip.load_id && checkpoints.length > 0 && (
                      <div style={{ marginTop: '6px' }}>
                        <span style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>
                          <MapPin size={12}/> {checkpoints.filter(c => c.reached_at).length}/{checkpoints.length} rest stops reached on this route
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      {/* ── Row 3: Profile & Vehicle Details + Earnings Search ────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '14px', marginBottom: '18px' }}>
        {/* Profile & Vehicle Details */}
        <Card title="My Profile & Fleet Vehicle" subtitle="Manage your contact info, license, and active fleet tracking details.">
          <form onSubmit={handleProfileUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>Driver Name</label>
                <input type="text" readOnly value={fullName} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', background: 'rgba(0,0,0,0.05)', color: 'var(--text-secondary)', cursor: 'not-allowed' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>Verification Status</label>
                <div style={{
                  padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)',
                  background: verificationStatus === 'Verified' ? 'rgba(16,185,129,0.1)' : 'rgba(245,158,11,0.1)',
                  color: verificationStatus === 'Verified' ? '#10b981' : '#f59e0b',
                  fontWeight: 700, fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px'
                }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: verificationStatus === 'Verified' ? '#10b981' : '#f59e0b' }}></span>
                  {verificationStatus === 'Verified' ? 'Verified Driver' : 'Pending Verification'}
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>Phone Number</label>
                <input type="text" required value={phone} onChange={e => setPhone(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>License Number</label>
                <input type="text" required value={licenseNumber} onChange={e => setLicenseNumber(e.target.value)} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>Vehicle Number</label>
                <input type="text" required value={vehicleNumber} onChange={handleVehicleNumberChange} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="AA 00 AA 0000" />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '4px' }}>GPS Location</label>
                <input type="text" required value={vehicleLocation} onChange={handleLocationChange} style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', background: 'var(--bg-primary)', color: 'var(--text-primary)' }} placeholder="XX.XXXX, XX.XXXX" />
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '6px' }}>
              <input type="checkbox" id="active-edit-chk" checked={vehicleActive} onChange={e => setVehicleActive(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
              <label htmlFor="active-edit-chk" style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', cursor: 'pointer' }}>Active Status (Ready to accept loads)</label>
            </div>

            <button type="submit" disabled={statusLoading} style={{
              width: '100%', padding: '10px', borderRadius: '8px', border: 'none',
              background: 'linear-gradient(135deg, #f97316 0%, #ea580c 100%)',
              color: 'white', fontWeight: 800, fontSize: '0.85rem', cursor: 'pointer', marginTop: '4px',
              transition: 'all 0.2s', opacity: statusLoading ? 0.7 : 1
            }}>
              Update Profile & Vehicle Details
            </button>
          </form>
        </Card>

        {/* Legacy Verify Earning by ID */}
        <Card title="Verify Earning by ID" subtitle="Enter a specific earning ID to fetch its record">
          <form onSubmit={handleSearch} style={{ display: 'flex', gap: '10px', marginBottom: earningsError || earning ? '16px' : 0 }}>
            <input
              type="text"
              placeholder="Ex: EARN-78291..."
              value={searchId}
              onChange={e => setSearchId(e.target.value)}
              style={{
                flex: 1, padding: '12px 16px',
                borderRadius: '10px',
                border: '1.5px solid var(--border-color,#e2e8f0)',
                background: 'var(--bg-primary,#f8fafc)',
                color: 'var(--text-primary)',
                fontSize: '0.9rem', outline: 'none',
              }}
            />
            <button
              type="submit"
              disabled={earningsLoading}
              style={{
                padding: '12px 24px', borderRadius: '10px',
                background: 'linear-gradient(135deg,#f97316,#ea580c)',
                color: 'white', border: 'none',
                fontWeight: 700, fontSize: '0.9rem',
                cursor: earningsLoading ? 'not-allowed' : 'pointer',
                opacity: earningsLoading ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {earningsLoading ? 'Fetching...' : 'Fetch Record'}
            </button>
          </form>

          {earningsError && (
            <div style={{
              padding: '12px 16px', background: 'rgba(239,68,68,0.08)',
              color: '#ef4444', borderRadius: '10px', fontSize: '0.85rem', fontWeight: 600,
              border: '1px solid rgba(239,68,68,0.2)'
            }}>
              <XCircle size={14} style={{ display: 'inline' }}/> {earningsError}
            </div>
          )}

          {earning && (
            <div style={{
              padding: '20px', background: 'var(--bg-primary,#f8fafc)',
              borderRadius: '14px', border: '1px solid var(--border-color,#e2e8f0)',
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: '16px',
              animation: 'slideUp 0.3s ease-out',
            }}>
              <div style={{ textAlign: 'center', padding: '12px', background: 'rgba(16,185,129,0.08)', borderRadius: '12px' }}>
                <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Total Earned</div>
                <div style={{ fontSize: '1.5rem', fontWeight: 900, color: '#10b981' }}>₹{fmt(earning.amount)}</div>
              </div>
              {[
                ['Earning ID', earning.id],
                ['Driver ID', earning.driver_id || '—'],
                ['Date', earning.earned_at ? new Date(earning.earned_at).toLocaleDateString('en-IN') : 'N/A'],
                ['Status', 'Paid (Done)'],
              ].map(([lbl, val]) => (
                <div key={lbl} style={{ padding: '8px 0' }}>
                  <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>{lbl}</div>
                  <div style={{ fontSize: '0.88rem', fontWeight: 700, color: lbl === 'Status' ? '#10b981' : 'var(--text-primary)', fontFamily: lbl.includes('ID') ? 'monospace' : 'inherit' }}>{val}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Route Optimization Modal */}
      {activeRouteTrip && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(15, 23, 42, 0.65)',
          backdropFilter: 'blur(10px)',
          zIndex: 99999, display: 'flex',
          alignItems: 'center', justifyContent: 'center',
          padding: '20px', animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{
            background: 'var(--bg-card,#fff)',
            borderRadius: '24px', width: '100%',
            maxWidth: '680px', padding: '28px',
            boxShadow: '0 24px 60px rgba(0,0,0,0.2)',
            border: '1px solid var(--border-color,#e2e8f0)',
            position: 'relative', display: 'flex',
            flexDirection: 'column', gap: '20px',
            maxHeight: '90vh', overflowY: 'auto'
          }}>
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h3 style={{ margin: 0, fontWeight: 900, fontSize: '1.25rem', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Compass style={{ color: '#f97316' }} />
                  <span>Smart Route Optimization</span>
                </h3>
                <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: '#64748b' }}>
                  Trip for <strong>{activeRouteTrip.customer}</strong> (ID: {activeRouteTrip.load_id})
                </p>
              </div>
              <button
                onClick={() => { setActiveRouteTrip(null); setActiveRouteData(null); setActiveRouteError(null); }}
                style={{
                  background: 'none', border: 'none', color: '#94a3b8',
                  cursor: 'pointer', padding: '4px', borderRadius: '50%',
                  transition: 'background 0.2s', display: 'flex', alignItems: 'center'
                }}
                onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-primary,#f8fafc)'}
                onMouseLeave={e => e.currentTarget.style.background = 'none'}
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            {activeRouteLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '60px 20px' }}>
                <Loader2 className="animate-spin" size={32} style={{ color: '#f97316' }} />
                <span style={{ fontSize: '0.88rem', fontWeight: 600, color: '#64748b' }}>Calculating optimal road route...</span>
              </div>
            )}

            {activeRouteError && (
              <div style={{ padding: '16px', background: '#fee2e2', color: '#ef4444', borderRadius: '14px', fontSize: '0.85rem', fontWeight: 600 }}>
                <XCircle size={14}/> Error calculating route: {activeRouteError}
              </div>
            )}

            {activeRouteData && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', animation: 'slideUp 0.3s ease-out' }}>
                {/* Route statistics */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold' }}>DISTANCE</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f97316', marginTop: '4px' }}>{activeRouteData.optimized.distance_km.toFixed(1)} km</div>
                    <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>Save {activeRouteData.savings.distance_km.toFixed(1)} km</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold' }}>ETA</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f97316', marginTop: '4px' }}>{(activeRouteData.optimized.duration_sec / 3600).toFixed(1)} Hours</div>
                    <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>Save {(activeRouteData.savings.duration_sec / 3600).toFixed(1)} hrs</div>
                  </div>
                  <div style={{ background: '#f8fafc', padding: '12px', borderRadius: '12px', border: '1px solid #e2e8f0', textAlign: 'center' }}>
                    <div style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 'bold' }}>FUEL USED</div>
                    <div style={{ fontSize: '1rem', fontWeight: 800, color: '#f97316', marginTop: '4px' }}>{activeRouteData.optimized.fuel_liters.toFixed(1)} L</div>
                    <div style={{ fontSize: '0.6rem', color: '#10b981', fontWeight: 600 }}>Save {activeRouteData.savings.fuel_liters.toFixed(1)} L</div>
                  </div>
                </div>

                {/* Map */}
                <div style={{ height: '260px', width: '100%', borderRadius: '16px', overflow: 'hidden', border: '1px solid #e2e8f0', boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.06)' }}>
                  <MapContainer
                    center={activeRouteData.pickup.coords}
                    zoom={7}
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; OpenStreetMap'
                    />
                    <Marker position={activeRouteData.pickup.coords} icon={pickupIcon} />
                    <Marker position={activeRouteData.drop.coords} icon={dropIcon} />
                    
                    {/* Driver current vehicle position if available */}
                    {getParsedVehicleCoords() && (
                      <Marker position={getParsedVehicleCoords()} icon={activeTruckIcon} />
                    )}

                    <Polyline
                      positions={activeRouteData.optimized.geometry.coordinates.map(([lng, lat]) => [lat, lng])}
                      color="#f97316"
                      weight={4}
                      opacity={0.8}
                    />
                  </MapContainer>
                </div>

                {/* Eco-savings reward callout */}
                <div style={{
                  padding: '16px',
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  borderRadius: '16px',
                  color: 'white',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  boxShadow: '0 8px 20px rgba(16,185,129,0.2)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ background: 'rgba(255,255,255,0.2)', padding: '10px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Leaf size={22} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontWeight: 800, fontSize: '0.9rem' }}>Green Driving Bonus</h4>
                      <p style={{ margin: '2px 0 0 0', fontSize: '0.72rem', opacity: 0.9 }}>
                        This optimized route prevents <strong>{activeRouteData.savings.co2_kg.toFixed(1)} kg</strong> of carbon emissions!
                      </p>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.62rem', opacity: 0.9, fontWeight: 700, textTransform: 'uppercase' }}>FUEL SAVED</div>
                    <div style={{ fontSize: '1.4rem', fontWeight: 900 }}>₹{Math.round(activeRouteData.savings.fuel_cost)}</div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default DriverHub;
