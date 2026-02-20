"use client";

import { useState } from "react";
import type { EmployeeContact } from "@/lib/helpers";
import { posLabel, shortBranch } from "@/lib/helpers";

const COLORS = ["#22c55e", "#facc15", "#4ade80", "#fbbf24", "#22d3ee", "#a78bfa"];

type EnrichedContact = EmployeeContact & { branch_name: string; position: string };

function InfoRow({ icon, label, value, accent }: { icon: string; label: string; value: string | null; accent?: string }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "5px 0" }}>
      <span style={{ fontSize: 14, width: 20, textAlign: "center", flexShrink: 0 }}>{icon}</span>
      <span style={{ fontSize: 10, color: "#636363", minWidth: 70, textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: 13, color: accent || "#e5e5e5", wordBreak: "break-word" }}>{value}</span>
    </div>
  );
}

function PositionBadge({ position }: { position: string }) {
  const cls =
    position === "manager" || position === "assistant_manager" ? "badge-manager"
    : position === "it_technician" ? "badge-it"
    : position === "security" ? "badge-security"
    : "badge-default";
  return <span className={`badge ${cls}`} style={{ fontSize: 10 }}>{posLabel[position] || position}</span>;
}

function StaffCard({ c }: { c: EnrichedContact }) {
  const hasContact = c.phone || c.email || c.mobile_money_number;
  const hasPersonal = c.home_address || c.nrc_number || c.tpin || c.date_started;
  const hasBank = c.bank_name || c.bank_account_number || c.social_security_number;
  const hasEmergency = c.emergency_contact_name || c.emergency_contact_phone;

  // Calculate completeness
  const fields = [c.phone, c.email, c.mobile_money_number, c.home_address, c.emergency_contact_phone];
  const filled = fields.filter(Boolean).length;
  const pct = Math.round((filled / fields.length) * 100);

  return (
    <div style={{
      background: "#111111",
      border: "1px solid #2a2a2a",
      borderRadius: 12,
      overflow: "hidden",
      transition: "border-color 0.2s",
    }}
    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#3a3a3a")}
    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2a2a2a")}
    >
      {/* Header */}
      <div style={{
        padding: "14px 16px 12px",
        borderBottom: "1px solid #1e1e1e",
        display: "flex", justifyContent: "space-between", alignItems: "flex-start",
      }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: "#f5f5f5", marginBottom: 4 }}>{c.full_name}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: "#a3a3a3" }}>{shortBranch(c.branch_name)}</span>
            <PositionBadge position={c.position} />
          </div>
        </div>
        {/* Completeness indicator */}
        <div style={{ textAlign: "right" }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            border: `2px solid ${pct >= 80 ? "#4ade80" : pct >= 40 ? "#facc15" : "#636363"}`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 700,
            color: pct >= 80 ? "#4ade80" : pct >= 40 ? "#facc15" : "#636363",
          }}>
            {pct}%
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "10px 16px 14px" }}>
        {/* Contact */}
        {hasContact && (
          <div style={{ marginBottom: 8 }}>
            <InfoRow icon="📱" label="Phone" value={c.phone} />
            <InfoRow icon="💰" label="MoMo" value={c.mobile_money_number} accent="#facc15" />
            <InfoRow icon="✉️" label="Email" value={c.email} accent="#22d3ee" />
          </div>
        )}

        {/* Address */}
        {c.home_address && (
          <div style={{ marginBottom: 8 }}>
            <InfoRow icon="📍" label="Address" value={c.home_address} />
          </div>
        )}

        {/* IDs */}
        {(c.nrc_number || c.tpin) && (
          <div style={{ marginBottom: 8 }}>
            <InfoRow icon="🪪" label="NRC" value={c.nrc_number} />
            <InfoRow icon="🏛️" label="TPIN" value={c.tpin} />
          </div>
        )}

        {/* Bank */}
        {hasBank && (
          <div style={{ marginBottom: 8 }}>
            <InfoRow icon="🏦" label="Bank" value={c.bank_name ? `${c.bank_name}${c.bank_account_number ? " — " + c.bank_account_number : ""}` : c.bank_account_number} />
            <InfoRow icon="🔐" label="SSN" value={c.social_security_number} />
          </div>
        )}

        {/* Emergency */}
        {hasEmergency && (
          <div style={{
            marginTop: 6, padding: "8px 10px", borderRadius: 8,
            background: "#1a0a0a", border: "1px solid #2a1a1a",
          }}>
            <div style={{ fontSize: 10, color: "#f87171", fontWeight: 600, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.04em" }}>
              🚨 Emergency Contact
            </div>
            {c.emergency_contact_name && (
              <div style={{ fontSize: 13, color: "#e5e5e5" }}>{c.emergency_contact_name}</div>
            )}
            {c.emergency_contact_phone && (
              <div style={{ fontSize: 12, color: "#a3a3a3", marginTop: 2 }}>{c.emergency_contact_phone}</div>
            )}
          </div>
        )}

        {/* Start date */}
        {c.date_started && (
          <div style={{ marginTop: 8, fontSize: 11, color: "#636363" }}>
            📅 Started {new Date(c.date_started).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
          </div>
        )}

        {/* Empty state */}
        {!hasContact && !hasPersonal && !hasBank && !hasEmergency && (
          <div style={{ padding: "8px 0", color: "#636363", fontSize: 12, fontStyle: "italic" }}>
            No contact details on file yet.
          </div>
        )}
      </div>
    </div>
  );
}

export default function StaffDirectory({
  contacts, branchNames,
}: {
  contacts: EnrichedContact[];
  branchNames: string[];
}) {
  const [branch, setBranch] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = contacts
    .filter((c) => !branch || c.branch_name === branch)
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.full_name.toLowerCase().includes(q) ||
        (c.phone || "").includes(q) ||
        (c.email || "").toLowerCase().includes(q) ||
        (c.home_address || "").toLowerCase().includes(q) ||
        (c.mobile_money_number || "").includes(q) ||
        (c.emergency_contact_name || "").toLowerCase().includes(q)
      );
    })
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  // Stats
  const total = filtered.length;
  const withPhone = filtered.filter((c) => c.phone).length;
  const withEmail = filtered.filter((c) => c.email).length;
  const withAddress = filtered.filter((c) => c.home_address).length;
  const withMomo = filtered.filter((c) => c.mobile_money_number).length;
  const withEmergency = filtered.filter((c) => c.emergency_contact_phone).length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>
            📇 Staff Directory — {total} employees
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "#636363" }}>
            Contact details, addresses, bank info & emergency contacts
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search name, phone, email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-lg text-[13px] w-64 outline-none"
            style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}
          />
          {branch && (
            <button onClick={() => setBranch(null)} className="chip">✕ Clear</button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex gap-3 flex-wrap">
        <div className="chart-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#636363" }}>📱 Phone:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: withPhone === total ? "#4ade80" : "#facc15" }}>{withPhone}/{total}</span>
        </div>
        <div className="chart-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#636363" }}>💰 MoMo:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: withMomo === total ? "#4ade80" : "#facc15" }}>{withMomo}/{total}</span>
        </div>
        <div className="chart-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#636363" }}>✉️ Email:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: withEmail === total ? "#4ade80" : "#facc15" }}>{withEmail}/{total}</span>
        </div>
        <div className="chart-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#636363" }}>📍 Address:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: withAddress === total ? "#4ade80" : "#facc15" }}>{withAddress}/{total}</span>
        </div>
        <div className="chart-card" style={{ padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: "#636363" }}>🚨 Emergency:</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: withEmergency === total ? "#4ade80" : "#facc15" }}>{withEmergency}/{total}</span>
        </div>
      </div>

      {/* Branch filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setBranch(null)}
          className={`chip ${!branch ? "chip-active" : ""}`}
        >
          All ({contacts.length})
        </button>
        {branchNames.map((b, i) => (
          <button
            key={b}
            onClick={() => setBranch(b)}
            className="chip"
            style={
              branch === b
                ? { borderColor: COLORS[i % COLORS.length], background: COLORS[i % COLORS.length] + "22", color: COLORS[i % COLORS.length] }
                : undefined
            }
          >
            {shortBranch(b)} ({contacts.filter((c) => c.branch_name === b).length})
          </button>
        ))}
      </div>

      {/* Cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
        gap: 12,
      }}>
        {filtered.map((c) => (
          <StaffCard key={c.employee_id} c={c} />
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-10" style={{ color: "#636363" }}>
          No employees match your search.
        </div>
      )}
    </div>
  );
}
