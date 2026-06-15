import React, { useState, useEffect } from "react";
import { Clock, FileText, Download, X } from "lucide-react";
import supabase from "../config/SupabaseClient";
import KineticLoader from "../components/KineticLoader";

// Helper to convert number to Indian Rupees words
const amountInWords = (num) => {
  const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const numToWords = (n) => {
    if (n < 20) return a[n];
    const digit = n % 10;
    return b[Math.floor(n / 10)] + (digit ? ' ' + a[digit] : '');
  };

  const convert = (n) => {
    if (n === 0) return 'Zero';
    let str = '';
    
    // Crores
    const crore = Math.floor(n / 10000000);
    if (crore > 0) {
      str += numToWords(crore) + ' Crore ';
      n %= 10000000;
    }
    
    // Lakhs
    const lakh = Math.floor(n / 100000);
    if (lakh > 0) {
      str += numToWords(lakh) + ' Lakh ';
      n %= 100000;
    }
    
    // Thousands
    const thousand = Math.floor(n / 1000);
    if (thousand > 0) {
      str += numToWords(thousand) + ' Thousand ';
      n %= 1000;
    }
    
    // Hundreds
    const hundred = Math.floor(n / 100);
    if (hundred > 0) {
      str += numToWords(hundred) + ' Hundred ';
      n %= 100;
    }
    
    // Tens & Ones
    if (n > 0) {
      if (str !== '') str += 'and ';
      if (n < 20) str += a[n];
      else {
        str += b[Math.floor(n / 10)];
        if (n % 10) str += ' ' + a[n % 10];
      }
    }
    
    return str.trim();
  };

  const parts = parseFloat(num).toFixed(2).split('.');
  const rupees = parseInt(parts[0], 10);
  const paise = parseInt(parts[1], 10);
  
  let result = convert(rupees) + ' Rupees';
  if (paise > 0) {
    result += ' and ' + convert(paise) + ' Paise';
  }
  return result + ' Only';
};

