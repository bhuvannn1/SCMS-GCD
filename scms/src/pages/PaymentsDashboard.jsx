import React, { useState, useEffect } from "react";
import { Clock, CreditCard, IndianRupee, X, CheckCircle, Search, FileText, Download, Package } from "lucide-react";
import axios from "axios";
import supabase from "../config/SupabaseClient";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ─── Invoice Generator ────────────────────────────────────────────────────────
const generateInvoiceHTML = (payment, order = null) => {
  const date = new Date(payment?.created_at || order?.created_at || Date.now()).toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric"
  });
  const rawAmount = payment?.amount || (order?.assigned_amount ? order.assigned_amount * 100 : (order?.amount || 0));
  const amount = (rawAmount / 100).toFixed(2);
  const tax = (rawAmount / 100 * 0.18).toFixed(2);
  const subtotal = ((rawAmount / 100) - parseFloat(tax)).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice - ${payment?.razorpay_order_id || order?.razorpay_order_id || order?.load_id || "N/A"}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; }
    .invoice-box { max-width: 800px; margin: auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .inv-header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 40px; display: flex; justify-content: space-between; align-items: flex-start; }
    .inv-header h1 { font-size: 2rem; font-weight: 800; letter-spacing: -0.5px; }
    .inv-header p { opacity: 0.85; font-size: 0.9rem; margin-top: 4px; }
    .inv-meta { text-align: right; }
    .inv-meta .inv-num { font-size: 1.1rem; font-weight: 700; }
    .inv-meta .inv-date { font-size: 0.85rem; opacity: 0.8; margin-top: 4px; }
    .inv-body { padding: 40px; }
    .inv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 36px; }
    .party-block h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
    .party-block p { font-size: 0.95rem; color: #1e293b; line-height: 1.6; }
    .party-block strong { font-size: 1rem; display: block; margin-bottom: 2px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #f1f5f9; padding: 12px 16px; text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
    tbody td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-table { width: 280px; }
    .totals-table tr td { padding: 8px 0; font-size: 0.9rem; border: none; }
    .totals-table tr td:last-child { text-align: right; font-weight: 600; }
    .totals-table .grand-total td { font-size: 1.1rem; font-weight: 800; color: #f97316; border-top: 2px solid #f97316; padding-top: 12px; margin-top: 8px; }
    .status-badge { display: inline-block; background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; }
    .inv-footer { background: #f8fafc; padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #e2e8f0; }
    .inv-footer p { font-size: 0.8rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="invoice-box">
    <div class="inv-header">
      <div>
        <h1><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align: middle; margin-right: 8px;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg> IGNIS</h1>
        <p>Supply Chain Management System</p>
      </div>
      <div class="inv-meta">
        <div class="inv-num">INVOICE</div>
        <div class="inv-date">${date}</div>
        <div style="margin-top:8px"><span class="status-badge">PAID</span></div>
      </div>
    </div>
    <div class="inv-body">
      <div class="inv-parties">
        <div class="party-block">
          <h3>From</h3>
          <strong>IGNIS Logistics Pvt. Ltd.</strong>
          <p>SCMS Platform<br/>India</p>
        </div>
        <div class="party-block">
          <h3>Payment Reference</h3>
          <p><strong>Order ID</strong>${payment?.razorpay_order_id || order?.razorpay_order_id || order?.load_id || "N/A"}<br/>
          <strong>Payment ID</strong>${payment?.razorpay_payment_id || "N/A"}</p>
        </div>
      </div>
      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Description</th>
            <th>Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>Freight Logistics Service</td>
            <td>₹${subtotal}</td>
          </tr>
          <tr>
            <td>2</td>
            <td>GST @ 18%</td>
            <td>₹${tax}</td>
          </tr>
        </tbody>
      </table>
      <div class="totals">
        <table class="totals-table">
          <tr><td>Subtotal</td><td>₹${subtotal}</td></tr>
          <tr><td>Tax (18% GST)</td><td>₹${tax}</td></tr>
          <tr class="grand-total"><td>Total Paid</td><td>₹${amount}</td></tr>
        </table>
      </div>
    </div>
    <div class="inv-footer">
      <p>Thank you for your business!</p>
      <p>Generated by IGNIS SCMS • ${date}</p>
    </div>
  </div>
</body>
</html>`;
};

const downloadInvoice = (payment, order = null) => {
  const html = generateInvoiceHTML(payment, order);
  const blob = new Blob([html], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `IGNIS-Invoice-${payment?.razorpay_order_id || order?.razorpay_order_id || order?.load_id || "INV"}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Status Badge ─────────────────────────────────────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    success: { bg: "rgba(16,185,129,0.12)", color: "#10b981", label: "Paid", icon: CheckCircle },
    paid: { bg: "rgba(16,185,129,0.12)", color: "#10b981", label: "Paid", icon: CheckCircle },
    pending: { bg: "rgba(245,158,11,0.12)", color: "#f59e0b", label: "Pending", icon: Clock },
    failed: { bg: "rgba(239,68,68,0.12)", color: "#ef4444", label: "Failed", icon: X },
  };
  const s = map[status?.toLowerCase()] || { bg: "rgba(100,116,139,0.12)", color: "#64748b", label: status || "—", icon: null };
  const Icon = s.icon;
  return (
    <span style={{
      background: s.bg, color: s.color,
      padding: "4px 10px", borderRadius: "20px",
      fontSize: "0.78rem", fontWeight: 700,
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      gap: "4px"
    }}>
      {Icon && <Icon size={12} />}
      {s.label}
    </span>
  );
};

// ─── Summary Card ─────────────────────────────────────────────────────────────
const SummaryCard = ({ icon, label, value, accent, sub }) => (
  <div style={{
    background: "var(--bg-card, #fff)",
    border: "1px solid var(--border-color, #e2e8f0)",
    borderRadius: "16px",
    padding: "22px 24px",
    display: "flex",
    flexDirection: "column",
    gap: "8px",
    position: "relative",
    overflow: "hidden",
    boxShadow: "var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))",
    transition: "transform 0.2s, box-shadow 0.2s",
    cursor: "default",
  }}
    onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.1)"; }}
    onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))"; }}
  >
    <div style={{ position: "absolute", top: 0, right: 0, width: "80px", height: "80px", borderRadius: "0 16px 0 80px", background: `${accent}18` }} />
    <div style={{ display: "flex", alignItems: "center" }}>{icon}</div>
    <div style={{ fontSize: "0.78rem", color: "var(--text-secondary, #64748b)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.5px" }}>{label}</div>
    <div style={{ fontSize: "1.8rem", fontWeight: 800, color: accent, lineHeight: 1 }}>{value}</div>
    {sub && <div style={{ fontSize: "0.75rem", color: "var(--text-secondary, #64748b)" }}>{sub}</div>}
  </div>
);

