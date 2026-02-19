"use client";

import { useState } from "react";
import type { PayrollRecord, EmployeeContact } from "@/lib/helpers";
import { fmt, posLabel, shortBranch } from "@/lib/helpers";

const COLORS = ["#22c55e", "#facc15", "#4ade80", "#fbbf24", "#22d3ee", "#a78bfa"];

function badge(position: string) {
  const cls =
    position === "manager" || position === "assistant_manager" ? "badge-manager"
    : position === "it_technician" ? "badge-it"
    : position === "security" ? "badge-security"
    : "badge-default";
  return <span className={`badge ${cls}`}>{posLabel[position] || position}</span>;
}

function InfoItem({ icon, label, value }: { icon: string; label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 8, minWidth: 220 }}>
      <span style={{ fontSize: 16, lineHeight: "20px", flexShrink: 0 }}>{icon}</span>
      <div>
        <div style={{ fontSize: 10, color: "#636363", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>{label}</div>
        <div style={{ fontSize: 13, color: "#f5f5f5", wordBreak: "break-word" }}>{value}</div>
      </div>
    </div>
  );
}

function DetailPanel({ contact }: { contact: EmployeeContact | undefined }) {
  if (!contact) {
    return (
      <div style={{ padding: "16px 12px", color: "#636363", fontSize: 13, fontStyle: "italic" }}>
        No contact details on file for this employee.
      </div>
    );
  }

  const hasContact = contact.phone || contact.email || contact.mobile_money_number;
  const hasPersonal = contact.home_address || contact.nrc_number || contact.tpin || contact.date_started;
  const hasBank = contact.bank_name || contact.bank_account_number || contact.social_security_number;
  const hasEmergency = contact.emergency_contact_name || contact.emergency_contact_phone;

  return (
    <div style={{ padding: "16px 12px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
      {/* Contact Section */}
      {hasContact && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#facc15", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            📞 Contact
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 32px" }}>
            <InfoItem icon="📱" label="Phone" value={contact.phone} />
            <InfoItem icon="💰" label="Mobile Money" value={contact.mobile_money_number} />
            <InfoItem icon="✉️" label="Email" value={contact.email} />
          </div>
        </div>
      )}

      {/* Personal Section */}
      {hasPersonal && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#4ade80", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            🏠 Personal
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 32px" }}>
            <InfoItem icon="📍" label="Home Address" value={contact.home_address} />
            <InfoItem icon="🪪" label="NRC Number" value={contact.nrc_number} />
            <InfoItem icon="🏛️" label="TPIN" value={contact.tpin} />
            <InfoItem icon="📅" label="Date Started" value={contact.date_started ? new Date(contact.date_started).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : null} />
          </div>
        </div>
      )}

      {/* Bank Section */}
      {hasBank && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#22d3ee", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            🏦 Banking
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 32px" }}>
            <InfoItem icon="🏦" label="Bank" value={contact.bank_name} />
            <InfoItem icon="💳" label="Account Number" value={contact.bank_account_number} />
            <InfoItem icon="🔐" label="Social Security" value={contact.social_security_number} />
          </div>
        </div>
      )}

      {/* Emergency Section */}
      {hasEmergency && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: "#f87171", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.06em" }}>
            🚨 Emergency Contact
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "12px 32px" }}>
            <InfoItem icon="👤" label="Name" value={contact.emergency_contact_name} />
            <InfoItem icon="📞" label="Phone" value={contact.emergency_contact_phone} />
          </div>
        </div>
      )}

      {!hasContact && !hasPersonal && !hasBank && !hasEmergency && (
        <div style={{ color: "#636363", fontSize: 13, fontStyle: "italic" }}>
          No contact details on file yet.
        </div>
      )}
    </div>
  );
}

const columns = [
  { key: "full_name", label: "Employee", align: "left" as const },
  { key: "branch_name", label: "Branch", align: "left" as const },
  { key: "position", label: "Role", align: "left" as const },
  { key: "gross_salary", label: "Gross", align: "right" as const },
  { key: "napsa_employee", label: "NAPSA", align: "right" as const },
  { key: "nhima_employee", label: "NHIMA", align: "right" as const },
  { key: "extra_shifts_count", label: "Shifts+", align: "right" as const },
  { key: "shortage_amount", label: "Short.", align: "right" as const },
  { key: "advances", label: "Adv.", align: "right" as const },
  { key: "net_salary_due", label: "Net Pay", align: "right" as const },
];

