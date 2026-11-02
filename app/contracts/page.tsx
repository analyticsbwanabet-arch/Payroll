"use client";
import { useState, useEffect, useMemo } from "react";
import { supabase, useAuth } from "@/lib/auth-context";

interface Employee { id: string; full_name: string; position: string; branch_name: string; email: string; basic_pay: number; housing_allowance: number; transport_allowance: number; lunch_allowance: number; gross_salary: number; date_started: string; }
interface Contract { id: string; employee_id: string; token: string; employee_name: string; branch_name: string; position: string; status: string; sent_at: string; viewed_at: string; signed_at: string; effective_date: string; end_date: string; gross_salary: number; }

const PROBATION_MONTHS = 3;
const CONTRACT_SELECT = "id, employee_id, token, position, branch_name, status, sent_at, viewed_at, signed_at, effective_date, end_date, gross_salary";

type OverviewStatus = "none" | "sent" | "viewed" | "signed" | "expired";
interface OverviewRow {
  emp: Employee;
  contract: Contract | null;
  status: OverviewStatus;
  daysEmployed: number | null;
  probationDone: boolean;
  needsContract: boolean;
}

const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("en-GB") : "—";
const posLabel = (p: string) => (p || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

export default function ContractsPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"overview" | "send" | "manage">("overview");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [selectedEmp, setSelectedEmp] = useState("");
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [endDate, setEndDate] = useState("");
  const [sending, setSending] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [search, setSearch] = useState("");

  // Overview filters
  const [fBranch, setFBranch] = useState("");
  const [fStatus, setFStatus] = useState<"" | OverviewStatus>("");
  const [fProbation, setFProbation] = useState<"" | "needs" | "done" | "on">("");
  const [fSearch, setFSearch] = useState("");

  const loadContracts = async (emps: Employee[]) => {
    const { data: c } = await supabase.from("contracts").select(CONTRACT_SELECT).order("created_at", { ascending: false });
    const empMap: Record<string, string> = {}; emps.forEach(x => empMap[x.id] = x.full_name);
    setContracts((c || []).map((x: any) => ({ ...x, employee_name: empMap[x.employee_id] || "Unknown" })));
  };

  useEffect(() => {
    const load = async () => {
      const { data: b } = await supabase.from("branches").select("id, name");
      const bm: Record<string, string> = {}; (b || []).forEach((x: any) => bm[x.id] = x.name);
      const { data: e } = await supabase.from("employees").select("id, full_name, position, branch_id, email, basic_pay, housing_allowance, transport_allowance, lunch_allowance, gross_salary, date_started").eq("employment_status", "active").order("full_name");
      const emps = (e || []).map((x: any) => ({ ...x, branch_name: bm[x.branch_id] || "Unknown" }));
      setEmployees(emps);
      await loadContracts(emps);
    };
    if (!authLoading) load();
  }, [authLoading]);

  const emp = employees.find(e => e.id === selectedEmp);

  const doSend = async (target: Employee, effDate: string, end: string) => {
    if (!target.email) { setMsg({ type: "err", text: `${target.full_name} has no email address` }); return false; }
    const ed = end || (() => { const d = new Date(effDate); d.setFullYear(d.getFullYear() + 1); return d.toISOString().split("T")[0]; })();
    const otherAllow = (target.transport_allowance || 0) + (target.lunch_allowance || 0);
    try {
      const res = await fetch("/api/send-contract", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: target.id, effective_date: effDate, end_date: ed,
          basic_pay: target.basic_pay, housing_allowance: target.housing_allowance,
          other_allowances: otherAllow, gross_salary: target.gross_salary,
          position: target.position, branch_name: target.branch_name, sent_by: "Admin",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setMsg({ type: "ok", text: `Contract sent to ${target.full_name} at ${target.email}` });
        await loadContracts(employees);
        return true;
      }
      setMsg({ type: "err", text: data.error || "Failed to send" });
    } catch (err: any) { setMsg({ type: "err", text: err.message }); }
    return false;
  };

  const sendContract = async () => {
    if (!selectedEmp || !effectiveDate || !emp) return;
    setSending(true); setMsg(null);
    const ok = await doSend(emp, effectiveDate, endDate);
    if (ok) { setSelectedEmp(""); setEndDate(""); }
    setSending(false);
  };

  const quickSend = async (target: Employee) => {
    setSendingId(target.id); setMsg(null);
    const today = new Date().toISOString().split("T")[0];
    await doSend(target, today, "");
    setSendingId(null);
  };

  // Build overview: one row per active employee with their latest contract
  const overview = useMemo<OverviewRow[]>(() => {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const latest: Record<string, Contract> = {};
    // contracts are ordered newest first; prefer a signed one if it exists
    contracts.forEach(c => {
      const cur = latest[c.employee_id];
      if (!cur) latest[c.employee_id] = c;
      else if (cur.status !== "signed" && c.status === "signed") latest[c.employee_id] = c;
    });
    return employees.map(e => {
      const c = latest[e.id] || null;
      let status: OverviewStatus = "none";
      if (c) {
        status = (c.status === "pending" ? "sent" : c.status) as OverviewStatus;
        if (c.status === "signed" && c.end_date && new Date(c.end_date) < today) status = "expired";
      }
      const started = e.date_started ? new Date(e.date_started) : null;
      const daysEmployed = started ? Math.floor((today.getTime() - started.getTime()) / 86400000) : null;
      const probationEnd = started ? new Date(started) : null;
      if (probationEnd) probationEnd.setMonth(probationEnd.getMonth() + PROBATION_MONTHS);
      const probationDone = !!probationEnd && probationEnd <= today;
      const needsContract = probationDone && status !== "signed";
      return { emp: e, contract: c, status, daysEmployed, probationDone, needsContract };
    });
  }, [employees, contracts]);

  const branches = useMemo(() => Array.from(new Set(employees.map(e => e.branch_name))).sort(), [employees]);

  const filteredOverview = overview.filter(r => {
    if (fBranch && r.emp.branch_name !== fBranch) return false;
    if (fStatus && r.status !== fStatus) return false;
    if (fProbation === "needs" && !r.needsContract) return false;
    if (fProbation === "done" && !r.probationDone) return false;
    if (fProbation === "on" && r.probationDone) return false;
    if (fSearch && !r.emp.full_name.toLowerCase().includes(fSearch.toLowerCase())) return false;
    return true;
  }).sort((a, b) => {
    // needs-contract first, then by branch, then name
    if (a.needsContract !== b.needsContract) return a.needsContract ? -1 : 1;
    if (a.emp.branch_name !== b.emp.branch_name) return a.emp.branch_name.localeCompare(b.emp.branch_name);
    return a.emp.full_name.localeCompare(b.emp.full_name);
  });

  const counts = useMemo(() => {
    const scope = fBranch ? overview.filter(r => r.emp.branch_name === fBranch) : overview;
    const n = (f: (r: OverviewRow) => boolean) => scope.filter(f).length;
    return {
      total: scope.length,
      signed: n(r => r.status === "signed"),
      viewed: n(r => r.status === "viewed"),
      sent: n(r => r.status === "sent"),
      none: n(r => r.status === "none"),
      expired: n(r => r.status === "expired"),
      needs: n(r => r.needsContract),
      onProbation: n(r => !r.probationDone),
    };
  }, [overview, fBranch]);

  const exportCsv = () => {
    const header = ["Employee", "Branch", "Position", "Start Date", "Days Employed", "Probation", "Contract Status", "Sent", "Viewed", "Signed", "Contract End", "Needs Contract"];
    const lines = filteredOverview.map(r => [
      r.emp.full_name, r.emp.branch_name, posLabel(r.emp.position), r.emp.date_started || "", r.daysEmployed ?? "",
      r.probationDone ? "Completed" : "On probation", r.status, fmtDate(r.contract?.sent_at), fmtDate(r.contract?.viewed_at), fmtDate(r.contract?.signed_at), r.contract?.end_date || "", r.needsContract ? "YES" : "",
    ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(","));
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `contracts_overview_${new Date().toISOString().split("T")[0]}.csv`; a.click();
  };

  const filtered = search ? employees.filter(e => e.full_name.toLowerCase().includes(search.toLowerCase()) || e.branch_name.toLowerCase().includes(search.toLowerCase())) : employees;
  const statusColor: Record<string, string> = { none: "#f87171", pending: "#636363", sent: "#22d3ee", viewed: "#fbbf24", signed: "#4ade80", expired: "#fb923c" };
  const statusLabel: Record<string, string> = { none: "No contract", pending: "Pending", sent: "Sent", viewed: "Viewed", signed: "Signed ✅", expired: "Expired" };

  const inputStyle = { border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" };
  const tabBtn = (key: typeof tab, label: string, color: string) => (
    <button onClick={() => { setTab(key); setMsg(null); }} className="px-5 py-2.5 rounded-lg text-[13px] font-semibold" style={{ background: tab === key ? color : "#1c1c1c", color: tab === key ? "#000" : "#636363", border: `1px solid ${tab === key ? color : "#2a2a2a"}` }}>{label}</button>
  );
  const StatCard = ({ label, value, color, onClick, active }: { label: string; value: number; color: string; onClick?: () => void; active?: boolean }) => (
    <button onClick={onClick} className="chart-card text-left" style={{ padding: "10px 14px", minWidth: 110, border: `1px solid ${active ? color : "#2a2a2a"}`, cursor: onClick ? "pointer" : "default" }}>
      <div style={{ fontSize: 10, color: "#636363", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color }}>{value}</div>
    </button>
  );

  if (authLoading) return <div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">📝</div></div>;
  if (!isSuperAdmin) return <div className="flex flex-col items-center justify-center py-20 gap-3"><div className="text-4xl">🔒</div><h2 className="text-lg font-bold" style={{ color: "#f5f5f5" }}>Access Restricted</h2></div>;

  return (
    <div className="flex flex-col gap-5">
      <div><h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Contracts</h1><p className="text-[13px] mt-1" style={{ color: "#636363" }}>Track, send and manage employment contracts</p></div>

      <div className="flex gap-2 flex-wrap">
        {tabBtn("overview", `📋 Overview (${employees.length})`, "#facc15")}
        {tabBtn("send", "📤 Send Contract", "#22c55e")}
        {tabBtn("manage", `🗂️ All Sent (${contracts.length})`, "#22d3ee")}
      </div>

      {msg && <div className="px-4 py-3 rounded-lg text-[13px]" style={{ background: msg.type === "ok" ? "#22c55e15" : "#f8717115", border: `1px solid ${msg.type === "ok" ? "#22c55e30" : "#f8717130"}`, color: msg.type === "ok" ? "#4ade80" : "#f87171" }}>{msg.type === "ok" ? "✅" : "❌"} {msg.text}</div>}

      {tab === "overview" && (
        <>
          <div className="flex gap-2 flex-wrap">
            <StatCard label="Employees" value={counts.total} color="#f5f5f5" onClick={() => { setFStatus(""); setFProbation(""); }} active={!fStatus && !fProbation} />
            <StatCard label="Needs contract" value={counts.needs} color="#f87171" onClick={() => { setFStatus(""); setFProbation("needs"); }} active={fProbation === "needs"} />
            <StatCard label="No contract" value={counts.none} color="#f87171" onClick={() => { setFProbation(""); setFStatus("none"); }} active={fStatus === "none"} />
            <StatCard label="Sent" value={counts.sent} color="#22d3ee" onClick={() => { setFProbation(""); setFStatus("sent"); }} active={fStatus === "sent"} />
            <StatCard label="Viewed" value={counts.viewed} color="#fbbf24" onClick={() => { setFProbation(""); setFStatus("viewed"); }} active={fStatus === "viewed"} />
            <StatCard label="Signed" value={counts.signed} color="#4ade80" onClick={() => { setFProbation(""); setFStatus("signed"); }} active={fStatus === "signed"} />
            <StatCard label="Expired" value={counts.expired} color="#fb923c" onClick={() => { setFProbation(""); setFStatus("expired"); }} active={fStatus === "expired"} />
            <StatCard label="On probation" value={counts.onProbation} color="#a78bfa" onClick={() => { setFStatus(""); setFProbation("on"); }} active={fProbation === "on"} />
          </div>

          <div className="flex gap-2 flex-wrap items-center">
            <input type="text" value={fSearch} onChange={e => setFSearch(e.target.value)} placeholder="Search name..." className="px-3 py-2 rounded-lg text-[13px] outline-none w-52" style={inputStyle} />
            <select value={fBranch} onChange={e => setFBranch(e.target.value)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
              <option value="">All stores</option>
              {branches.map(b => <option key={b} value={b}>{b}</option>)}
            </select>
            <select value={fStatus} onChange={e => setFStatus(e.target.value as any)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
              <option value="">All statuses</option>
              <option value="none">No contract</option>
              <option value="sent">Sent (not opened)</option>
              <option value="viewed">Viewed (not signed)</option>
              <option value="signed">Signed</option>
              <option value="expired">Expired</option>
            </select>
            <select value={fProbation} onChange={e => setFProbation(e.target.value as any)} className="px-3 py-2 rounded-lg text-[13px] outline-none" style={inputStyle}>
              <option value="">All probation states</option>
              <option value="needs">Probation done, no signed contract</option>
              <option value="done">Probation completed</option>
              <option value="on">Still on probation</option>
            </select>
            {(fBranch || fStatus || fProbation || fSearch) && <button onClick={() => { setFBranch(""); setFStatus(""); setFProbation(""); setFSearch(""); }} className="chip">✕ Clear</button>}
            <button onClick={exportCsv} className="px-3 py-2 rounded-lg text-[12px] font-semibold ml-auto" style={{ background: "#1c1c1c", color: "#facc15", border: "1px solid #2a2a2a" }}>⬇ Export CSV ({filteredOverview.length})</button>
          </div>

          <div className="chart-card overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
              <thead><tr>
                {["Employee", "Store", "Position", "Started", "Employed", "Probation", "Contract", "Sent", "Viewed", "Signed", "Ends", ""].map(h => (
                  <th key={h} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b whitespace-nowrap" style={{ textAlign: "left", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {filteredOverview.map(r => {
                  const c = r.contract;
                  const months = r.daysEmployed !== null ? (r.daysEmployed / 30.44) : null;
                  return (
                    <tr key={r.emp.id} className="row-hover" style={r.needsContract ? { background: "#f8717108" } : undefined}>
                      <td className="px-3 py-2.5 text-[12px] font-semibold whitespace-nowrap" style={{ color: "#f5f5f5" }}>
                        {r.emp.full_name}
                        {!r.emp.email && <span title="No email on file" style={{ color: "#fbbf24", marginLeft: 6 }}>⚠️</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[11px] whitespace-nowrap" style={{ color: "#636363" }}>{r.emp.branch_name}</td>
                      <td className="px-3 py-2.5 text-[11px] whitespace-nowrap" style={{ color: "#636363" }}>{posLabel(r.emp.position)}</td>
                      <td className="px-3 py-2.5 text-[11px] whitespace-nowrap" style={{ color: "#636363" }}>{fmtDate(r.emp.date_started)}</td>
                      <td className="px-3 py-2.5 text-[11px] whitespace-nowrap" style={{ color: "#f5f5f5" }}>{months === null ? "—" : months >= 12 ? `${(months / 12).toFixed(1)} yrs` : `${months.toFixed(1)} mo`}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.daysEmployed === null ? <span className="text-[10px]" style={{ color: "#636363" }}>No start date</span>
                          : r.probationDone ? <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#4ade8020", color: "#4ade80" }}>Completed</span>
                          : <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#a78bfa20", color: "#a78bfa" }}>On probation</span>}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: statusColor[r.status] + "20", color: statusColor[r.status] }}>{statusLabel[r.status]}</span>
                        {r.needsContract && <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#f8717120", color: "#f87171" }}>Needs contract</span>}
                      </td>
                      <td className="px-3 py-2.5 text-[10px] whitespace-nowrap" style={{ color: "#636363" }}>{fmtDate(c?.sent_at)}</td>
                      <td className="px-3 py-2.5 text-[10px] whitespace-nowrap" style={{ color: "#636363" }}>{fmtDate(c?.viewed_at)}</td>
                      <td className="px-3 py-2.5 text-[10px] whitespace-nowrap" style={{ color: "#636363" }}>{fmtDate(c?.signed_at)}</td>
                      <td className="px-3 py-2.5 text-[10px] whitespace-nowrap" style={{ color: r.status === "expired" ? "#fb923c" : "#636363" }}>{c?.end_date ? fmtDate(c.end_date) : "—"}</td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        {r.status === "signed" ? (
                          <button onClick={() => { setSelectedEmp(r.emp.id); setTab("send"); }} className="px-2 py-1 rounded text-[10px]" style={{ color: "#636363", border: "1px solid #2a2a2a", cursor: "pointer" }}>Renew</button>
                        ) : (
                          <button onClick={() => quickSend(r.emp)} disabled={sendingId === r.emp.id || !r.emp.email} title={!r.emp.email ? "No email on file" : ""} className="px-2 py-1 rounded text-[10px] font-semibold" style={{ background: "#22c55e20", color: "#4ade80", border: "1px solid #22c55e30", cursor: "pointer", opacity: (sendingId === r.emp.id || !r.emp.email) ? 0.4 : 1 }}>
                            {sendingId === r.emp.id ? "Sending..." : r.status === "none" ? "📤 Send" : "↻ Resend"}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredOverview.length === 0 && <tr><td colSpan={12} className="px-3 py-8 text-center text-[13px]" style={{ color: "#636363" }}>No employees match these filters</td></tr>}
              </tbody>
            </table>
          </div>
          <p className="text-[11px]" style={{ color: "#636363" }}>Probation is {PROBATION_MONTHS} months from start date. "Needs contract" = probation completed and no signed contract on file. Quick send uses today as the start date and a 1 year term; use the Send Contract tab to set different dates.</p>
        </>
      )}

      {tab === "send" && (
        <div className="chart-card flex flex-col gap-4">
          <h3 className="text-[14px] font-bold" style={{ color: "#4ade80" }}>Send Employment Contract</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Search Employee</label>
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Type name or branch..." className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Select Employee</label>
              <select value={selectedEmp} onChange={e => setSelectedEmp(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={inputStyle}>
                <option value="">Select employee...</option>
                {filtered.map(e => <option key={e.id} value={e.id}>{e.full_name} — {e.branch_name} ({e.position}) {!e.email ? "⚠️ No email" : ""}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Contract Start Date</label>
              <input type="date" value={effectiveDate} onChange={e => setEffectiveDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={inputStyle} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Contract End Date (default: 1 year)</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={inputStyle} />
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
              {["Employee", "Branch", "Position", "Gross", "Start", "End", "Status", "Sent", "Viewed", "Signed", ""].map(h => (
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
                  <td className="px-3 py-2.5 text-[10px]" style={{ color: "#636363" }}>{fmtDate(c.sent_at)}</td>
                  <td className="px-3 py-2.5 text-[10px]" style={{ color: "#636363" }}>{fmtDate(c.viewed_at)}</td>
                  <td className="px-3 py-2.5 text-[10px]" style={{ color: "#636363" }}>{fmtDate(c.signed_at)}</td>
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
              {contracts.length === 0 && <tr><td colSpan={11} className="px-3 py-8 text-center text-[13px]" style={{ color: "#636363" }}>No contracts sent yet</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
