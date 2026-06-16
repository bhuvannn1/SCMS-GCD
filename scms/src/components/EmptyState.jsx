import React from 'react';

/**
 * EmptyState — IGNIS global empty-state component.
 *
 * Props:
 *  icon      – Lucide icon component (e.g. Truck, PackageOpen …)
 *  title     – Bold heading text
 *  message   – Descriptive sub-text
 *  variant   – 'default' (orange accent) | 'muted' (slate) | 'success' (green) | 'warning' (amber)
 *  size      – 'sm' | 'md' | 'lg'
 *  style     – extra inline styles for the wrapper
 */
const palette = {
  default: { bg: 'rgba(249,115,22,0.10)', icon: '#f97316', border: 'rgba(249,115,22,0.20)' },
  muted:   { bg: 'rgba(100,116,139,0.08)', icon: '#94a3b8', border: 'rgba(100,116,139,0.18)' },
  success: { bg: 'rgba(16,185,129,0.08)',  icon: '#10b981', border: 'rgba(16,185,129,0.18)' },
  warning: { bg: 'rgba(245,158,11,0.10)',  icon: '#f59e0b', border: 'rgba(245,158,11,0.22)' },
};

const sizes = {
  sm: { wrapper: '28px 20px', circle: '44px', iconSize: 22, title: '0.9rem',  msg: '0.8rem'  },
  md: { wrapper: '40px 28px', circle: '60px', iconSize: 30, title: '1.05rem', msg: '0.88rem' },
  lg: { wrapper: '56px 40px', circle: '76px', iconSize: 38, title: '1.2rem',  msg: '0.95rem' },
};

const EmptyState = ({
  icon: Icon,
  title,
  message,
  variant = 'default',
  size = 'md',
  style = {},
  children,
}) => {
  const p = palette[variant] || palette.default;
  const s = sizes[size]  || sizes.md;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center',
        padding: s.wrapper,
        animation: 'fadeIn 0.35s ease-out',
        ...style,
      }}
    >
      {Icon && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width:  s.circle,
            height: s.circle,
            borderRadius: '50%',
            background: p.bg,
            border: `1px solid ${p.border}`,
            marginBottom: '18px',
            flexShrink: 0,
          }}
        >
          <Icon size={s.iconSize} style={{ color: p.icon }} />
        </div>
      )}

      {title && (
        <h3
          style={{
            margin: '0 0 8px',
            fontWeight: 800,
            fontSize: s.title,
            color: 'var(--text-primary, #1e293b)',
            letterSpacing: '-0.01em',
          }}
        >
          {title}
        </h3>
      )}

      {message && (
        <p
          style={{
            margin: 0,
            fontSize: s.msg,
            color: 'var(--text-secondary, #64748b)',
            lineHeight: 1.6,
            maxWidth: '380px',
          }}
        >
          {message}
        </p>
      )}

      {children && (
        <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'center' }}>
          {children}
        </div>
      )}
    </div>
  );
};

export const getFriendlyError = (err) => {
  if (!err) return '';
  const str = String(err).toLowerCase();
  if (str.includes('rls') || str.includes('row level security') || str.includes('permission') || str.includes('policy')) {
    return "Access restricted. Please make sure you have the required credentials.";
  }
  if (str.includes('fetch') || str.includes('api') || str.includes('network') || str.includes('failed to load') || str.includes('load data') || str.includes('failed to process')) {
    return "Connection issue. Please check your internet or try refreshing.";
  }
  if (str.includes('supabase') || str.includes('database') || str.includes('sql') || str.includes('postgres') || str.includes('relation') || str.includes('column')) {
    return "We couldn't connect to the storage service. Please try again shortly.";
  }
  return err;
};


/* ─── Named presets for every IGNIS role ─────────────────────── */

// Driver
export const EmptyAssignedLoads  = (p) => <EmptyState icon={p.icon} title="Your Next Mission Awaits"          message="No loads assigned yet. Stay ready—your next delivery is coming soon."          {...p} />;
export const EmptyTripHistory    = (p) => <EmptyState icon={p.icon} title="First Trip Coming Soon"             message="Complete a delivery to start building your journey log."                      {...p} />;
export const EmptyEarnings       = (p) => <EmptyState icon={p.icon} title="Earnings Dashboard Waiting"        message="Your earnings will appear after your first completed trip."                  {...p} />;
export const EmptyRoute          = (p) => <EmptyState icon={p.icon} title="No Route Available"                message="A route will appear once a delivery is assigned."                            {...p} />;
export const EmptyNotifications  = (p) => <EmptyState icon={p.icon} title="You're Up to Date"                 message="No new updates at the moment."                                              {...p} />;

// Seller / Buyer
export const EmptyOrders         = (p) => <EmptyState icon={p.icon} title="Waiting for Customers"             message="Customer orders will appear here as they arrive."                           {...p} />;
export const EmptyShipments      = (p) => <EmptyState icon={p.icon} title="No Shipments in Motion"            message="Active shipments and dispatches will appear here."                          {...p} />;

// Warehouse
export const EmptyInventory      = (p) => <EmptyState icon={p.icon} title="Warehouse Ready"                   message="Inventory records will appear here as stock arrives."                       {...p} />;
export const EmptyAlerts         = (p) => <EmptyState icon={p.icon} title="All Systems Normal"                message="No warehouse issues detected."                                              {...p} />;

// AI / RCA
export const EmptyRCA            = (p) => <EmptyState icon={p.icon} title="Nothing to Investigate"            message="No disruptions detected. Future incidents will be analyzed automatically."   {...p} />;

// Global fallback
export const EmptyFallback = (p) => (
  <EmptyState
    icon={p.icon}
    title={p.title || 'Fresh Start'}
    message={p.message || "There's nothing to display right now. New activity will appear here automatically."}
    {...p}
  />
);

// Error fallback (replaces technical errors)
export const EmptyError = (p) => (
  <EmptyState
    variant="warning"
    icon={p.icon}
    title={p.title || 'Data Temporarily Unavailable'}
    message={p.message || "We couldn't load this information right now. Please try again in a moment."}
    {...p}
  />
);

export default EmptyState;