export default function EmployeeTable({
  records, contacts, branchNames, initialBranch,
}: {
  records: PayrollRecord[];
  contacts: EmployeeContact[];
  branchNames: { name: string; count: number }[];
  initialBranch: string | null;
}) {
  const [branch, setBranch] = useState<string | null>(initialBranch);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [expanded, setExpanded] = useState<string | null>(null);

  // Build contact lookup by name
  const contactMap: Record<string, EmployeeContact> = {};
  contacts.forEach((c) => { contactMap[c.full_name] = c; });

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("asc"); }
  };

  const filtered = records
    .filter((e) => !branch || e.branch_name === branch)
    .filter((e) => !search || e.full_name.toLowerCase().includes(search.toLowerCase()) || e.position.toLowerCase().includes(search.toLowerCase()))
    .sort((a: any, b: any) => {
      const av = a[sortCol], bv = b[sortCol];
      const cmp = typeof av === "string" ? (av || "").localeCompare(bv || "") : (+av || 0) - (+bv || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });

  const toggleExpand = (name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>
            {branch ? branch : "All Employees"} — {filtered.length} staff
          </h1>
          <p className="text-[13px] mt-1" style={{ color: "#636363" }}>Click any row to view contact details • Click headers to sort</p>
        </div>
        <div className="flex gap-2 items-center">
          <input type="text" placeholder="Search name or role..." value={search} onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-2 rounded-lg text-[13px] w-52 outline-none"
            style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }} />
          {branch && <button onClick={() => setBranch(null)} className="chip">✕ Clear</button>}
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setBranch(null)} className={`chip ${!branch ? "chip-active" : ""}`}>All ({records.length})</button>
        {branchNames.map((b, i) => (
          <button key={b.name} onClick={() => setBranch(b.name)} className="chip"
            style={branch === b.name ? { borderColor: COLORS[i % COLORS.length], background: COLORS[i % COLORS.length] + "22", color: COLORS[i % COLORS.length] } : undefined}>
            {shortBranch(b.name)} ({b.count})
          </button>
        ))}
      </div>

      <div className="chart-card overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th key={col.key} onClick={() => handleSort(col.key)}
                  className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b cursor-pointer select-none whitespace-nowrap"
                  style={{ textAlign: col.align, color: sortCol === col.key ? "#facc15" : "#636363", borderColor: "#2a2a2a" }}>
                  {col.label}{sortCol === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, i) => {
              const isExpanded = expanded === emp.full_name;
              const contact = contactMap[emp.full_name];
              const hasInfo = contact && (contact.phone || contact.email || contact.home_address || contact.mobile_money_number);
              return (
                <>
                  <tr key={`row-${i}`}
                    onClick={() => toggleExpand(emp.full_name)}
                    className="row-hover transition-colors"
                    style={{
                      cursor: "pointer",
                      ...(isExpanded ? { background: "#1a1a1a" } : {}),
                    }}>
                    <td className="px-3 py-3 font-semibold text-[13px] whitespace-nowrap" style={{ color: "#f5f5f5" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                        <span style={{
                          display: "inline-block", width: 16, fontSize: 10, color: "#636363",
                          transition: "transform 0.2s",
                          transform: isExpanded ? "rotate(90deg)" : "rotate(0deg)",
                        }}>▶</span>
                        {emp.full_name}
                        {hasInfo && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#4ade80", display: "inline-block", flexShrink: 0 }} title="Has contact info" />}
                      </span>
                    </td>
                    <td className="px-3 py-3 text-[12px]" style={{ color: "#a3a3a3" }}>{shortBranch(emp.branch_name)}</td>
                    <td className="px-3 py-3">{badge(emp.position)}</td>
                    <td className="px-3 py-3 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{fmt(emp.gross_salary)}</td>
                    <td className="px-3 py-3 text-right font-mono text-[12px]" style={{ color: "#a3a3a3" }}>{fmt(emp.napsa_employee)}</td>
                    <td className="px-3 py-3 text-right font-mono text-[12px]" style={{ color: "#a3a3a3" }}>{fmt(emp.nhima_employee)}</td>
                    <td className="px-3 py-3 text-right text-[12px]" style={{ color: emp.extra_shifts_count > 0 ? "#22d3ee" : "#636363" }}>
                      {emp.extra_shifts_count > 0 ? emp.extra_shifts_count : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px]" style={{ color: emp.shortage_amount > 0 ? "#f87171" : "#636363" }}>
                      {emp.shortage_amount > 0 ? fmt(emp.shortage_amount) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px]" style={{ color: emp.advances > 0 ? "#facc15" : "#636363" }}>
                      {emp.advances > 0 ? fmt(emp.advances) : "—"}
                    </td>
                    <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{fmt(emp.net_salary_due)}</td>
                  </tr>
                  {isExpanded && (
                    <tr key={`detail-${i}`}>
                      <td colSpan={columns.length} style={{
                        background: "#111111",
                        borderLeft: "3px solid #facc15",
                        borderBottom: "1px solid #2a2a2a",
                      }}>
                        <DetailPanel contact={contact} />
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div className="text-center py-10" style={{ color: "#636363" }}>No employees match your filters</div>}
      </div>
    </div>
  );
}
