import React, { useEffect, useState } from "react";
import { Shield, Landmark, AlertTriangle, Clock, Lock, CheckCircle, XCircle } from "lucide-react";
import axios from "axios";
import supabase from "../config/SupabaseClient";
import { useNavigate, useSearchParams } from "react-router-dom";

const API = process.env.REACT_APP_API_URL || "http://localhost:5000";

// ── Razorpay script loader ────────────────────────────────────────────────────
const loadRazorpay = () =>
  new Promise((resolve) => {
    if (window.Razorpay) return resolve(true);
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const Payment = () => {
  const [user, setUser] = useState(null);
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(false);
  const [pageLoading, setPageLoading] = useState(true);
  const [paymentState, setPaymentState] = useState("idle"); // idle | processing | success | failed
  const [paymentDetails, setPaymentDetails] = useState(null);
  const [totalPaid, setTotalPaid] = useState(0);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");

  useEffect(() => {
    const init = async () => {
      // Load user
      const { data } = await supabase.auth.getUser();
      setUser(data.user);

      // Load order details if orderId supplied
      if (orderId) {
        const { data: loadData, error } = await supabase
          .from("Load")
          .select("*")
          .eq("load_id", orderId)
          .maybeSingle();

        if (!error && loadData) {
          setOrder(loadData);

          // Fetch payments to calculate total paid amount so far
          const { data: payData } = await supabase
            .from("payments")
            .select("amount")
            .eq("order_id", orderId)
            .eq("status", "success");

          const paidSum = (payData || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0) / 100;
          setTotalPaid(paidSum);
        }
      }
      setPageLoading(false);
    };
    init();
  }, [orderId]);

  // Use seller-assigned buyer amount. Falls back to null → blocks payment.
  const buyerAmount = order?.buyer_amount ? parseFloat(order.buyer_amount) : null;
  // If payment status is marked paid and we have no payments, treat as fully paid
  const adjustedTotalPaid = (totalPaid === 0 && order?.payment_status === 'paid') ? (buyerAmount || 0) : totalPaid;
  const balanceDue = buyerAmount !== null ? Math.max(0, buyerAmount - adjustedTotalPaid) : null;

  const displayAmount  = balanceDue !== null ? balanceDue : 0;
  const taxAmount      = parseFloat((displayAmount * 0.18).toFixed(2));
  const subtotalAmount = parseFloat((displayAmount - taxAmount).toFixed(2));
  const amountNotSet   = orderId && !pageLoading && order && buyerAmount === null;
  const alreadyPaidOff = orderId && !pageLoading && order && buyerAmount !== null && balanceDue === 0;

  const handlePayment = async () => {
    if (!user) { alert("User not loaded yet"); return; }
    if (!displayAmount || displayAmount <= 0) {
      alert("The seller has not assigned a payment amount for this order yet. Please check back later.");
      return;
    }

    const scriptLoaded = await loadRazorpay();
    if (!scriptLoaded) { alert("Razorpay failed to load. Check your internet connection."); return; }

    setLoading(true);
    setPaymentState("processing");

    try {
      const { data } = await axios.post(`${API}/api/payment/create-order`, {
        amount: displayAmount,
        user_id: user.id,
        order_id: orderId || null,
      });

      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID,
        amount: data.amount,
        currency: data.currency || "INR",
        name: "IGNIS SCMS",
        description: order
          ? `Order: ${order.load_id || orderId} — ${order.customer || ""}`
          : "Freight Logistics Service",
        image: "/IGNIS.png",
        order_id: data.id,
        theme: { color: "#f97316" },

        handler: async (response) => {
          try {
            const verifyRes = await axios.post(`${API}/api/payment/verify`, {
              razorpay_order_id:  response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature:  response.razorpay_signature,
              user_id:  user.id,
              amount:   data.amount,
              order_id: orderId || null,
            });
            setPaymentDetails({
              orderId:         response.razorpay_order_id,
              paymentId:       response.razorpay_payment_id,
              amount:          displayAmount,
              invoiceNumber:   verifyRes.data.invoice_number || null,
            });
            setPaymentState("success");
          } catch (err) {
            console.error("Verify error:", err.response?.data || err.message);
            setPaymentState("failed");
          }
          setLoading(false);
        },

        modal: {
          ondismiss: () => {
            setLoading(false);
            setPaymentState("idle");
          },
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on("payment.failed", () => {
        setPaymentState("failed");
        setLoading(false);
      });
      rzp.open();
    } catch (err) {
      console.error("Payment error:", err.response?.data || err.message);
      setPaymentState("failed");
      setLoading(false);
    }
  };

  // ── Success Screen ────────────────────────────────────────────────────────
  if (paymentState === "success") {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{
          background: "var(--bg-card, #fff)",
          border: "1px solid rgba(16,185,129,0.3)",
          borderRadius: "24px",
          padding: "48px 40px",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 16px 48px rgba(16,185,129,0.12)",
        }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%",
            background: "linear-gradient(135deg,#10b981,#34d399)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", margin: "0 auto 24px",
            boxShadow: "0 8px 24px rgba(16,185,129,0.35)",
          }}><CheckCircle size={40} /></div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>
            Payment Successful!
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "24px", fontSize: "0.9rem" }}>
            Your transaction has been processed securely.
          </p>
          {paymentDetails && (
            <div style={{
              background: "rgba(16,185,129,0.06)",
              borderRadius: "12px", padding: "16px",
              marginBottom: "24px", textAlign: "left"
            }}>
              {[
                ["Amount Paid", `₹${paymentDetails.amount.toLocaleString("en-IN")}`],
                ...(paymentDetails.invoiceNumber ? [["Invoice #", paymentDetails.invoiceNumber]] : []),
                ["Payment ID", paymentDetails.paymentId?.slice(0, 24) + "..."],
                ["Order Ref",  paymentDetails.orderId?.slice(0, 24) + "..."],
              ].map(([label, value]) => (
                <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "0.85rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                  <span style={{ fontWeight: 700, color: label === "Invoice #" ? "#f97316" : "var(--text-primary)", fontFamily: label === "Amount Paid" || label === "Invoice #" ? "inherit" : "monospace" }}>{value}</span>
                </div>
              ))}
            </div>
          )}
          <button
            onClick={() => navigate("/orders")}
            style={{
              background: "linear-gradient(135deg,#10b981,#059669)",
              color: "white", border: "none",
              padding: "12px 32px", borderRadius: "10px",
              fontWeight: 700, fontSize: "0.95rem",
              cursor: "pointer", width: "100%",
            }}
          >
            ← Back to Orders
          </button>
        </div>
      </div>
    );
  }

  // ── Failed Screen ─────────────────────────────────────────────────────────
  if (paymentState === "failed") {
    return (
      <div style={{ minHeight: "80vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
        <div style={{
          background: "var(--bg-card, #fff)",
          border: "1px solid rgba(239,68,68,0.3)",
          borderRadius: "24px",
          padding: "48px 40px",
          maxWidth: "480px",
          width: "100%",
          textAlign: "center",
          boxShadow: "0 16px 48px rgba(239,68,68,0.1)",
        }}>
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%",
            background: "linear-gradient(135deg,#ef4444,#f87171)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "white", margin: "0 auto 24px",
            boxShadow: "0 8px 24px rgba(239,68,68,0.3)",
          }}><XCircle size={40} /></div>
          <h2 style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px" }}>
            Payment Failed
          </h2>
          <p style={{ color: "var(--text-secondary)", marginBottom: "28px", fontSize: "0.9rem" }}>
            Something went wrong. Please try again or contact support.
          </p>
          <div style={{ display: "flex", gap: "12px" }}>
            <button
              onClick={() => setPaymentState("idle")}
              style={{
                flex: 1, background: "linear-gradient(135deg,#f97316,#ea580c)",
                color: "white", border: "none",
                padding: "12px", borderRadius: "10px",
                fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
              }}
            >
              Try Again
            </button>
            <button
              onClick={() => navigate("/orders")}
              style={{
                flex: 1, background: "rgba(100,116,139,0.1)",
                color: "var(--text-primary)", border: "1px solid var(--border-color, #e2e8f0)",
                padding: "12px", borderRadius: "10px",
                fontWeight: 600, fontSize: "0.9rem", cursor: "pointer",
              }}
            >
              Back to Orders
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Main Payment Page ─────────────────────────────────────────────────────
  return (
    <div style={{
      minHeight: "80vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "24px",
    }}>
      {/* Background gradient blob */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0,
        background: "radial-gradient(ellipse 60% 50% at 50% 0%, rgba(249,115,22,0.07) 0%, transparent 70%)",
      }} />

      <div style={{
        position: "relative", zIndex: 1,
        background: "var(--bg-card, #fff)",
        border: "1px solid var(--border-color, rgba(249,115,22,0.15))",
        borderRadius: "24px",
        padding: "40px",
        maxWidth: "480px",
        width: "100%",
        boxShadow: "0 16px 48px rgba(0,0,0,0.1)",
      }}>
        {/* Card Header */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "14px",
            background: "linear-gradient(135deg,#f97316,#ea580c)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px",
            boxShadow: "0 6px 16px rgba(249,115,22,0.3)",
          }}><Lock size={24} style={{ color: "white" }} /></div>
          <h2 style={{ margin: 0, fontSize: "1.4rem", fontWeight: 800, color: "var(--text-primary)" }}>
            Secure Checkout
          </h2>
          <p style={{ margin: "6px 0 0", color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Powered by Razorpay • AES-256 encrypted
          </p>
        </div>

        {/* Order Details */}
        {pageLoading ? (
          <div style={{ textAlign: "center", padding: "20px", color: "var(--text-secondary)" }}>Loading order details...</div>
        ) : (
          <div style={{
            background: "var(--bg-primary, #f8fafc)",
            borderRadius: "14px",
            padding: "20px",
            marginBottom: "24px",
            border: "1px solid var(--border-color, #e2e8f0)",
          }}>
            {order && (
              <>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "0.875rem" }}>
                  <span style={{ color: "var(--text-secondary)" }}>Order ID</span>
                  <span style={{ fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace", fontSize: "0.82rem" }}>
                    #{order.load_id || orderId}
                  </span>
                </div>
                {order.customer && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "0.875rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Customer</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{order.customer}</span>
                  </div>
                )}
                {order.pickup && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "0.875rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Route</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)", textAlign: "right", maxWidth: "220px" }}>
                      {order.pickup} → {order.drop || "TBD"}
                    </span>
                  </div>
                )}
                {buyerAmount !== null && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "0.875rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Total Price</span>
                    <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>
                      ₹{buyerAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                {adjustedTotalPaid > 0 && (
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "0.875rem" }}>
                    <span style={{ color: "var(--text-secondary)" }}>Paid Amount</span>
                    <span style={{ fontWeight: 600, color: "#10b981" }}>
                      - ₹{adjustedTotalPaid.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}
                <div style={{ height: "1px", background: "var(--border-color, #e2e8f0)", margin: "14px 0" }} />
              </>
            )}

            {[
              ["Subtotal", `₹${subtotalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
              ["GST (18%)", `₹${taxAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}`],
            ].map(([label, value]) => (
              <div key={label} style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px", fontSize: "0.875rem" }}>
                <span style={{ color: "var(--text-secondary)" }}>{label}</span>
                <span style={{ color: "var(--text-primary)" }}>{value}</span>
              </div>
            ))}

            <div style={{ height: "1px", background: "var(--border-color, #e2e8f0)", margin: "14px 0" }} />

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontWeight: 700, color: "var(--text-primary)", fontSize: "1rem" }}>Total</span>
              <span style={{ fontWeight: 800, color: "#f97316", fontSize: "1.4rem" }}>
                ₹{displayAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>
        )}

        {/* Amount-not-set warning */}
        {amountNotSet && (
          <div style={{
            background: "rgba(245,158,11,0.1)",
            border: "1.5px solid rgba(245,158,11,0.4)",
            borderRadius: "10px",
            padding: "12px 16px",
            marginBottom: "16px",
            fontSize: "0.85rem",
            color: "#92400e",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <AlertTriangle size={16} /> The seller hasn’t assigned a payment amount to this order yet. Please check back later.
          </div>
        )}

        {/* Already fully paid notice */}
        {alreadyPaidOff && (
          <div style={{
            background: "rgba(16,185,129,0.1)",
            border: "1.5px solid rgba(16,185,129,0.4)",
            borderRadius: "10px",
            padding: "12px 16px",
            marginBottom: "16px",
            fontSize: "0.85rem",
            color: "#065f46",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}>
            <CheckCircle size={16} /> This order has already been fully paid. No further payments are required.
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePayment}
          disabled={loading || pageLoading || amountNotSet || alreadyPaidOff}
          style={{
            width: "100%",
            padding: "14px",
            background: loading || amountNotSet
              ? "rgba(249,115,22,0.4)"
              : alreadyPaidOff
                ? "rgba(16,185,129,0.5)"
                : "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
            color: "white",
            border: "none",
            borderRadius: "12px",
            fontSize: "1rem",
            fontWeight: 800,
            cursor: loading || amountNotSet || alreadyPaidOff ? "not-allowed" : "pointer",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "10px",
            letterSpacing: "0.3px",
            boxShadow: loading || amountNotSet || alreadyPaidOff ? "none" : "0 4px 16px rgba(249,115,22,0.35)",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { if (!loading && !amountNotSet && !alreadyPaidOff) e.currentTarget.style.transform = "translateY(-1px)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; }}
        >
          {loading ? (
            <>
              <span style={{ width: "18px", height: "18px", border: "2px solid rgba(255,255,255,0.4)", borderTopColor: "white", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
              Processing...
            </>
          ) : amountNotSet ? (
            <><Clock size={16} /> Awaiting Seller to Set Amount</>
          ) : alreadyPaidOff ? (
            <><CheckCircle size={16} /> Order Fully Paid</>
          ) : (
            <><Lock size={16} /> Pay ₹{displayAmount.toLocaleString("en-IN")} via Razorpay</>
          )}
        </button>

        <div style={{ textAlign: "center", marginTop: "16px", fontSize: "0.78rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}>
          <Shield size={12} /> Secured with 256-bit SSL encryption &nbsp;•&nbsp; <Landmark size={12} /> PCI DSS compliant
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default Payment;