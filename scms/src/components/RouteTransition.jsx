import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import KineticLoader from './KineticLoader';

const pathNames = {
  '/orders': 'My Purchases',
  '/buyer/invoices': 'Invoices',
  '/buyer/warehouses': 'My Warehouses',
  '/map': 'Tracking',
  '/payments': 'Payments',
  '/ai-assistance': 'AI Assistant',
  '/driver/hub': 'Driver Hub',
  '/driver/earnings': 'Earnings',
  '/analytics': 'Analytics',
  '/warehouse': 'Warehouse',
  '/Fleet': 'Fleet',
  '/Dispatch': 'Dispatch',
  '/drivers': 'Drivers',
  '/payments-dashboard': 'Payments Dashboard',
  '/settings': 'Settings'
};

const RouteTransition = ({ children }) => {
  const location = useLocation();
  const [displayLocation, setDisplayLocation] = useState(location);
  const [isTransitioning, setIsTransitioning] = useState(false);

  useEffect(() => {
    if (location.pathname !== displayLocation.pathname) {
      setIsTransitioning(true);
      
      const timer = setTimeout(() => {
        setDisplayLocation(location);
        setIsTransitioning(false);
      }, 800);

      return () => clearTimeout(timer);
    }
  }, [location, displayLocation.pathname]);

  if (isTransitioning) {
    const name = pathNames[location.pathname] || 'Page';
    return <KineticLoader message={`Loading ${name}...`} />;
  }

  // Once transition finishes, render the new route children
  return React.cloneElement(children, { location: displayLocation });
};

export default RouteTransition;
