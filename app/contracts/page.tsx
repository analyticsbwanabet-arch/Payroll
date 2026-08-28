"use client";
import { useState, useEffect } from "react";
import { supabase, useAuth } from "@/lib/auth-context";

interface Employee { id: string; full_name: string; position: string; branch_name: string; email: string; basic_pay: number; housing_allowance: number; transport_allowance: number; lunch_allowance: number; gross_salary: number; date_started: string; }
interface Contract { id: string; token: string; employee_name: string; branch_name: string; position: string; status: string; sent_at: string; signed_at: string; effective_date: string; end_date: string; gross_salary: number; }

export default function ContractsPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"send" | "manage">("send");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [sending, setSending] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: b } = await supabase.from("branches").select("id, name");
      const bm: Record<string, string> = {}; (b || []).forEach((x: any) => bm[x.id] = x.name);
      const { data: e } = await supabase.from("employees").select("id, full_name, position, branch_id, email, basic_pay, housing_allowance, transport_allowance, lunch_allowance, gross_salary, date_started").eq("employment_status", "active").order("full_name");
      setEmployees((e || []).map((x: any) => ({ ...x, branch_name: bm[x.branch_id] || "Unknown" })));

      const { data: c } = await supabase.from("contracts").select("id, employee_id, token, position, branch_name, status, sent_at, signed_at, effective_date, end_date, gross_salary").order("created_at", { ascending: false });
      const empMap: Record<string, string> = {}; (e || []).forEach((x: any) => empMap[x.id] = x.full_name);
      setContracts((c || []).map((x: any) => ({ ...x, employee_name: empMap[x.employee_id] || "Unknown" })));
    };
    if (!authLoading) load();
  }, [authLoading]);

  const emp = employees.find(e => e.id === selectedEmp);

  const sendContract = async () => {
    if (!selectedEmp || !effectiveDate) return;
    if (!emp?.email) { setMsg({ type: "err", text: "Employee has no email address" }); return; }
    setSending(true); setMsg(null);

    // Calculate end date as 1 year from effective date if not set
    const ed = endDate || (() => { const d = new Date(effectiveDate); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split("T")[0]; })();
    const otherAllow = (emp.transport_allowance || 0) + (emp.lunch_allowance || 0);

    try {
      const res = await fetch("/api/send-contract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: selectedEmp, effective_date: effectiveDate, end_date: ed,
          basic_pay: emp.basic_pay, housing_allowance: emp.housing_allowance,
          other_allowances: otherAllow, gross_salary: emp.gross_salary,
          position: emp.position, branch_name: emp.branch_name, sent_by: "Admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "ok", text: `Contract sent to ${emp.full_name} at ${emp.email}` });
        setSelectedEmp(""); setEndDate("");
        // Refresh contracts
        const { data: c } = await supabase.from("contracts").select("id, employee_id, token, position, branch_name, status, sent_at, signed_at, effective_date, end_date, gross_salary").order("created_at", { ascending: false });
        const empMap: Record<string, string> = {}; employees.forEach(x => empMap[x.id] = x.full_name);
        setContracts((c || []).map((x: any) => ({ ...x, employee_name: empMap[x.employee_id] || "Unknown" })));
      } else setMsg({ type: "err", text: data.error || "Failed to send" });
    } catch (err: any) { setMsg({ type: "err", text: err.message }); }
    setSending(false);
  };

  const filtered = search ? employees.filter(e => e.full_name.toLowerCase().includes(search.toLowerCase()) || e.branch_name.toLowerCase().includes(search.toLowerCase())) : employees;
  const statusColor: Record<string, string> = { pending: "#636363", sent: "#22d3ee", viewed: "#fbbf24", signed: "#4ade80" };
  const statusLabel: Record<string, string> = { pending: "Pending", sent: "Sent", viewed: "Viewed", signed: "Signed ✅" };

  if (authLoading) return <div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">📝</div></div>;
  if (!isSuperAdmin) return <div className="flex flex-col items-center justify-center py-20 gap-3"><div className="text-4xl">🔒</div><h2 className="text-lg font-bold" style={{ color: "#f5f5f5" }}>Access Restricted</h2></div>;

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Contracts</h1><p className="text-[13px] mt-1" style={{ color: "#636363" }}>Send and manage employment contracts</p></div>

      <div className="flex gap-2">
        <button onClick={() => { setTab("send"); setMsg(null); }} className="px-5 py-2.5 rounded-lg text-[13px] font-semibold" style={{ background: tab === "send" ? "#22c55e" : "#1c1c1c", color: tab === "send" ? "#000" : "#636363", border: `1px solid ${tab === "send" ? "#22c55e" : "#2a2a2a"}` }}>📤 Send Contract</button>
        <button onClick={() => { setTab("manage"); setMsg(null); }} className="px-5 py-2.5 rounded-lg text-[13px] font-semibold" style={{ background: tab === "manage" ? "#22d3ee" : "#1c1c1c", color: tab === "manage" ? "#000" : "#636363", border: `1px solid ${tab === "manage" ? "#22d3ee" : "#2a2a2a"}` }}>📋 Manage ({contracts.length})</button>
      </div>

      {msg && <div className="px-4 py-3 rounded-lg text-[13px]" style={{ background: msg.type === "ok" ? "#22c55e15" : "#f8717115", border: `1px solid ${msg.type === "ok" ? "#22c55e30" : "#f8717130"}`, color: msg.type === "ok" ? "#4ade80" : "#f87171" }}>{msg.type === "ok" ? "✅" : "❌"} {msg.text}</div>}

      {tab === "send" && (
        <div className="chart-card flex flex-col gap-4">
          <h3 className="text-[14px] font-bold" style={{ color: "#4ade80" }}>Send Employment Contract</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Search Employee</label>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Type name or branch..." className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Select Employee</label>
              <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="">Select employee...</option>
                {filtered.map(e => <option key={e.id} value={e.id}>{e.full_name} — {e.branch_name} ({e.position}) {!e.email ? "⚠️ No email" : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Contract Start Date</label>
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Contract End Date (default: 1 year)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }} />
            </div>
          </div>

          {emp && (
            <div className="px-4 py-3 rounded-lg text-[12px]" style={{ background: "#22c55e10", border: "1px solid #22c55e20" }}>
              <div style={{ color: "#f5f5f5" }}><strong>{emp.full_name}</strong> — {emp.branch_name}</div>
              <div style={{ color: "#636363" }}>Position: {emp.position} | Gross: K{emp.gross_salary?.toLocaleString()} | Email: {emp.email || "⚠️ No email"}</div>
            </div>
          )}

          <button onClick={sendContract} disabled={sending || !selectedEmp} className="px-6 py-2.5 rounded-lg font-semibold text-[13px] w-fit" style={{ background: "#22c55e", color: "#000", opacity: (sending || !selectedEmp) ? 0.5 : 1 }}>
            {sending ? "Sending..." : "📤 Send Contract"}
          </button>
        </div>
      )}

      {tab === "manage" && (
        <div className="chart-card overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
            <thead><tr>
              {["Employee", "Branch", "Position", "Gross", "Start", "End", "Status", "Sent", "Signed", ""].map(h => (
                <th key={h} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b whitespace-nowrap" style={{ textAlign: "left", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {contracts.map(c => (
                <tr key={c.id} className="row-hover">
                  <td className="px-3 py-2.5 text-[12px] font-semibold" style={{ color: "#f5f5f5" }}>{c.employee_name}</td>
                  <td className="px-3 py-2.5 text-[11px]" style={{ color: "#636363" }}>{c.branch_name}</td>
                  <td className="px-3 py-2.5 text-[11px]" style={{ color: "#636363" }}>{c.position}</td>
                  <td className="px-3 py-2.5 text-[11px]" style={{ color: "#f5f5f5" }}>K{c.gross_salary?.toLocaleString()}</td>
                  <td className="px-3 py-2.5 text-[11px]" style={{ color: "#636363" }}>{c.effective_date}</td>
                  <td className="px-3 py-2.5 text-[11px]" style={{ color: "#636363" }}>{c.end_date}</td>
                  <td className="px-3 py-2.5"><span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: (statusColor[c.status] || "#636363") + "20", color: statusColor[c.status] }}>{statusLabel[c.status] || c.status}</span></td>
                  <td className="px-3 py-2.5 text-[10px]" style={{ color: "#636363" }}>{c.sent_at ? new Date(c.sent_at).toLocaleDateString("en-GB") : "—"}</td>
                  <td className="px-3 py-2.5 text-[10px]" style={{ color: "#636363" }}>{c.signed_at ? new Date(c.signed_at).toLocaleDateString("en-GB") : "—"}</td>
                    <td className="px-3 py-2.5">
                      {c.status === "signed" ? (
                        <button onClick={async () => {
                          const res = await fetch(`/api/contract-view?token=${c.token}`);
                          if (!res.ok) return;
                          const d = await res.json();
                          const { generateContractPDF } = await import("@/lib/contract-pdf");
                          const pdf = await generateContractPDF({ employee_name: d.employee_name, nrc_number: d.nrc_number, ssn: d.ssn, home_address: d.home_address, position: d.position, branch_name: d.branch_name, effective_date: d.effective_date, end_date: d.end_date, basic_pay: d.basic_pay, housing_allowance: d.housing_allowance, other_allowances: d.other_allowances || 0, gross_salary: d.gross_salary, signed_name: d.signed_name, signature_data: d.signature_data, signed_at: d.signed_at });
                          pdf.save(`Contract_${d.employee_name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`);
                        }} className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: "#22c55e20", color: "#4ade80", border: "1px solid #22c55e30", cursor: "pointer" }}>📄 PDF</button>
                      ) : (
                        <span className="px-2 py-1 rounded text-[10px]" style={{ color: "#636363" }}>—</span>
                      )}
                    </td>
                </tr>
              ))}
              {contracts.length === 0 && <tr><td colSpan={10} className="px-3 py-8 text-center text-[13px]" style={{ color: "#636363" }}>No contracts sent yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