// ── Invoice HTML generator (mirrors seller's invoice) ────────────────────────
const generateInvoiceHTML = (inv) => {
  const dateObj = new Date(inv.created_at || Date.now());
  const date = dateObj.toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric",
  });
  const time = dateObj.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  });
  const amount = (inv.amount / 100).toFixed(2);
  
  // Calculate GST inclusive breakdown
  const subtotalVal = parseFloat((amount / 1.18).toFixed(2));
  const cgstVal = parseFloat((subtotalVal * 0.09).toFixed(2));
  const sgstVal = parseFloat((parseFloat(amount) - subtotalVal - cgstVal).toFixed(2));
  
  const subtotal = subtotalVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const cgst = cgstVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const sgst = sgstVal.toLocaleString("en-IN", { minimumFractionDigits: 2 });
  const totalDisplay = parseFloat(amount).toLocaleString("en-IN", { minimumFractionDigits: 2 });
  
  const words = amountInWords(amount);

  // Dynamic buyer details
  const buyerName = inv._load?.customer || inv._profile?.full_name || "TechGlobal Solutions Inc.";
  const buyerEmail = inv._profile?.email || "info@techglobalsolutions.com";

  // Transaction hash
  let txHash = "0x7d28c9b3...f92k";
  if (inv.razorpay_payment_id) {
    const rawId = inv.razorpay_payment_id;
    txHash = `0x${rawId.slice(4, 10)}...${rawId.slice(-4)}`;
  }

  // Verification URL & QR code
  const verificationUrl = `${window.location.origin}/buyer/invoices?verifyPaymentId=${inv.razorpay_payment_id || "pay_T1UymZ26zV4bC0"}`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>Tax Invoice</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; background: #ffffff; color: #1e293b; padding: 30px; }
    .invoice-box { max-width: 800px; margin: auto; background: white; border: 1.5px solid #e2e8f0; border-radius: 16px; overflow: hidden; position: relative; }
    
    .inv-header { background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; color: white; border-top-left-radius: 12px; border-top-right-radius: 12px; }
    .logo-section { display: flex; align-items: center; gap: 12px; }
    .logo-bg { background: rgba(255, 255, 255, 0.18); border-radius: 8px; width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; }
    .logo-text { font-size: 1.6rem; font-weight: 800; color: white; letter-spacing: -0.5px; }
    .logo-sub { font-size: 0.72rem; color: rgba(255, 255, 255, 0.9); margin-top: 2px; text-transform: uppercase; font-weight: 700; letter-spacing: 0.5px; }
    
    .inv-title-section { text-align: right; }
    .inv-num-top { font-size: 1.2rem; font-weight: 700; color: white; margin-bottom: 8px; }
    .badge-row { display: flex; gap: 8px; justify-content: flex-end; align-items: center; }
    .badge { display: inline-flex; align-items: center; padding: 4px 10px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; color: white; gap: 4px; }
    .date-badge { background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); }
    .paid-badge { background: #10b981; }
    .status-badge { background: #3b82f6; }
    
    .inv-body { padding: 40px; }
    .inv-parties { display: grid; grid-template-columns: 1.1fr 1.1fr 0.8fr; gap: 24px; margin-bottom: 36px; }
    .party-block {}
    .party-block h3 { font-size: 0.72rem; text-transform: uppercase; letter-spacing: 1px; color: #ea580c; margin-bottom: 10px; border-bottom: 1.5px solid #ffedd5; padding-bottom: 4px; font-weight: 800; }
    .party-block strong { font-size: 0.92rem; display: block; margin-bottom: 4px; color: #0f172a; }
    .party-block p { font-size: 0.8rem; color: #475569; line-height: 1.5; }
    
    table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
    thead th { background: #fff7ed; padding: 10px 14px; text-align: left; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.5px; color: #ea580c; font-weight: 800; border-top: 1.5px solid #ffedd5; border-bottom: 2px solid #f97316; }
    tbody td { padding: 14px; font-size: 0.85rem; border-bottom: 1.5px solid #f1f5f9; color: #334155; vertical-align: top; }
    .desc-main { font-weight: 600; color: #0f172a; }
    .desc-sub { font-size: 0.75rem; color: #64748b; margin-top: 3px; font-style: italic; }
    
    .inv-bottom { display: grid; grid-template-columns: 1.1fr 1fr; gap: 32px; margin-bottom: 28px; }
    .bottom-left { display: flex; flex-direction: column; justify-content: center; }
    
    .stamp-container { position: relative; margin-bottom: 12px; }
    .paid-stamp { border: 3px dashed #ea580c; color: #ea580c; font-size: 1.4rem; font-weight: 900; letter-spacing: 2px; padding: 6px 16px; border-radius: 8px; transform: rotate(-8deg); display: inline-block; background: rgba(249, 115, 22, 0.04); }
    .hash-box { font-family: 'Courier New', Courier, monospace; font-size: 0.72rem; color: #64748b; background: #f8fafc; border: 1.5px dashed #e2e8f0; padding: 6px 10px; border-radius: 6px; display: inline-block; }
    
    .totals-table { width: 100%; }
    .totals-table tr td { padding: 6px 0; font-size: 0.85rem; border: none; color: #475569; }
    .totals-table tr td:last-child { text-align: right; font-weight: 600; color: #1e293b; }
    .totals-table .grand-total td { font-size: 1.1rem; font-weight: 800; color: #ea580c; border-top: 2px solid #f97316; padding-top: 10px; }
    .in-words { font-size: 0.75rem; color: #ea580c; font-weight: 700; margin-top: 6px; text-align: right; font-style: italic; }
    
    .inv-details-bottom { display: grid; grid-template-columns: 1.1fr 0.9fr; gap: 24px; background: #fff7ed; padding: 20px; border-radius: 12px; border: 1.5px solid #ffedd5; }
    .details-block h4 { font-size: 0.72rem; text-transform: uppercase; color: #ea580c; margin-bottom: 8px; font-weight: 800; letter-spacing: 0.5px; }
    .details-block p { font-size: 0.75rem; color: #475569; line-height: 1.5; }
    .details-block ul { font-size: 0.75rem; color: #475569; padding-left: 12px; line-height: 1.5; }
    .details-block li { margin-bottom: 4px; }
    
    .inv-footer { padding: 16px 40px; background: #fafafa; border-top: 1.5px solid #e2e8f0; display: flex; justify-content: space-between; font-size: 0.72rem; color: #94a3b8; }
  </style>
</head>
<body>
  <div class="invoice-box">
    <div class="inv-header">
      <div class="logo-section">
        <div class="logo-bg">
          <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color: white; fill: white;"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg>
        </div>
        <div>
          <div class="logo-text">IGNIS</div>
          <div class="logo-sub">Supply Chain Management System</div>
        </div>
      </div>
      <div class="inv-title-section">
        <div class="inv-num-top">${inv.invoice_number || "INV-2026-364445"}</div>
        <div class="badge-row">
          <span class="badge date-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            ${date}
          </span>
          <span class="badge paid-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            PAID
          </span>
          <span class="badge status-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>
            ${inv._load?.status || "DELIVERED"}
          </span>
        </div>
      </div>
    </div>
    <div class="inv-body">
      <div class="inv-parties">
        <div class="party-block">
          <h3>From</h3>
          <strong>IGNIS Logistics Global HQ</strong>
          <p>
            12th Floor, Obsidian Tower<br/>
            Cyber City, DLF Phase 2<br/>
            Gurgaon, Haryana - 122002<br/>
            India<br/>
            <strong>GSTIN:</strong> 27AAAC11234F1Z1<br/>
            <strong>Email:</strong> billing@ignislogistics.com
          </p>
        </div>
        <div class="party-block">
          <h3>Bill To</h3>
          <strong>${buyerName}</strong>
          <p>
            Acme Warehouse #44<br/>
            Portside Industrial Area<br/>
            ${inv._load?.drop || "Mumbai"}, Maharashtra - 400001<br/>
            India<br/>
            <strong>GSTIN:</strong> 27BBBCI9876G2Z2<br/>
            <strong>Email:</strong> ${buyerEmail}
          </p>
        </div>
        <div class="party-block">
          <h3>Reference</h3>
          <p style="margin-bottom: 6px;">
            <strong>Load ID:</strong><br/>
            <span style="font-family: monospace; font-size: 0.8rem; color: #475569;">${inv.load_id || "ORD-144319"}</span>
          </p>
          <p style="margin-bottom: 6px;">
            <strong>Razorpay Order:</strong><br/>
            <span style="font-family: monospace; font-size: 0.8rem; color: #475569;">${inv.razorpay_order_id || "N/A"}</span>
          </p>
          <p style="margin-bottom: 6px;">
            <strong>Payment ID:</strong><br/>
            <span style="font-family: monospace; font-size: 0.8rem; color: #475569;">${inv.razorpay_payment_id || "pay_T1UymZ26zV4bC0"}</span>
          </p>
        </div>
      </div>
      
      <table>
        <thead>
          <tr>
            <th style="width: 8%">#</th>
            <th style="width: 47%">Description</th>
            <th style="width: 15%">HSN Code</th>
            <th style="width: 10%">Qty</th>
            <th style="width: 20%; text-align: right;">Rate</th>
            <th style="width: 20%; text-align: right;">Amount</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>1</td>
            <td>
              <div class="desc-main">Freight Logistics Service</div>
              <div class="desc-sub">Interstate shipment transport from ${inv._load?.pickup || "North Zone"} to ${inv._load?.drop || "West Zone"}</div>
            </td>
            <td>9965</td>
            <td>1.00</td>
            <td style="text-align: right;">₹${subtotal}</td>
            <td style="text-align: right;">₹${subtotal}</td>
          </tr>
        </tbody>
      </table>
      
      <div class="inv-bottom">
        <div class="bottom-left">
          <div style="display: flex; gap: 20px; align-items: center;">
            <div class="stamp-container">
              <div class="paid-stamp">PAID</div>
            </div>
          </div>
          <div class="hash-box" style="margin-top: 15px;">
            <strong>Transaction Hash:</strong><br/>
            ${txHash}
          </div>
        </div>
        <div>
          <table class="totals-table">
            <tr>
              <td>Subtotal</td>
              <td>₹${subtotal}</td>
            </tr>
            <tr>
              <td>CGST @ 9%</td>
              <td>₹${cgst}</td>
            </tr>
            <tr>
              <td>SGST @ 9%</td>
              <td>₹${sgst}</td>
            </tr>
            <tr class="grand-total">
              <td>Total Payable</td>
              <td>₹${totalDisplay}</td>
            </tr>
          </table>
          <div class="in-words">Amount in words: ${words}</div>
        </div>
      </div>
      
      <div class="inv-details-bottom">
        <div class="details-block">
          <h4>Bank Details</h4>
          <p>
            <strong>Bank:</strong> HDFC Corporate Banking<br/>
            <strong>A/C Name:</strong> IGNIS LOGISTICS PVT LTD<br/>
            <strong>A/C Number:</strong> 50200012345678<br/>
            <strong>IFSC Code:</strong> HDFC0001234
          </p>
        </div>
        <div class="details-block">
          <h4>Terms & Conditions</h4>
          <ul>
            <li>Payment is non-refundable once service is executed.</li>
            <li>This is a computer-generated invoice and requires no physical signature.</li>
            <li>Subject to Gurgaon jurisdiction only.</li>
          </ul>
        </div>
      </div>
    </div>
    <div class="inv-footer">
      <p>Thank you for your business!</p>
      <p>Generated by IGNIS SCMS • ${date} ${time}</p>
    </div>
  </div>
</body>
</html>`;
};

const loadHtml2Pdf = () => {
  return new Promise((resolve) => {
    if (window.html2pdf) {
      resolve(window.html2pdf);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js";
    script.onload = () => resolve(window.html2pdf);
    script.onerror = () => {
      console.error("Failed to load html2pdf CDN");
      resolve(null);
    };
    document.body.appendChild(script);
  });
};

const downloadInvoice = async (inv) => {
  const html2pdf = await loadHtml2Pdf();
  if (!html2pdf) {
    alert("PDF library failed to load. Please try downloading again.");
    return;
  }
  
  const tempDiv = document.createElement("div");
  // Position offscreen so it compiles and resolves CSS layout properly
  tempDiv.style.position = "absolute";
  tempDiv.style.left = "-9999px";
  tempDiv.style.top = "-9999px";
  tempDiv.innerHTML = generateInvoiceHTML(inv);
  document.body.appendChild(tempDiv);
  
  const invoiceElement = tempDiv.querySelector(".invoice-box");
  invoiceElement.style.boxShadow = "none";
  invoiceElement.style.border = "1px solid #e2e8f0";
  invoiceElement.style.borderRadius = "12px";

  const loadId = inv.invoice_number || inv.id || "INV";
  const opt = {
    margin:       [10, 10, 10, 10],
    filename:     `IGNIS-Invoice-${loadId}.pdf`,
    image:        { type: 'jpeg', quality: 0.98 },
    html2canvas:  { scale: 2, useCORS: true, logging: false },
    jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
  };

  try {
    await html2pdf().from(invoiceElement).set(opt).save();
  } catch (err) {
    console.error("PDF generation failed:", err);
  } finally {
    document.body.removeChild(tempDiv);
  }
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

      // Fetch buyer profile for the logged in user
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      // Fetch buyer loads to get route and customer details
      const { data: loads } = await supabase
        .from("Load")
        .select("*")
        .eq("buyer_id", session.user.id);

      // Map profiles and loads to invoices
      const mappedInvoices = (data || []).map(inv => {
        const matchedLoad = (loads || []).find(l => l.load_id === inv.load_id);
        return {
          ...inv,
          _profile: profile || null,
          _load: matchedLoad || null
        };
      });

      setInvoices(mappedInvoices);
      setLoading(false);
    };
    fetchInvoices();
  }, []);

  const fmt = (n) =>
    Number(n / 100).toLocaleString("en-IN", { minimumFractionDigits: 2 });

  if (loading) {
    return <KineticLoader message="Loading your invoices..." />;
  }

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