// ─── Main Component ────────────────────────────────────────────────────────────
const PaymentsDashboard = () => {
  const [orders, setOrders] = useState([]);       // all Load records
  const [payments, setPayments] = useState([]);   // all payment records
  const [invoices, setInvoices] = useState([]);   // all invoice records
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState("created_at");
  const [sortDir, setSortDir] = useState("desc");
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [invoicePreview, setInvoicePreview] = useState(false);
  // amount assignment state
  const [amountInputs, setAmountInputs] = useState({});   // { load_id: "1500" }
  const [savingAmount, setSavingAmount] = useState({});   // { load_id: true/false }
  const [amountMsg, setAmountMsg]     = useState({});     // { load_id: { ok, msg } }

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);

      // 1. Fetch all orders from Load table
      const { data: loadData, error: loadErr } = await supabase
        .from("Load")
        .select("*");

      // 2. Fetch all completed payments
      const { data: payData, error: payErr } = await supabase
        .from("payments")
        .select("*");

      // 3. Fetch all invoices
      const { data: invData, error: invErr } = await supabase
        .from("invoices")
        .select("*");

      // Debug: log what came back
      console.log("[PaymentsDashboard] Load rows:", loadData?.length, "| error:", loadErr);
      console.log("[PaymentsDashboard] Payment rows:", payData?.length, "| error:", payErr);
      console.log("[PaymentsDashboard] Invoice rows:", invData?.length, "| error:", invErr);

      setOrders(loadData || []);
      setPayments(payData || []);
      setInvoices(invData || []);
      setLoading(false);
    };
    fetchAll();
  }, []);

  // ── Merge: attach payment record to each order ─────────────────────────────
  // A payment is "linked" by razorpay_order_id stored on the Load row,
  // OR by matching order_id if we stored it — fall back to payment_status field.
  const mergedRows = orders
    .filter(o => o && o.load_id)    // only rows with a valid load_id
    .map(order => {
      const matchedInvoice = invoices.find(inv => inv.load_id === order.load_id);
      const matchedPayment = payments.find(
        p => p.order_id === order.load_id || 
             p.razorpay_order_id === order.razorpay_order_id ||
             (matchedInvoice && p.razorpay_payment_id === matchedInvoice.razorpay_payment_id)
      );
      const isPaid = matchedPayment
        ? ["success", "paid"].includes(matchedPayment.status?.toLowerCase())
        : order.payment_status === "paid";

      return {
        ...order,
        _payment: matchedPayment || null,
        _status:  isPaid ? "paid" : "pending",
        _amount:  matchedPayment?.amount || order.amount || null,
        _paidAt:  matchedPayment?.created_at || null,
      };
    });

  // ── Stats ──────────────────────────────────────────────────────────────────
  const paidCount = mergedRows.filter(r => r._status === "paid").length;
  const pendingCount = mergedRows.filter(r => r._status === "pending").length;

  const totalRevenue = mergedRows
    .filter(r => r._status === "paid")
    .reduce((sum, r) => sum + (Number(r.assigned_amount) || 0), 0);

  // ── Filters ────────────────────────────────────────────────────────────────
  const filtered = mergedRows
    .filter(r => {
      const matchStatus = statusFilter === "all" || r._status === statusFilter;
      const q = searchQuery.toLowerCase();
      const matchSearch =
        !q ||
        (r.load_id || "").toLowerCase().includes(q) ||
        (r.customer || "").toLowerCase().includes(q) ||
        (r.pickup || "").toLowerCase().includes(q) ||
        (r.drop || "").toLowerCase().includes(q) ||
        (r._payment?.razorpay_payment_id || "").toLowerCase().includes(q);
      return matchStatus && matchSearch;
    })
    .sort((a, b) => {
      const aVal = a[sortField] || a._paidAt || "";
      const bVal = b[sortField] || b._paidAt || "";
      if (sortDir === "asc") return aVal > bVal ? 1 : -1;
      return bVal > aVal ? 1 : -1;
    });

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return <span style={{ opacity: 0.3, marginLeft: 4 }}>↕</span>;
    return <span style={{ color: "#f97316", marginLeft: 4 }}>{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  // ── Set Amount handler ──────────────────────────────────────────────────────────
  const handleSetAmount = async (loadId) => {
    const raw = amountInputs[loadId];
    const amount = parseFloat(raw);
    if (!raw || isNaN(amount) || amount <= 0) {
      setAmountMsg(prev => ({ ...prev, [loadId]: { ok: false, msg: "Enter a valid amount" } }));
      return;
    }
    if (amount > 1000000) {
      setAmountMsg(prev => ({ ...prev, [loadId]: { ok: false, msg: "Max limit is ₹10,00,000" } }));
      return;
    }
    setSavingAmount(prev => ({ ...prev, [loadId]: true }));
    setAmountMsg(prev => ({ ...prev, [loadId]: null }));
    try {
      const resp = await axios.post(`${API}/api/payment/assign-amount`, { load_id: loadId, amount });
      if (resp.data.success) {
        // Optimistically update the local order list so UI reflects new amount immediately
        setOrders(prev => prev.map(o =>
          o.load_id === loadId ? { ...o, assigned_amount: amount } : o
        ));
        setAmountMsg(prev => ({ ...prev, [loadId]: { ok: true, msg: "Saved successfully" } }));
        setTimeout(() => setAmountMsg(prev => ({ ...prev, [loadId]: null })), 3000);
      }
    } catch (err) {
      const msg = err.response?.data?.error || err.message || "Failed to set amount";
      setAmountMsg(prev => ({ ...prev, [loadId]: { ok: false, msg } }));
    } finally {
      setSavingAmount(prev => ({ ...prev, [loadId]: false }));
    }
  };

  // ── Styles ───────────────────────────────────────────────────────────────────
  const thStyle = {
    padding: "12px 16px",
    textAlign: "left",
    fontSize: "0.75rem",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
    color: "var(--text-secondary, #64748b)",
    fontWeight: 700,
    cursor: "pointer",
    whiteSpace: "nowrap",
    userSelect: "none",
    borderBottom: "2px solid var(--border-color, #e2e8f0)",
  };
  const tdStyle = {
    padding: "14px 16px",
    fontSize: "0.875rem",
    color: "var(--text-primary, #1e293b)",
    borderBottom: "1px solid var(--border-color, rgba(0,0,0,0.04))",
    verticalAlign: "middle",
  };

  return (
    <div className="page" style={{ maxWidth: "1400px", margin: "0 auto" }}>
      <div style={{ marginBottom: "28px" }}>
        <h2 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
          <CreditCard style={{ color: "#f97316" }} /> Payments
        </h2>
        <p style={{ color: "var(--text-secondary)", marginTop: "6px", fontSize: "0.9rem" }}>
          Monitor all transactions, revenue, and generate invoices.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "28px" }}>
        <SummaryCard
          icon={<IndianRupee size={24} style={{ color: "#f97316" }} />}
          label="Total Revenue"
          value={`₹${totalRevenue.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`}
          accent="#f97316"
          sub="From completed payments"
        />
        <SummaryCard
          icon={<CheckCircle size={24} style={{ color: "#10b981" }} />}
          label="Paid Orders"
          value={paidCount}
          accent="#10b981"
          sub="Buyer paid via Razorpay"
        />
        <SummaryCard
          icon={<Clock size={24} style={{ color: "#f59e0b" }} />}
          label="Pending Payment"
          value={pendingCount}
          accent="#f59e0b"
          sub="Awaiting buyer payment"
        />
        <SummaryCard
          icon={<Package size={24} style={{ color: "#6366f1" }} />}
          label="Total Orders"
          value={mergedRows.length}
          accent="#6366f1"
          sub="All orders in the system"
        />
      </div>

      {/* ── Transactions Table ─────────────────────────────────────────────── */}
      <div style={{
        background: "var(--bg-card, #fff)",
        borderRadius: "16px",
        border: "1px solid var(--border-color, #e2e8f0)",
        boxShadow: "var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))",
        overflow: "hidden",
      }}>
        {/* Table Header / Filters */}
        <div style={{
          padding: "20px 24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          borderBottom: "1px solid var(--border-color, #e2e8f0)"
        }}>
          <h3 style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem" }}>
            All Orders
            <span style={{
              marginLeft: "10px", background: "rgba(249,115,22,0.1)",
              color: "#f97316", padding: "2px 10px", borderRadius: "20px", fontSize: "0.8rem", fontWeight: 700
            }}>{filtered.length}</span>
          </h3>

          <div style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            {/* Search */}
            <div style={{ position: "relative" }}>
              <input
                type="text"
                placeholder="Search order, customer, route..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  padding: "8px 12px 8px 32px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color, #e2e8f0)",
                  background: "var(--bg-primary, #f8fafc)",
                  color: "var(--text-primary)",
                  fontSize: "0.85rem",
                  outline: "none",
                  width: "240px",
                }}
              />
              <Search size={16} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
            </div>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border-color, #e2e8f0)",
                background: "var(--bg-primary, #f8fafc)",
                color: "var(--text-primary)",
                fontSize: "0.85rem",
                cursor: "pointer",
                outline: "none",
              }}
            >
              <option value="all">All Orders</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending Payment</option>
            </select>
          </div>
        </div>

        {/* Table */}
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}><Clock size={32} style={{ color: "var(--text-secondary)" }} /></div>
            <p style={{ color: "var(--text-secondary)" }}>Loading orders...</p>
          </div>
        ) : filtered.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}><Package size={48} style={{ color: "var(--text-secondary)" }} /></div>
            <h3 style={{ color: "var(--text-primary)", marginBottom: "8px" }}>No Orders Found</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem" }}>
              Orders from the Load table will appear here. Payment status updates automatically when a buyer pays.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={thStyle} onClick={() => handleSort("load_id")}>
                    Order ID <SortIcon field="load_id" />
                  </th>
                  <th style={thStyle} onClick={() => handleSort("customer")}>
                    Customer <SortIcon field="customer" />
                  </th>
                  <th style={thStyle}>
                    Route
                  </th>
                  <th style={thStyle} onClick={() => handleSort("_amount")}>
                    Amount <SortIcon field="_amount" />
                  </th>
                  <th style={{ ...thStyle, cursor: "default" }}>Assign Amount</th>
                  <th style={thStyle} onClick={() => handleSort("_status")}>
                    Payment Status <SortIcon field="_status" />
                  </th>
                  <th style={thStyle} onClick={() => handleSort("_paidAt")}>
                    Paid On <SortIcon field="_paidAt" />
                  </th>
                  <th style={{ ...thStyle, cursor: "default" }}>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, idx) => {
                  const isEven = idx % 2 === 0;
                  const isPaid = row._status === "paid";
                  return (
                    <tr
                      key={row.load_id || idx}
                      style={{
                        background: isEven ? "transparent" : "var(--bg-primary, rgba(0,0,0,0.01))",
                        transition: "background 0.15s",
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.04)"}
                      onMouseLeave={e => e.currentTarget.style.background = isEven ? "transparent" : "var(--bg-primary, rgba(0,0,0,0.01))"}
                    >
                      {/* Order ID */}
                      <td style={tdStyle}>
                        <span style={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          #{row.load_id || "—"}
                        </span>
                      </td>

                      {/* Customer */}
                      <td style={{ ...tdStyle, fontWeight: 600 }}>
                        {row.customer || "—"}
                      </td>

                      {/* Route */}
                      <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                        {row.pickup && row.drop
                          ? <>{row.pickup} <span style={{ color: "#f97316" }}>→</span> {row.drop}</>
                          : "—"}
                      </td>

                      {/* Amount — show assigned_amount if set */}
                      <td style={{ ...tdStyle, fontWeight: 700, color: isPaid ? "#f97316" : "#6366f1" }}>
                        {row.assigned_amount
                          ? `₹${Number(row.assigned_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
                          : <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontStyle: "italic" }}>Not set</span>}
                      </td>

                      {/* Assign Amount — only editable for unpaid orders */}
                      <td style={{ ...tdStyle, minWidth: "180px" }}>
                        {isPaid ? (
                          <span style={{ fontSize: "0.78rem", color: "#10b981", fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle size={12}/> Locked
                          </span>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                              <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", fontWeight: 700 }}>₹</span>
                              <input
                                type="number"
                                min="1"
                                step="0.01"
                                placeholder={row.assigned_amount || "Enter amount"}
                                value={amountInputs[row.load_id] ?? (row.assigned_amount || "")}
                                onChange={e => setAmountInputs(prev => ({ ...prev, [row.load_id]: e.target.value }))}
                                style={{
                                  width: "90px",
                                  padding: "5px 8px",
                                  borderRadius: "6px",
                                  border: "1.5px solid var(--border-color, #e2e8f0)",
                                  background: "var(--bg-primary, #f8fafc)",
                                  color: "var(--text-primary)",
                                  fontSize: "0.82rem",
                                  outline: "none",
                                }}
                                onKeyDown={e => e.key === "Enter" && handleSetAmount(row.load_id)}
                              />
                              <button
                                onClick={() => handleSetAmount(row.load_id)}
                                disabled={savingAmount[row.load_id]}
                                style={{
                                  padding: "5px 10px",
                                  borderRadius: "6px",
                                  border: "none",
                                  background: "linear-gradient(135deg,#f97316,#ea580c)",
                                  color: "white",
                                  fontWeight: 700,
                                  fontSize: "0.75rem",
                                  cursor: savingAmount[row.load_id] ? "not-allowed" : "pointer",
                                  opacity: savingAmount[row.load_id] ? 0.65 : 1,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {savingAmount[row.load_id] ? "..." : row.assigned_amount ? "Update" : "Set"}
                              </button>
                            </div>
                            {amountMsg[row.load_id] && (
                              <span style={{
                                fontSize: "0.7rem",
                                fontWeight: 600,
                                color: amountMsg[row.load_id].ok ? "#10b981" : "#ef4444",
                              }}>
                                {amountMsg[row.load_id].msg}
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      {/* Payment Status */}
                      <td style={tdStyle}>
                        <StatusBadge status={isPaid ? "success" : "pending"} />
                      </td>

                      {/* Paid On Date */}
                      <td style={{ ...tdStyle, color: "var(--text-secondary)", fontSize: "0.82rem" }}>
                        {row._paidAt
                          ? new Date(row._paidAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                          : <span style={{ fontSize: "0.78rem", color: "#f59e0b" }}>Awaiting payment</span>}
                      </td>

                      {/* Invoice — only for paid orders */}
                      <td style={tdStyle}>
                        {isPaid ? (
                          <div style={{ display: "flex", gap: "8px" }}>
                            <button
                              onClick={() => { setSelectedPayment(row); setInvoicePreview(true); }}
                              title="Preview Invoice"
                              style={{
                                background: "rgba(249,115,22,0.1)",
                                color: "#f97316",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "background 0.2s",
                                whiteSpace: "nowrap",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.2)"}
                              onMouseLeave={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}
                            >
                              <FileText size={12} /> Invoice
                            </button>
                            <button
                              onClick={() => downloadInvoice(row._payment, row)}
                              title="Download Invoice"
                              style={{
                                background: "rgba(16,185,129,0.1)",
                                color: "#10b981",
                                border: "none",
                                padding: "6px 12px",
                                borderRadius: "6px",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: "pointer",
                                transition: "background 0.2s",
                                whiteSpace: "nowrap",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              onMouseEnter={e => e.currentTarget.style.background = "rgba(16,185,129,0.2)"}
                              onMouseLeave={e => e.currentTarget.style.background = "rgba(16,185,129,0.1)"}
                            >
                              <Download size={12} /> Download
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)", fontStyle: "italic" }}>—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Invoice Preview Modal ──────────────────────────────────────────── */}
      {invoicePreview && selectedPayment && (
        <div
          onClick={() => setInvoicePreview(false)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg-card, #fff)",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "720px",
              maxHeight: "90vh",
              overflow: "auto",
              boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Modal Header */}
            <div style={{
              padding: "16px 24px",
              borderBottom: "1px solid var(--border-color, #e2e8f0)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              position: "sticky",
              top: 0,
              background: "var(--bg-card, #fff)",
              zIndex: 1,
            }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem", display: "flex", alignItems: "center", gap: "6px" }}><FileText size={16} /> Invoice Preview</h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => downloadInvoice(selectedPayment._payment, selectedPayment)}
                  style={{
                    background: "#f97316", color: "white",
                    border: "none", padding: "8px 16px",
                    borderRadius: "8px", fontWeight: 700,
                    fontSize: "0.85rem", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: "4px"
                  }}
                >
                  <Download size={14} /> Download
                </button>
                <button
                  onClick={() => setInvoicePreview(false)}
                  style={{
                    background: "rgba(239,68,68,0.1)", color: "#ef4444",
                    border: "none", padding: "8px 12px",
                    borderRadius: "8px", fontWeight: 700,
                    fontSize: "0.85rem", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: "4px"
                  }}
                >
                  <X size={14} /> Close
                </button>
              </div>
            </div>
            {/* Invoice iframe */}
            <iframe
              srcDoc={generateInvoiceHTML(selectedPayment._payment, selectedPayment)}
              style={{ width: "100%", height: "600px", border: "none" }}
              title="Invoice Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default PaymentsDashboard;
