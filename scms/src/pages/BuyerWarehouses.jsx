import { useEffect, useState } from "react";
import supabase from "../config/SupabaseClient";
import {
  Plus, Trash2, Star, MapPin, Phone, User, FileText,
  Building2, X, CheckCircle, Pencil, Home
} from "lucide-react";
import KineticLoader from "../components/KineticLoader";

const API_BASE = process.env.REACT_APP_API_URL || "http://localhost:5000";

const emptyForm = {
  name: "",
  address: "",
  city: "",
  state: "",
  pincode: "",
  contact_name: "",
  contact_phone: "",
  notes: "",
  is_default: false,
};

const BuyerWarehouses = () => {
  const [userId, setUserId] = useState(null);
  const [warehouses, setWarehouses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [successMsg, setSuccessMsg] = useState(null);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formLoading, setFormLoading] = useState(false);
  const [formError, setFormError] = useState(null);

  const [deleteConfirmId, setDeleteConfirmId] = useState(null);

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUserId(session.user.id);
        fetchWarehouses(session.user.id);
      }
    };
    init();
  }, []);

  const fetchWarehouses = async (buyerId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/buyer-warehouses?buyer_id=${buyerId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to fetch");
      setWarehouses(data.warehouses || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const showSuccess = (msg) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const openEditModal = (wh) => {
    setEditingId(wh.id);
    setForm({
      name: wh.name || "",
      address: wh.address || "",
      city: wh.city || "",
      state: wh.state || "",
      pincode: wh.pincode || "",
      contact_name: wh.contact_name || "",
      contact_phone: wh.contact_phone || "",
      notes: wh.notes || "",
      is_default: wh.is_default || false,
    });
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleFormChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setFormLoading(true);
    setFormError(null);

    try {
      const payload = { ...form, buyer_id: userId };
      let res;

      if (editingId) {
        res = await fetch(`${API_BASE}/api/buyer-warehouses/${editingId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch(`${API_BASE}/api/buyer-warehouses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to save");

      setIsModalOpen(false);
      fetchWarehouses(userId);
      showSuccess(editingId ? "Warehouse updated successfully!" : "Warehouse added successfully!");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/buyer-warehouses/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete");
      setDeleteConfirmId(null);
      fetchWarehouses(userId);
      showSuccess("Warehouse deleted.");
    } catch (err) {
      setError(err.message);
    }
  };

  const handleSetDefault = async (wh) => {
    try {
      const res = await fetch(`${API_BASE}/api/buyer-warehouses/${wh.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ buyer_id: userId, is_default: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update");
      fetchWarehouses(userId);
      showSuccess(`"${wh.name}" is now your primary delivery destination.`);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) {
    return <KineticLoader message="Loading your warehouses..." />;
  }

  return (
    <div className="page orders" style={{ paddingTop: "24px" }}>
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "24px", flexWrap: "wrap", gap: "16px" }}>
        <div>
          <h2 style={{ margin: "0 0 4px 0", fontSize: "1.6rem", fontWeight: 800, color: "var(--text-primary)" }}>
            My Delivery Destinations
          </h2>
          <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "0.9rem" }}>
            Add warehouses where sellers should drop your deliveries. Sellers will see these when assigning drop locations.
          </p>
        </div>
        <button
          onClick={openAddModal}
          style={{
            display: "inline-flex", alignItems: "center", gap: "8px",
            padding: "11px 20px",
            background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
            color: "white", border: "none", borderRadius: "12px",
            fontWeight: 700, fontSize: "0.9rem", cursor: "pointer",
            boxShadow: "0 4px 14px rgba(249,115,22,0.3)",
            transition: "all 0.2s",
            whiteSpace: "nowrap"
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 20px rgba(249,115,22,0.4)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 4px 14px rgba(249,115,22,0.3)"; }}
        >
          <Plus size={16} /> Add Warehouse
        </button>
      </div>

      {/* Toast messages */}
      {successMsg && (
        <div style={{
          display: "flex", alignItems: "center", gap: "10px",
          background: "linear-gradient(135deg, #d1fae5, #a7f3d0)",
          color: "#065f46", padding: "14px 18px", borderRadius: "12px",
          fontWeight: 600, fontSize: "0.875rem", marginBottom: "20px",
          border: "1px solid #6ee7b7", boxShadow: "0 2px 8px rgba(16,185,129,0.15)"
        }}>
          <CheckCircle size={16} /> {successMsg}
        </div>
      )}
      {error && (
        <div style={{
          background: "#fee2e2", color: "#ef4444", padding: "12px 16px",
          borderRadius: "12px", fontSize: "0.85rem", fontWeight: 600,
          marginBottom: "16px", border: "1px solid #fecaca"
        }}>
          ✗ {error}
          <button onClick={() => setError(null)} style={{ float: "right", background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}>×</button>
        </div>
      )}


      {/* Empty State */}
      {!loading && warehouses.length === 0 && (
        <div style={{
          textAlign: "center", padding: "64px 32px",
          background: "var(--bg-card)", borderRadius: "20px",
          border: "2px dashed var(--border-color, rgba(0,0,0,0.1))"
        }}>
          <div style={{
            width: "72px", height: "72px", borderRadius: "50%",
            background: "linear-gradient(135deg, rgba(249,115,22,0.15) 0%, rgba(234,88,12,0.1) 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px"
          }}>
            <Building2 size={32} color="#f97316" />
          </div>
          <h3 style={{ margin: "0 0 8px 0", color: "var(--text-primary)", fontWeight: 700 }}>
            No Destination Warehouses Yet
          </h3>
          <p style={{ color: "var(--text-secondary)", margin: "0 0 24px 0", maxWidth: "400px", marginLeft: "auto", marginRight: "auto" }}>
            Add warehouses where you want sellers to deliver your goods. 
            Sellers will see these when assigning drop locations for your orders.
          </p>
          <button
            onClick={openAddModal}
            style={{
              display: "inline-flex", alignItems: "center", gap: "8px",
              padding: "12px 24px",
              background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
              color: "white", border: "none", borderRadius: "12px",
              fontWeight: 700, cursor: "pointer",
              boxShadow: "0 4px 14px rgba(249,115,22,0.3)"
            }}
          >
            <Plus size={16} /> Add Your First Warehouse
          </button>
        </div>
      )}

      {/* Warehouse Cards Grid */}
      {!loading && warehouses.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "18px" }}>
          {warehouses.map((wh) => (
            <div
              key={wh.id}
              style={{
                background: "var(--bg-card)",
                borderRadius: "18px",
                border: wh.is_default
                  ? "2px solid #f97316"
                  : "1px solid var(--border-color, rgba(0,0,0,0.08))",
                padding: "20px",
                boxShadow: wh.is_default
                  ? "0 4px 20px rgba(249,115,22,0.2)"
                  : "0 2px 12px rgba(0,0,0,0.06)",
                position: "relative",
                transition: "all 0.2s",
              }}
            >
              {/* Default badge */}
              {wh.is_default && (
                <div style={{
                  position: "absolute", top: "16px", right: "16px",
                  background: "linear-gradient(135deg, #f97316, #ea580c)",
                  color: "white", fontSize: "0.7rem", fontWeight: 700,
                  padding: "3px 10px", borderRadius: "20px",
                  display: "flex", alignItems: "center", gap: "4px",
                  letterSpacing: "0.03em"
                }}>
                  <Star size={11} fill="white" /> PRIMARY
                </div>
              )}

              {/* Warehouse name */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "16px" }}>
                <div style={{
                  width: "42px", height: "42px", borderRadius: "12px",
                  background: wh.is_default
                    ? "linear-gradient(135deg, #f97316, #ea580c)"
                    : "var(--accent-bg, rgba(249,115,22,0.1))",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  flexShrink: 0
                }}>
                  {wh.is_default
                    ? <Home size={20} color="white" />
                    : <Building2 size={20} color="#f97316" />
                  }
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--text-primary)" }}>
                    {wh.name}
                  </h3>
                  <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    {wh.city}{wh.state ? `, ${wh.state}` : ""}
                  </span>
                </div>
              </div>

              {/* Details */}
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "18px" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                  <MapPin size={14} color="#f97316" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)", lineHeight: 1.4 }}>
                    {wh.address}{wh.pincode ? ` – ${wh.pincode}` : ""}
                  </span>
                </div>
                {(wh.contact_name || wh.contact_phone) && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <User size={14} color="#f97316" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                      {wh.contact_name || "—"}
                      {wh.contact_phone && (
                        <span> · <Phone size={11} style={{ verticalAlign: "middle" }} /> {wh.contact_phone}</span>
                      )}
                    </span>
                  </div>
                )}
                {wh.notes && (
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-start" }}>
                    <FileText size={14} color="#f97316" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <span style={{ fontSize: "0.82rem", color: "var(--text-secondary)", fontStyle: "italic", lineHeight: 1.4 }}>
                      {wh.notes}
                    </span>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                {!wh.is_default && (
                  <button
                    onClick={() => handleSetDefault(wh)}
                    title="Set as Primary Warehouse"
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                      padding: "8px 12px", borderRadius: "10px",
                      border: "1px solid rgba(249,115,22,0.35)",
                      background: "rgba(249,115,22,0.07)",
                      color: "#f97316", fontWeight: 600, fontSize: "0.82rem",
                      cursor: "pointer", transition: "all 0.2s",
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = "rgba(249,115,22,0.15)"}
                    onMouseLeave={e => e.currentTarget.style.background = "rgba(249,115,22,0.07)"}
                  >
                    <Star size={13} /> Set Primary
                  </button>
                )}
                <button
                  onClick={() => openEditModal(wh)}
                  title="Edit"
                  style={{
                    flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px",
                    padding: "8px 12px", borderRadius: "10px",
                    border: "1px solid var(--border-color, rgba(0,0,0,0.1))",
                    background: "transparent",
                    color: "var(--text-secondary)", fontWeight: 600, fontSize: "0.82rem",
                    cursor: "pointer", transition: "all 0.2s",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "var(--accent-bg)"; e.currentTarget.style.color = "#f97316"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
                >
                  <Pencil size={13} /> Edit
                </button>
                <button
                  onClick={() => setDeleteConfirmId(wh.id)}
                  title="Delete"
                  style={{
                    padding: "8px 12px", borderRadius: "10px",
                    border: "1px solid rgba(239,68,68,0.25)",
                    background: "rgba(239,68,68,0.06)",
                    color: "#ef4444", fontWeight: 600, fontSize: "0.82rem",
                    cursor: "pointer", transition: "all 0.2s",
                    display: "flex", alignItems: "center", gap: "6px"
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = "rgba(239,68,68,0.15)"}
                  onMouseLeave={e => e.currentTarget.style.background = "rgba(239,68,68,0.06)"}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirmId && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(15,23,42,0.55)",
          backdropFilter: "blur(6px)",
          zIndex: 9999, display: "flex",
          alignItems: "center", justifyContent: "center"
        }}>
          <div style={{
            background: "var(--bg-card)", borderRadius: "20px",
            padding: "28px 32px", maxWidth: "380px", width: "90%",
            boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
            border: "1px solid var(--border-color)",
            textAlign: "center"
          }}>
            <div style={{
              width: "52px", height: "52px", borderRadius: "50%",
              background: "rgba(239,68,68,0.1)", margin: "0 auto 16px",
              display: "flex", alignItems: "center", justifyContent: "center"
            }}>
              <Trash2 size={24} color="#ef4444" />
            </div>
            <h3 style={{ margin: "0 0 8px 0", fontWeight: 700, color: "var(--text-primary)" }}>Delete Warehouse?</h3>
            <p style={{ margin: "0 0 24px 0", color: "var(--text-secondary)", fontSize: "0.875rem" }}>
              This will permanently remove this delivery destination. This action cannot be undone.
            </p>
            <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
              <button
                onClick={() => setDeleteConfirmId(null)}
                style={{
                  padding: "10px 20px", borderRadius: "10px",
                  border: "1px solid var(--border-color)",
                  background: "transparent", cursor: "pointer",
                  fontWeight: 600, color: "var(--text-secondary)"
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(deleteConfirmId)}
                style={{
                  padding: "10px 20px", borderRadius: "10px",
                  background: "#ef4444", border: "none",
                  color: "white", fontWeight: 700, cursor: "pointer"
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Modal */}
      {isModalOpen && (
        <div style={{
          position: "fixed", inset: 0,
          background: "rgba(15,23,42,0.55)",
          backdropFilter: "blur(8px)",
          zIndex: 9999, display: "flex",
          alignItems: "center", justifyContent: "center",
          padding: "20px"
        }}>
          <div style={{
            background: "var(--bg-card)", borderRadius: "24px",
            width: "100%", maxWidth: "560px",
            padding: "32px",
            boxShadow: "0 24px 60px rgba(0,0,0,0.18)",
            border: "1px solid var(--border-color)",
            maxHeight: "90vh", overflowY: "auto",
            position: "relative"
          }}>
            {/* Close button */}
            <button
              onClick={() => setIsModalOpen(false)}
              style={{
                position: "absolute", top: "20px", right: "20px",
                background: "var(--bg-hover, rgba(0,0,0,0.06))",
                border: "none", borderRadius: "50%",
                width: "32px", height: "32px",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "var(--text-secondary)"
              }}
            >
              <X size={16} />
            </button>

            <div style={{ marginBottom: "24px" }}>
              <h3 style={{ margin: "0 0 4px 0", fontSize: "1.2rem", fontWeight: 800, color: "var(--text-primary)" }}>
                {editingId ? "Edit Destination Warehouse" : "Add Destination Warehouse"}
              </h3>
              <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--text-secondary)" }}>
                Sellers will see these locations when creating delivery orders for you.
              </p>
            </div>

            {formError && (
              <div style={{
                padding: "12px 16px", background: "#fee2e2", color: "#ef4444",
                borderRadius: "12px", fontSize: "0.85rem", fontWeight: 600,
                marginBottom: "16px", border: "1px solid #fecaca"
              }}>
                ✗ {formError}
              </div>
            )}

            <form onSubmit={handleFormSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Warehouse Name */}
              <div>
                <label style={labelStyle}>Warehouse / Location Name *</label>
                <input
                  type="text" required
                  value={form.name}
                  onChange={e => handleFormChange("name", e.target.value)}
                  placeholder='e.g. "Main Warehouse", "Chennai Distribution Center"'
                  style={inputStyle}
                />
              </div>

              {/* Address */}
              <div>
                <label style={labelStyle}>Full Address *</label>
                <input
                  type="text" required
                  value={form.address}
                  onChange={e => handleFormChange("address", e.target.value)}
                  placeholder="Plot No. 12, Industrial Area..."
                  style={inputStyle}
                />
              </div>

              {/* City / State / Pincode */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>City *</label>
                  <input
                    type="text" required
                    value={form.city}
                    onChange={e => handleFormChange("city", e.target.value)}
                    placeholder="Chennai"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>State</label>
                  <input
                    type="text"
                    value={form.state}
                    onChange={e => handleFormChange("state", e.target.value)}
                    placeholder="Tamil Nadu"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>PIN Code</label>
                  <input
                    type="text"
                    value={form.pincode}
                    onChange={e => handleFormChange("pincode", e.target.value)}
                    placeholder="600001"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Contact */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                <div>
                  <label style={labelStyle}>Contact Person</label>
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={e => handleFormChange("contact_name", e.target.value)}
                    placeholder="Ravi Kumar"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Contact Phone</label>
                  <input
                    type="tel"
                    value={form.contact_phone}
                    onChange={e => handleFormChange("contact_phone", e.target.value)}
                    placeholder="+91 98765 43210"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={labelStyle}>Special Instructions / Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => handleFormChange("notes", e.target.value)}
                  placeholder='e.g. "Deliveries accepted Mon-Sat, 9AM–6PM only"'
                  rows={3}
                  style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                />
              </div>

              {/* Is Default */}
              <label style={{
                display: "flex", alignItems: "center", gap: "10px",
                cursor: "pointer", padding: "12px 16px",
                borderRadius: "12px",
                border: form.is_default ? "1px solid #f97316" : "1px solid var(--border-color, #e2e8f0)",
                background: form.is_default ? "rgba(249,115,22,0.07)" : "transparent",
                transition: "all 0.2s"
              }}>
                <input
                  type="checkbox"
                  checked={form.is_default}
                  onChange={e => handleFormChange("is_default", e.target.checked)}
                  style={{ width: "16px", height: "16px", accentColor: "#f97316" }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: "0.875rem", color: "var(--text-primary)" }}>
                    Set as Primary Delivery Destination
                  </div>
                  <div style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                    Sellers will see this as your preferred drop location
                  </div>
                </div>
              </label>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  style={{
                    padding: "11px 20px", borderRadius: "12px",
                    border: "1px solid var(--border-color, #cbd5e1)",
                    background: "transparent", cursor: "pointer",
                    fontWeight: 600, color: "var(--text-secondary)"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formLoading}
                  style={{
                    padding: "11px 24px", borderRadius: "12px",
                    border: "none",
                    background: "linear-gradient(135deg, #f97316 0%, #ea580c 100%)",
                    color: "white", fontWeight: 700, cursor: formLoading ? "not-allowed" : "pointer",
                    opacity: formLoading ? 0.7 : 1
                  }}
                >
                  {formLoading ? "Saving..." : editingId ? "Update Warehouse" : "Add Warehouse"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const labelStyle = {
  display: "block",
  fontSize: "0.72rem",
  fontWeight: 700,
  textTransform: "uppercase",
  color: "#64748b",
  marginBottom: "6px",
  letterSpacing: "0.04em"
};

const inputStyle = {
  width: "100%",
  padding: "11px 14px",
  borderRadius: "10px",
  border: "1px solid var(--border-color, #cbd5e1)",
  outline: "none",
  fontSize: "0.875rem",
  background: "var(--bg-input, #ffffff)",
  color: "var(--text-primary)",
  boxSizing: "border-box",
  transition: "border-color 0.2s"
};

export default BuyerWarehouses;
