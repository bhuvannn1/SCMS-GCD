import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import supabase from "./config/SupabaseClient";
import "./App.css";
import { ThemeProvider } from "./context/ThemeContext";


import Auth from "./pages/Auth";
import Orders from "./pages/Orders";


import Payment from "./pages/payment";
import PaymentsDashboard from "./pages/PaymentsDashboard";

import Sidebar from "./components/Sidebar";
import BuyerSidebar from "./components/BuyerSidebar";
import DriverSidebar from "./components/DriverSidebar";
import WarehousePage from "./pages/WarehousePage"
import AnalyticsPage from "./pages/AnalyticsPage";
import AIAssistancePage from "./pages/AIAssistancePage";
import SettingsPage from "./pages/SettingsPage";

import Fleet from "./pages/fleet"
import Dispatch from "./pages/dispatch"
import Driver from "./pages/drivers"
import MapView from "./pages/mapview"
import DriverEarnings from "./pages/DriverEarnings";
import DriverHub from "./pages/DriverHub";
import BuyerInvoices from "./pages/BuyerInvoices";
import BuyerWarehouses from "./pages/BuyerWarehouses";
import "leaflet/dist/leaflet.css"
import useWarehouseMonitor from "./hooks/useWarehouseMonitor";
import WarehouseAlertBanner from "./components/WarehouseAlertBanner";
import KineticLoader from "./components/KineticLoader";
import RouteTransition from "./components/RouteTransition";




function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState(null);
  useWarehouseMonitor();

  // ✅ Get session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session?.user) {
      supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .maybeSingle()
        .then(({ data, error }) => {
          if (error) {
            console.error("Error fetching role:", error);
            const fallbackRole = session.user.user_metadata?.role || "buyer";
            setRole(fallbackRole);
          } else if (data) {
            setRole(data.role);
          } else {
            const fallbackRole = session.user.user_metadata?.role || "buyer";
            setRole(fallbackRole);
          }
        });
    }
  }, [session]);

  // ✅ Loading states
  if (loading) {
    return <KineticLoader message="Loading..." />;
  }

  if (session && !role) {
    return <KineticLoader message="Loading role..." />;
  }

  // ✅ Layout rendering
  const renderLayout = () => {
    // 🟢 BUYER
    if (role === "buyer") {
      return (
        <div className="app-layout top-nav-layout">
          <BuyerSidebar />
          <main className="main-content">
            <RouteTransition>
              <Routes>
                <Route path="/" element={<Navigate to="/orders" replace />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/payments" element={<Payment />} />
                <Route path="/buyer/invoices" element={<BuyerInvoices />} />
                <Route path="/buyer/warehouses" element={<BuyerWarehouses />} />
                <Route path="/ai-assistance" element={<AIAssistancePage />} />
                <Route path="/map" element={<MapView />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/orders" replace />} />
              </Routes>
            </RouteTransition>
          </main>
        </div>
      );
    }

    // 🚚 DRIVER
    if (role === "driver") {
      return (
        <div className="app-layout top-nav-layout">
          <DriverSidebar />
          <main className="main-content">
            <RouteTransition>
              <Routes>
                <Route path="/" element={<Navigate to="/driver/hub" replace />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/map" element={<MapView />} />
                <Route path="/driver/hub" element={<DriverHub />} />
                <Route path="/driver/earnings" element={<DriverEarnings />} />
                <Route path="/ai-assistance" element={<AIAssistancePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/driver/hub" replace />} />
              </Routes>
            </RouteTransition>
          </main>
        </div>
      );
    }

    // 🏪 OWNER / SELLER (default)
    return (
      <>

        <div className="app-layout top-nav-layout">
          <Sidebar />
          <main className="main-content">
            <RouteTransition>
              <Routes>
                <Route path="/" element={<Navigate to="/orders" replace />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/analytics" element={<AnalyticsPage />} />
                <Route path="/warehouse" element={<WarehousePage />} />
                <Route path="/Fleet" element={<Fleet />} />
                <Route path="/Dispatch" element={<Dispatch />} />
                <Route path="/drivers" element={<Driver />} />
                <Route path="/ai-assistance" element={<AIAssistancePage />} />
                <Route path="/map" element={<MapView />} />
                <Route path="/payments-dashboard" element={<PaymentsDashboard />} />
                <Route path="/payments" element={<Payment />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="*" element={<Navigate to="/orders" replace />} />
              </Routes>
            </RouteTransition>
          </main>
        </div>
      </>
    );
  };

  return (
    <ThemeProvider>
      <BrowserRouter>

        {session ? (
          renderLayout()
        ) : (
          <Routes>
            <Route path="*" element={<Auth />} />
          </Routes>
        )}
      </BrowserRouter>
    </ThemeProvider>
  );

}

export default App;