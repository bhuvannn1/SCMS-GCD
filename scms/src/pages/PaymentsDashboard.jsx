import React, { useState, useEffect } from "react";
import { Clock, CreditCard, IndianRupee, X, CheckCircle, Search, FileText, Download, Package } from "lucide-react";
import axios from "axios";
import supabase from "../config/SupabaseClient";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

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

// ─── Invoice Generator ────────────────────────────────────────────────────────
const generateInvoiceHTML = (payment, order = null) => {
  const dateObj = new Date(payment?.created_at || order?.created_at || Date.now());
  const date = dateObj.toLocaleDateString("en-IN", {
    year: "numeric", month: "long", day: "numeric"
  });
  const time = dateObj.toLocaleTimeString("en-IN", {
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true
  });
  const rawAmount = payment?.amount || (order?.buyer_amount ? order.buyer_amount * 100 : (order?.amount || 0));
  const amount = (rawAmount / 100).toFixed(2);
  
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
  const buyerName = order?.customer || order?._buyerProfile?.full_name || "TechGlobal Solutions Inc.";
  const buyerEmail = order?._buyerProfile?.email || "info@techglobalsolutions.com";

  // Transaction hash
  let txHash = "0x7d28c9b3...f92k";
  if (payment?.razorpay_payment_id) {
    const rawId = payment.razorpay_payment_id;
    txHash = `0x${rawId.slice(4, 10)}...${rawId.slice(-4)}`;
  } else if (order?._invoice?.razorpay_payment_id) {
    const rawId = order._invoice.razorpay_payment_id;
    txHash = `0x${rawId.slice(4, 10)}...${rawId.slice(-4)}`;
  }
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
        <div class="inv-num-top">${payment?.invoice_number || order?._invoice?.invoice_number || "INV-2026-364445"}</div>
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
            ${order?.status || "DELIVERED"}
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
            ${order?.drop || "Mumbai"}, Maharashtra - 400001<br/>
            India<br/>
            <strong>GSTIN:</strong> 27BBBCI9876G2Z2<br/>
            <strong>Email:</strong> ${buyerEmail}
          </p>
        </div>
        <div class="party-block">
          <h3>Reference</h3>
          <p style="margin-bottom: 6px;">
            <strong>Load ID:</strong><br/>
            <span style="font-family: monospace; font-size: 0.8rem; color: #475569;">${order?.load_id || "ORD-144319"}</span>
          </p>
          <p style="margin-bottom: 6px;">
            <strong>Razorpay Order:</strong><br/>
            <span style="font-family: monospace; font-size: 0.8rem; color: #475569;">${payment?.razorpay_order_id || order?.razorpay_order_id || "N/A"}</span>
          </p>
          <p style="margin-bottom: 6px;">
            <strong>Payment ID:</strong><br/>
            <span style="font-family: monospace; font-size: 0.8rem; color: #475569;">${payment?.razorpay_payment_id || order?._payment?.razorpay_payment_id || "pay_T1UymZ26zV4bC0"}</span>
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
              <div class="desc-sub">Interstate shipment transport from ${order?.pickup || "North Zone"} to ${order?.drop || "West Zone"}</div>
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

const downloadInvoice = async (payment, order = null) => {
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
  tempDiv.innerHTML = generateInvoiceHTML(payment, order);
  document.body.appendChild(tempDiv);
  
  const invoiceElement = tempDiv.querySelector(".invoice-box");
  invoiceElement.style.boxShadow = "none";
  invoiceElement.style.border = "1px solid #e2e8f0";
  invoiceElement.style.borderRadius = "12px";

  const loadId = payment?.razorpay_order_id || order?.razorpay_order_id || order?.load_id || "INV";
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
  const [profiles, setProfiles] = useState([]);   // all profiles
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

      // 4. Fetch all user profiles
      const { data: profData, error: profErr } = await supabase
        .from("profiles")
        .select("*");

      // Debug: log what came back
      console.log("[PaymentsDashboard] Load rows:", loadData?.length, "| error:", loadErr);
      console.log("[PaymentsDashboard] Payment rows:", payData?.length, "| error:", payErr);
      console.log("[PaymentsDashboard] Invoice rows:", invData?.length, "| error:", invErr);
      console.log("[PaymentsDashboard] Profiles rows:", profData?.length, "| error:", profErr);

      setOrders(loadData || []);
      setPayments(payData || []);
      setInvoices(invData || []);
      setProfiles(profData || []);
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

      // Match buyer profile from load table or matched invoice/payment
      const buyerId = order.buyer_id || matchedInvoice?.buyer_id || matchedPayment?.user_id;
      const buyerProfile = profiles.find(p => p.id === buyerId);

      return {
        ...order,
        _payment: matchedPayment || null,
        _invoice: matchedInvoice || null,
        _buyerProfile: buyerProfile || null,
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
    .reduce((sum, r) => sum + (Number(r.buyer_amount) || 0), 0);

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
          o.load_id === loadId ? { ...o, buyer_amount: amount } : o
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

                      {/* Amount — show buyer_amount if set */}
                      <td style={{ ...tdStyle, fontWeight: 700, color: isPaid ? "#f97316" : "#6366f1" }}>
                        {row.buyer_amount
                          ? `₹${Number(row.buyer_amount).toLocaleString("en-IN", { minimumFractionDigits: 2 })}`
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
                                placeholder={row.buyer_amount || "Enter amount"}
                                value={amountInputs[row.load_id] ?? (row.buyer_amount || "")}
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
                                {savingAmount[row.load_id] ? "..." : row.buyer_amount ? "Update" : "Set"}
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
