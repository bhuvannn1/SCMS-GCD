import React, { useState, useEffect } from "react";
import { Clock, FileText, Download, X } from "lucide-react";
import supabase from "../config/SupabaseClient";

// ── Invoice HTML generator (mirrors seller's invoice) ────────────────────────
const generateInvoiceHTML = (inv) => {
  const date = new Date(inv.created_at || Date.now()).toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
  });
  const total    = (inv.amount / 100).toFixed(2);
  const tax      = ((inv.amount / 100) * 0.18).toFixed(2);
  const subtotal = ((inv.amount / 100) - parseFloat(tax)).toFixed(2);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Invoice ${inv.invoice_number || inv.id}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', sans-serif; background: #f8fafc; color: #1e293b; padding: 40px; }
    .invoice-box { max-width: 800px; margin: auto; background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.08); }
    .inv-header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; padding: 40px; display: flex; justify-content: space-between; align-items: flex-start; }
    .inv-header h1 { font-size: 2rem; font-weight: 800; }
    .inv-header p { opacity: 0.85; font-size: 0.9rem; margin-top: 4px; }
    .inv-meta { text-align: right; }
    .inv-meta .inv-num { font-size: 1.1rem; font-weight: 700; }
    .inv-meta .inv-date { font-size: 0.85rem; opacity: 0.8; margin-top: 4px; }
    .status-badge { display: inline-block; background: #dcfce7; color: #16a34a; padding: 4px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 700; margin-top: 8px; }
    .inv-body { padding: 40px; }
    .inv-parties { display: grid; grid-template-columns: 1fr 1fr; gap: 32px; margin-bottom: 36px; }
    .party-block h3 { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; margin-bottom: 8px; }
    .party-block strong { font-size: 1rem; display: block; margin-bottom: 2px; }
    .party-block p { font-size: 0.9rem; color: #1e293b; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #f1f5f9; padding: 12px 16px; text-align: left; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.5px; color: #64748b; }
    tbody td { padding: 14px 16px; border-bottom: 1px solid #f1f5f9; font-size: 0.9rem; }
    .totals { display: flex; justify-content: flex-end; }
    .totals-table { width: 280px; }
    .totals-table tr td { padding: 8px 0; font-size: 0.9rem; border: none; }
    .totals-table tr td:last-child { text-align: right; font-weight: 600; }
    .totals-table .grand-total td { font-size: 1.1rem; font-weight: 800; color: #f97316; border-top: 2px solid #f97316; padding-top: 12px; }
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
        <div class="inv-num">${inv.invoice_number || "INVOICE"}</div>
        <div class="inv-date">${date}</div>
        <span class="status-badge">✓ PAID</span>
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
          <p>
            <strong>Load ID: </strong>${inv.load_id || "N/A"}<br/>
            <strong>Razorpay Order: </strong>${inv.razorpay_order_id || "N/A"}<br/>
            <strong>Payment ID: </strong>${inv.razorpay_payment_id || "N/A"}
          </p>
        </div>
      </div>
      <table>
        <thead><tr><th>#</th><th>Description</th><th>Amount</th></tr></thead>
        <tbody>
          <tr><td>1</td><td>Freight Logistics Service</td><td>₹${subtotal}</td></tr>
          <tr><td>2</td><td>GST @ 18%</td><td>₹${tax}</td></tr>
        </tbody>
      </table>
      <div class="totals">
        <table class="totals-table">
          <tr><td>Subtotal</td><td>₹${subtotal}</td></tr>
          <tr><td>Tax (18% GST)</td><td>₹${tax}</td></tr>
          <tr class="grand-total"><td>Total Paid</td><td>₹${total}</td></tr>
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

const downloadInvoice = (inv) => {
  const html = generateInvoiceHTML(inv);
  const blob = new Blob([html], { type: "text/html" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = `IGNIS-Invoice-${inv.invoice_number || inv.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
};

// ─── Main Component ───────────────────────────────────────────────────────────
const BuyerInvoices = () => {
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [preview, setPreview]   = useState(null); // invoice being previewed

  useEffect(() => {
    const fetchInvoices = async () => {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("buyer_id", session.user.id)
        .order("created_at", { ascending: false });

      if (error) console.error("Invoice fetch error:", error);
      setInvoices(data || []);
      setLoading(false);
    };
    fetchInvoices();
  }, []);

  const fmt = (n) =>
    Number(n / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  return (
    <div className="page" style={{ maxWidth: "1100px", margin: "0 auto" }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ margin: 0, fontWeight: 800, fontSize: "1.5rem", color: "var(--text-primary)" }}>
          My Invoices
        </h2>
        <p style={{ margin: "4px 0 0", color: "var(--text-secondary)", fontSize: "0.88rem" }}>
          Download or preview invoices for all your completed payments.
        </p>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div style={{
        background: "var(--bg-card, #fff)",
        border: "1px solid var(--border-color, #e2e8f0)",
        borderRadius: "16px",
        boxShadow: "var(--shadow-md, 0 2px 8px rgba(0,0,0,0.06))",
        overflow: "hidden",
      }}>
        {loading ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "12px" }}><Clock size={32} style={{ color: "var(--text-secondary)" }} /></div>
            <p style={{ color: "var(--text-secondary)" }}>Loading your invoices...</p>
          </div>
        ) : invoices.length === 0 ? (
          <div style={{ padding: "60px", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}><FileText size={48} style={{ color: "var(--text-secondary)" }} /></div>
            <h3 style={{ color: "var(--text-primary)", marginBottom: "8px" }}>No Invoices Yet</h3>
            <p style={{ color: "var(--text-secondary)", fontSize: "0.9rem", maxWidth: "360px", margin: "0 auto" }}>
              Invoices are generated automatically after you complete a payment. Go to <strong>Payments</strong> to pay for your orders.
            </p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Invoice #", "Order ID", "Amount Paid", "Date", "Actions"].map(h => (
                    <th key={h} style={{
                      padding: "12px 16px",
                      textAlign: "left",
                      fontSize: "0.75rem",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "var(--text-secondary, #64748b)",
                      fontWeight: 700,
                      borderBottom: "2px solid var(--border-color, #e2e8f0)",
                      cursor: "default",
                      whiteSpace: "nowrap",
                    }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv, idx) => {
                  const isEven = idx % 2 === 0;
                  return (
                    <tr
                      key={inv.id}
                      style={{ background: isEven ? "transparent" : "var(--bg-primary, rgba(0,0,0,0.01))", transition: "background 0.15s" }}
                      onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.04)"}
                      onMouseLeave={e => e.currentTarget.style.background = isEven ? "transparent" : "var(--bg-primary, rgba(0,0,0,0.01))"}
                    >
                      {/* Invoice # */}
                      <td style={{ padding: "14px 16px", fontSize: "0.875rem", verticalAlign: "middle" }}>
                        <span style={{ fontWeight: 800, color: "#f97316", fontFamily: "monospace", fontSize: "0.88rem" }}>
                          {inv.invoice_number || `INV-${inv.id?.slice(0, 8)}`}
                        </span>
                      </td>

                      {/* Order ID */}
                      <td style={{ padding: "14px 16px", fontSize: "0.875rem", verticalAlign: "middle" }}>
                        <span style={{ fontFamily: "monospace", fontSize: "0.82rem", fontWeight: 700, color: "var(--text-primary)" }}>
                          {inv.load_id ? `#${inv.load_id}` : "—"}
                        </span>
                      </td>

                      {/* Amount */}
                      <td style={{ padding: "14px 16px", fontSize: "0.875rem", verticalAlign: "middle", fontWeight: 800, color: "#10b981" }}>
                        ₹{fmt(inv.amount)}
                      </td>

                      {/* Date */}
                      <td style={{ padding: "14px 16px", fontSize: "0.82rem", verticalAlign: "middle", color: "var(--text-secondary)" }}>
                        {inv.created_at
                          ? new Date(inv.created_at).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
                          : "—"}
                      </td>

                      {/* Actions */}
                      <td style={{ padding: "14px 16px", verticalAlign: "middle" }}>
                        <div style={{ display: "flex", gap: "8px" }}>
                          <button
                            onClick={() => setPreview(inv)}
                            style={{
                              padding: "6px 12px", borderRadius: "6px", border: "none",
                              background: "rgba(249,115,22,0.1)", color: "#f97316",
                              fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                              transition: "background 0.2s", whiteSpace: "nowrap",
                              display: "inline-flex", alignItems: "center", gap: "4px"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.2)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(249,115,22,0.1)"}
                          >
                            <FileText size={12} /> Preview
                          </button>
                          <button
                            onClick={() => downloadInvoice(inv)}
                            style={{
                              padding: "6px 12px", borderRadius: "6px", border: "none",
                              background: "rgba(16,185,129,0.1)", color: "#10b981",
                              fontWeight: 600, fontSize: "0.78rem", cursor: "pointer",
                              transition: "background 0.2s", whiteSpace: "nowrap",
                              display: "inline-flex", alignItems: "center", gap: "4px"
                            }}
                            onMouseEnter={e => e.currentTarget.style.background = "rgba(16,185,129,0.2)"}
                            onMouseLeave={e => e.currentTarget.style.background = "rgba(16,185,129,0.1)"}
                          >
                            <Download size={12} /> Download
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Invoice Preview Modal ───────────────────────────────────────────── */}
      {preview && (
        <div
          onClick={() => setPreview(null)}
          style={{
            position: "fixed", inset: 0,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            zIndex: 9999,
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "20px",
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "var(--bg-card, #fff)",
              borderRadius: "16px",
              width: "100%", maxWidth: "720px",
              maxHeight: "90vh", overflow: "auto",
              boxShadow: "0 24px 60px rgba(0,0,0,0.3)",
            }}
          >
            {/* Modal header */}
            <div style={{
              padding: "16px 24px",
              borderBottom: "1px solid var(--border-color, #e2e8f0)",
              display: "flex", justifyContent: "space-between", alignItems: "center",
              position: "sticky", top: 0,
              background: "var(--bg-card, #fff)", zIndex: 1,
            }}>
              <h3 style={{ margin: 0, fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem", display: "flex", alignItems: "center", gap: "6px" }}>
                <FileText size={16} /> Invoice Preview — {preview.invoice_number}
              </h3>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => downloadInvoice(preview)}
                  style={{
                    background: "#f97316", color: "white", border: "none",
                    padding: "8px 16px", borderRadius: "8px",
                    fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: "4px"
                  }}
                >
                  <Download size={14} /> Download
                </button>
                <button
                  onClick={() => setPreview(null)}
                  style={{
                    background: "rgba(239,68,68,0.1)", color: "#ef4444", border: "none",
                    padding: "8px 12px", borderRadius: "8px",
                    fontWeight: 700, fontSize: "0.85rem", cursor: "pointer",
                    display: "inline-flex", alignItems: "center", gap: "4px"
                  }}
                >
                  <X size={14} /> Close
                </button>
              </div>
            </div>
            <iframe
              srcDoc={generateInvoiceHTML(preview)}
              style={{ width: "100%", height: "600px", border: "none" }}
              title="Invoice Preview"
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default BuyerInvoices;
