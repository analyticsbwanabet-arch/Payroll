"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, useAuth } from "@/lib/auth-context";

interface LeaveRecord {
  employee_id: string;
  employee_name: string;
  branch_name: string;
  position: string;
  date_started: string;
  annual_entitled: number; annual_used: number; annual_remaining: number;
  sick_entitled: number; sick_used: number; sick_remaining: number;
  compassionate_entitled: number; compassionate_used: number; compassionate_remaining: number;
  maternity_entitled: number; maternity_used: number; maternity_remaining: number;
}

interface LeaveDetail { date: string; type: string; label: string; color: string; }

type LeaveView = "all" | "annual" | "sick" | "compassionate" | "maternity";

const LEAVE_LABELS: Record<string, { label: string; color: string }> = {
  on_leave: { label: "Annual Leave", color: "#22d3ee" },
  sick_authorised: { label: "Sick Leave", color: "#fbbf24" },
  absent_authorised: { label: "Compassionate", color: "#a78bfa" },
  maternity_leave: { label: "Maternity Leave", color: "#f472b6" },
};

export default function LeavePage() {
  const { isSuperAdmin, allowedBranchIds, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [filterBranch, setFilterBranch] = useState("all");
  const [leaveView, setLeaveView] = useState<LeaveView>("all");
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [leaveDetails, setLeaveDetails] = useState<LeaveDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);

    const { data: employees } = await supabase
      .from("employees")
      .select("id, full_name, position, branch_id, date_started")
      .eq("employment_status", "active")
      .order("full_name");

    if (!employees || employees.length === 0) { setRecords([]); setLoading(false); return; }

    const { data: branchData } = await supabase.from("branches").select("id, name");
    const branchMap: Record<string, string> = {};
    (branchData || []).forEach((b: any) => branchMap[b.id] = b.name);

    const { data: balances } = await supabase
      .from("leave_balances")
      .select("employee_id, sick_adj, compassionate_adj, maternity_adj")
      .eq("year", 2026);
    const balanceMap: Record<string, any> = {};
    (balances || []).forEach((b: any) => balanceMap[b.employee_id] = b);

    const { data: leaveLogs } = await supabase
      .from("daily_logs")
      .select("employee_id, attendance_status")
      .in("attendance_status", ["sick_authorised", "on_leave", "maternity_leave", "absent_authorised"])
      .gte("log_date", "2026-05-01");

    const usage: Record<string, { sick: number; annual: number; maternity: number; compassionate: number }> = {};
    (leaveLogs || []).forEach((l: any) => {
      if (!usage[l.employee_id]) usage[l.employee_id] = { sick: 0, annual: 0, maternity: 0, compassionate: 0 };
      if (l.attendance_status === "sick_authorised") usage[l.employee_id].sick++;
      else if (l.attendance_status === "on_leave") usage[l.employee_id].annual++;
      else if (l.attendance_status === "maternity_leave") usage[l.employee_id].maternity++;
      else if (l.attendance_status === "absent_authorised") usage[l.employee_id].compassionate++;
    });

    const now = new Date();
    const trackingStart = new Date("2026-05-01");

    const result: LeaveRecord[] = employees
      .filter((e: any) => {
        if (isSuperAdmin || !allowedBranchIds || allowedBranchIds.length === 0) return true;
        return allowedBranchIds.includes(e.branch_id);
      })
      .map((e: any) => {
        const bal = balanceMap[e.id] || { sick_adj: 10, compassionate_adj: 7, maternity_adj: 30 };
        const used = usage[e.id] || { sick: 0, annual: 0, maternity: 0, compassionate: 0 };
        const empStart = e.date_started ? new Date(e.date_started) : trackingStart;
        const accrualStart = empStart > trackingStart ? empStart : trackingStart;
        const monthsWorked = Math.max(0, (now.getFullYear() - accrualStart.getFullYear()) * 12 + (now.getMonth() - accrualStart.getMonth()));
        const annualEntitled = monthsWorked * 2;
        return {
          employee_id: e.id, employee_name: e.full_name,
          branch_name: branchMap[e.branch_id] || "Unknown", position: e.position, date_started: e.date_started,
          annual_entitled: annualEntitled, annual_used: used.annual, annual_remaining: annualEntitled - used.annual,
          sick_entitled: +(bal.sick_adj || 10), sick_used: used.sick, sick_remaining: +(bal.sick_adj || 10) - used.sick,
          compassionate_entitled: +(bal.compassionate_adj || 7), compassionate_used: used.compassionate, compassionate_remaining: +(bal.compassionate_adj || 7) - used.compassionate,
          maternity_entitled: +(bal.maternity_adj || 30), maternity_used: used.maternity, maternity_remaining: +(bal.maternity_adj || 30) - used.maternity,
        };
      });

    setRecords(result);
    setLoading(false);
  }, [authLoading, isSuperAdmin, allowedBranchIds]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadEmployeeDetails = async (empId: string) => {
    if (selectedEmp === empId) { setSelectedEmp(null); return; }
    setSelectedEmp(empId);
    setDetailLoading(true);
    const { data } = await supabase
      .from("daily_logs")
      .select("log_date, attendance_status")
      .eq("employee_id", empId)
      .in("attendance_status", ["sick_authorised", "on_leave", "maternity_leave", "absent_authorised"])
      .gte("log_date", "2026-05-01")
      .order("log_date", { ascending: false });

    setLeaveDetails((data || []).map((d: any) => ({
      date: d.log_date,
      type: d.attendance_status,
      label: LEAVE_LABELS[d.attendance_status]?.label || d.attendance_status,
      color: LEAVE_LABELS[d.attendance_status]?.color || "#636363",
    })));
    setDetailLoading(false);
  };

  const branchNames = Array.from(new Set(records.map(r => r.branch_name))).sort();
  const filtered = filterBranch === "all" ? records : records.filter(r => r.branch_name === filterBranch);
  const selectedRecord = records.find(r => r.employee_id === selectedEmp);

  const totals = filtered.reduce((t, r) => ({
    annual_entitled: t.annual_entitled + r.annual_entitled, annual_used: t.annual_used + r.annual_used, annual_remaining: t.annual_remaining + r.annual_remaining,
    sick_entitled: t.sick_entitled + r.sick_entitled, sick_used: t.sick_used + r.sick_used, sick_remaining: t.sick_remaining + r.sick_remaining,
    compassionate_entitled: t.compassionate_entitled + r.compassionate_entitled, compassionate_used: t.compassionate_used + r.compassionate_used, compassionate_remaining: t.compassionate_remaining + r.compassionate_remaining,
    maternity_entitled: t.maternity_entitled + r.maternity_entitled, maternity_used: t.maternity_used + r.maternity_used, maternity_remaining: t.maternity_remaining + r.maternity_remaining,
  }), { annual_entitled: 0, annual_used: 0, annual_remaining: 0, sick_entitled: 0, sick_used: 0, sick_remaining: 0, compassionate_entitled: 0, compassionate_used: 0, compassionate_remaining: 0, maternity_entitled: 0, maternity_used: 0, maternity_remaining: 0 });

  const cellColor = (remaining: number, entitled: number) => {
    if (entitled === 0) return "#636363";
    if (remaining <= 0) return "#f87171";
    if (remaining <= 2) return "#fbbf24";
    return "#4ade80";
  };

  const statusBadge = (remaining: number, entitled: number) => {
    if (entitled === 0) return null;
    if (remaining <= 0) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#f8717120", color: "#f87171" }}>Exhausted</span>;
    if (remaining <= 2) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#fbbf2420", color: "#fbbf24" }}>Low</span>;
    if (remaining <= entitled * 0.5) return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#fbbf2415", color: "#fbbf24" }}>Moderate</span>;
    return <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: "#4ade8015", color: "#4ade80" }}>Available</span>;
  };

  const formatDate = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  };

  if (authLoading) return <div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">🏖️</div></div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Employee Leave Tracker</h1>
          <p className="text-[13px] mt-1" style={{ color: "#636363" }}>Tracking from <span style={{ color: "#4ade80" }}>May 2026</span> onwards • Click an employee to view leave dates</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {branchNames.length > 1 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Branch</label>
              <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
                className="px-4 py-2.5 rounded-lg text-[13px] min-w-[180px] outline-none"
                style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="all">All Branches</option>
                {branchNames.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Leave Type</label>
            <select value={leaveView} onChange={(e) => setLeaveView(e.target.value as LeaveView)}
              className="px-4 py-2.5 rounded-lg text-[13px] min-w-[180px] outline-none"
              style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
              <option value="all">All Leave Types</option>
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="compassionate">Compassionate Leave</option>
              <option value="maternity">Maternity Leave</option>
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <SummaryCard title="Annual Leave" entitled={totals.annual_entitled} used={totals.annual_used} remaining={totals.annual_remaining} color="#22d3ee" sub="2 days/month" />
        <SummaryCard title="Sick Leave" entitled={totals.sick_entitled} used={totals.sick_used} remaining={totals.sick_remaining} color="#fbbf24" sub="10 days/year" />
        <SummaryCard title="Compassionate" entitled={totals.compassionate_entitled} used={totals.compassionate_used} remaining={totals.compassionate_remaining} color="#a78bfa" sub="7 days/year" />
        <SummaryCard title="Maternity" entitled={totals.maternity_entitled} used={totals.maternity_used} remaining={totals.maternity_remaining} color="#f472b6" sub="30 days" />
      </div>

      {/* Employee detail panel */}
      {selectedEmp && selectedRecord && (
        <div className="chart-card" style={{ border: "1px solid #22c55e30" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[14px] font-bold" style={{ color: "#f5f5f5" }}>{selectedRecord.employee_name}</h3>
              <p className="text-[11px]" style={{ color: "#636363" }}>{selectedRecord.branch_name} • {selectedRecord.position === "SUPERVISOR" ? "SUPERVISOR" : selectedRecord.position.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}</p>
            </div>
            <button onClick={() => setSelectedEmp(null)} className="px-3 py-1 rounded-lg text-[11px]" style={{ background: "#1c1c1c", color: "#636363", border: "1px solid #2a2a2a" }}>✕ Close</button>
          </div>
          <div className="grid grid-cols-4 gap-3 mb-4">
            <MiniStat label="Annual" entitled={selectedRecord.annual_entitled} used={selectedRecord.annual_used} remaining={selectedRecord.annual_remaining} color="#22d3ee" />
            <MiniStat label="Sick" entitled={selectedRecord.sick_entitled} used={selectedRecord.sick_used} remaining={selectedRecord.sick_remaining} color="#fbbf24" />
            <MiniStat label="Compassionate" entitled={selectedRecord.compassionate_entitled} used={selectedRecord.compassionate_used} remaining={selectedRecord.compassionate_remaining} color="#a78bfa" />
            <MiniStat label="Maternity" entitled={selectedRecord.maternity_entitled} used={selectedRecord.maternity_used} remaining={selectedRecord.maternity_remaining} color="#f472b6" />
          </div>
          {detailLoading ? (
            <div className="text-center py-4 text-[13px]" style={{ color: "#636363" }}>Loading leave history...</div>
          ) : leaveDetails.length === 0 ? (
            <div className="text-center py-4 text-[13px]" style={{ color: "#636363" }}>No leave days recorded since May 2026</div>
          ) : (
            <div className="flex flex-col gap-1.5" style={{ maxHeight: "300px", overflowY: "auto" }}>
              {leaveDetails.map((d, i) => (
                <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12px]" style={{ background: "#0a0a0a" }}>
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ background: d.color }} />
                  <span style={{ color: "#f5f5f5", minWidth: "180px" }}>{formatDate(d.date)}</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: d.color + "20", color: d.color }}>{d.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="text-2xl animate-pulse">Loading...</div></div>
      ) : (
        <div className="chart-card overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
            <thead>
              <tr>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#636363", borderColor: "#2a2a2a" }}>#</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#636363", borderColor: "#2a2a2a" }}>Employee</th>
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#636363", borderColor: "#2a2a2a" }}>Branch</th>
                {(leaveView === "all" || leaveView === "annual") && <>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#22d3ee", borderColor: "#2a2a2a" }}>Annual Ent.</th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#22d3ee", borderColor: "#2a2a2a" }}>Used</th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#22d3ee", borderColor: "#2a2a2a" }}>Rem.</th>
                </>}
                {(leaveView === "all" || leaveView === "sick") && <>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#fbbf24", borderColor: "#2a2a2a" }}>Sick Ent.</th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#fbbf24", borderColor: "#2a2a2a" }}>Used</th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#fbbf24", borderColor: "#2a2a2a" }}>Rem.</th>
                </>}
                {(leaveView === "all" || leaveView === "compassionate") && <>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#a78bfa", borderColor: "#2a2a2a" }}>Comp. Ent.</th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#a78bfa", borderColor: "#2a2a2a" }}>Used</th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#a78bfa", borderColor: "#2a2a2a" }}>Rem.</th>
                </>}
                {(leaveView === "all" || leaveView === "maternity") && <>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#f472b6", borderColor: "#2a2a2a" }}>Mat. Ent.</th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#f472b6", borderColor: "#2a2a2a" }}>Used</th>
                  <th className="px-3 py-2.5 text-right text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#f472b6", borderColor: "#2a2a2a" }}>Rem.</th>
                </>}
                <th className="px-3 py-2.5 text-left text-[10px] uppercase tracking-wider font-semibold border-b" style={{ color: "#636363", borderColor: "#2a2a2a" }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.sort((a, b) => a.branch_name.localeCompare(b.branch_name) || a.employee_name.localeCompare(b.employee_name)).map((r, i) => {
                const worstRemaining = leaveView === "annual" ? r.annual_remaining : leaveView === "sick" ? r.sick_remaining : leaveView === "compassionate" ? r.compassionate_remaining : leaveView === "maternity" ? r.maternity_remaining : Math.min(r.annual_remaining, r.sick_remaining, r.compassionate_remaining);
                const worstEntitled = leaveView === "annual" ? r.annual_entitled : leaveView === "sick" ? r.sick_entitled : leaveView === "compassionate" ? r.compassionate_entitled : leaveView === "maternity" ? r.maternity_entitled : 10;
                const isSelected = selectedEmp === r.employee_id;
                return (
                  <tr key={i} className="row-hover cursor-pointer" onClick={() => loadEmployeeDetails(r.employee_id)}
                    style={{ background: isSelected ? "#22c55e10" : undefined }}>
                    <td className="px-3 py-2 text-[12px]" style={{ color: "#636363" }}>{i + 1}</td>
                    <td className="px-3 py-2 text-[12px] font-semibold" style={{ color: isSelected ? "#4ade80" : "#f5f5f5" }}>
                      {r.employee_name} {isSelected && <span className="text-[10px]" style={{ color: "#4ade80" }}>▼</span>}
                    </td>
                    <td className="px-3 py-2 text-[11px]" style={{ color: "#636363" }}>{r.branch_name}</td>
                    {(leaveView === "all" || leaveView === "annual") && <>
                      <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{r.annual_entitled}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.annual_used > 0 ? "#22d3ee" : "#636363" }}>{r.annual_used}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold" style={{ color: cellColor(r.annual_remaining, r.annual_entitled) }}>{r.annual_remaining}</td>
                    </>}
                    {(leaveView === "all" || leaveView === "sick") && <>
                      <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{r.sick_entitled}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.sick_used > 0 ? "#fbbf24" : "#636363" }}>{r.sick_used}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold" style={{ color: cellColor(r.sick_remaining, r.sick_entitled) }}>{r.sick_remaining}</td>
                    </>}
                    {(leaveView === "all" || leaveView === "compassionate") && <>
                      <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{r.compassionate_entitled}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.compassionate_used > 0 ? "#a78bfa" : "#636363" }}>{r.compassionate_used}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold" style={{ color: cellColor(r.compassionate_remaining, r.compassionate_entitled) }}>{r.compassionate_remaining}</td>
                    </>}
                    {(leaveView === "all" || leaveView === "maternity") && <>
                      <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{r.maternity_entitled}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.maternity_used > 0 ? "#f472b6" : "#636363" }}>{r.maternity_used}</td>
                      <td className="px-3 py-2 text-right font-mono text-[12px] font-semibold" style={{ color: cellColor(r.maternity_remaining, r.maternity_entitled) }}>{r.maternity_remaining}</td>
                    </>}
                    <td className="px-3 py-2">{statusBadge(worstRemaining, worstEntitled)}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid #22c55e" }}>
                <td colSpan={3} className="px-3 py-3 font-bold text-[12px]" style={{ color: "#22c55e" }}>TOTAL ({filtered.length})</td>
                {(leaveView === "all" || leaveView === "annual") && <>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#22d3ee" }}>{totals.annual_entitled}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#22d3ee" }}>{totals.annual_used}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{totals.annual_remaining}</td>
                </>}
                {(leaveView === "all" || leaveView === "sick") && <>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#fbbf24" }}>{totals.sick_entitled}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#fbbf24" }}>{totals.sick_used}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{totals.sick_remaining}</td>
                </>}
                {(leaveView === "all" || leaveView === "compassionate") && <>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#a78bfa" }}>{totals.compassionate_entitled}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#a78bfa" }}>{totals.compassionate_used}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{totals.compassionate_remaining}</td>
                </>}
                {(leaveView === "all" || leaveView === "maternity") && <>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#f472b6" }}>{totals.maternity_entitled}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#f472b6" }}>{totals.maternity_used}</td>
                  <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{totals.maternity_remaining}</td>
                </>}
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ title, entitled, used, remaining, color, sub }: { title: string; entitled: number; used: number; remaining: number; color: string; sub: string }) {
  return (
    <div className="chart-card p-4">
      <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#636363" }}>{title}</div>
      <div className="text-[18px] font-bold mt-1" style={{ color }}>{remaining} <span className="text-[12px] font-normal" style={{ color: "#636363" }}>remaining</span></div>
      <div className="flex gap-3 mt-1">
        <span className="text-[11px]" style={{ color: "#636363" }}>{entitled} entitled</span>
        <span className="text-[11px]" style={{ color: used > 0 ? color : "#636363" }}>{used} used</span>
      </div>
      <div className="text-[10px] mt-1" style={{ color: "#636363" }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, entitled, used, remaining, color }: { label: string; entitled: number; used: number; remaining: number; color: string }) {
  return (
    <div className="px-3 py-2 rounded-lg" style={{ background: "#0a0a0a" }}>
      <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color }}>{label}</div>
      <div className="text-[14px] font-bold" style={{ color: remaining <= 0 ? "#f87171" : "#f5f5f5" }}>{remaining} <span className="text-[10px] font-normal" style={{ color: "#636363" }}>/ {entitled}</span></div>
      <div className="text-[10px]" style={{ color: used > 0 ? color : "#636363" }}>{used} used</div>
    </div>
  );
}
