import React, { useEffect, useState, useMemo } from 'react';
import './KineticLoader.css';

const KineticLoader = ({ message = "Loading..." }) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let timer;
    const updateProgress = () => {
      setProgress((prev) => {
        if (prev < 100) {
          const increment = Math.random() * 1.5;
          const next = Math.min(100, prev + increment);
          const timeout = 30 + Math.random() * 120;
          timer = setTimeout(updateProgress, timeout);
          return next;
        } else {
          // Loop the demo progress if needed
          timer = setTimeout(() => {
            setProgress(0);
            updateProgress();
          }, 2000);
          return 100;
        }
      });
    };

    updateProgress();

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, []);

  const trees = useMemo(() => {
    return Array.from({ length: 60 }).map(() => ({
      width: Math.random() * 40 + 20,
      height: Math.random() * 60 + 40,
      marginLeft: Math.random() * 20
    }));
  }, []);

  const displayVal = Math.floor(progress);

  return (
    <div className="kinetic-container">
      {/* 1. SCENERY: Parallax Background */}
      <div className="kinetic-scenic-bg kinetic-pointer-none">
        {/* Distant Mountains */}
        <div className="kinetic-mountain-layer">
          <div className="kinetic-mountain-shape" />
          <div className="kinetic-mountain-shape" />
        </div>
        {/* Mist Layer */}
        <div className="kinetic-mist-overlay" />
        {/* Roadside Trees (Silhouettes) */}
        <div className="kinetic-trees-layer">
          <div className="kinetic-tree-list">
            {trees.map((tree, idx) => (
              <div
                key={idx}
                className="kinetic-tree"
                style={{
                  width: `${tree.width}px`,
                  height: `${tree.height}px`,
                  marginLeft: `${tree.marginLeft}px`
                }}
              />
            ))}
          </div>
        </div>
      </div>

      {/* 2. UI: Branding Header */}
      <header className="kinetic-header">
        <div className="kinetic-logo-placeholder">
          <img src="/IGNIS.png" alt="IGNIS Logo" className="kinetic-logo-img" />
        </div>
        <h1 className="kinetic-title">IGNIS</h1>
        <div className="kinetic-subtitle-wrapper">
          <div className="kinetic-line-accent" />
          <div className="kinetic-subtitle">
            BUILT IN INDIA<br />FOR THE WORLD
          </div>
          <div className="kinetic-line-accent" />
        </div>
      </header>

      {/* 3. PERSPECTIVE: Animation Stage */}
      <div className="kinetic-stage">
        {/* Road Infrastructure */}
        <div className="kinetic-road">
          {/* Road Surface */}
          <div className="kinetic-road-surface" />
          {/* Route Pulse Lines */}
          <div className="kinetic-route-line-top" />
          <div className="kinetic-route-line-bottom" />
          {/* Moving Lane Markings */}
          <div className="kinetic-lane-wrapper">
            <div className="kinetic-road-lane">
              {Array.from({ length: 40 }).map((_, idx) => (
                <div key={idx} className="kinetic-road-line-dash" />
              ))}
            </div>
          </div>
        </div>

        {/* 4. TRUCK: Modern Container Truck Side View */}
        <div className="kinetic-truck-vibration">
          {/* Energy Trail */}
          <div className="kinetic-energy-trail" />
          <div className="kinetic-truck-body">
            {/* Trailer */}
            <div className="kinetic-trailer">
              <div className="kinetic-trailer-shine" />
              <div className="kinetic-trailer-content">
                <span className="kinetic-trailer-text">IGNIS</span>
              </div>
              {/* Accent Strip */}
              <div className="kinetic-trailer-stripe" />
            </div>
            {/* Cab */}
            <div className="kinetic-cab">
              {/* Cab Window */}
              <div className="kinetic-cab-window">
                <div className="kinetic-cab-window-shine" />
              </div>
              {/* Modern Headlight */}
              <div className="kinetic-headlight" />
            </div>
            {/* Wheels */}
            <div className="kinetic-wheels-trailer">
              <div className="kinetic-wheel">
                <div className="kinetic-wheel-hub" />
              </div>
              <div className="kinetic-wheel">
                <div className="kinetic-wheel-hub" />
              </div>
            </div>
            <div className="kinetic-wheels-cab">
              <div className="kinetic-wheel">
                <div className="kinetic-wheel-hub" />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Loading status below */}
      <div className="kinetic-status-wrapper">
        <div className="kinetic-pulse-dot" />
        <div className="kinetic-loading-text">{message}</div>
      </div>

      {/* 5. UI: Loading Stats */}
      <footer className="kinetic-footer">
        <div className="kinetic-progress-container">
          <div
            className="kinetic-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="kinetic-progress-text">
          {displayVal.toString().padStart(2, '0')}%
        </div>
      </footer>

      {/* Cinematic Vignette */}
      <div className="kinetic-vignette" />
    </div>
  );
};

export default KineticLoader;
