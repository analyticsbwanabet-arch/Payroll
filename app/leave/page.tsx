"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, useAuth } from "@/lib/auth-context";

interface LeaveRecord {
  employee_id: string;
  employee_name: string;
  branch_name: string;
  position: string;
  sick_entitled: number;
  sick_used: number;
  sick_remaining: number;
}

export default function LeavePage() {
  const { isSuperAdmin, allowedBranchIds, loading: authLoading } = useAuth();
  const [records, setRecords] = useState<LeaveRecord[]>([]);
  const [filterBranch, setFilterBranch] = useState("all");
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    if (authLoading) return;
    setLoading(true);

    // Get all active employees with their leave balances
    const { data: employees } = await supabase
      .from("employees")
      .select("id, full_name, position, branch_id")
      .eq("employment_status", "active")
      .order("full_name");

    if (!employees || employees.length === 0) { setRecords([]); setLoading(false); return; }

    // Get branches
    const { data: branchData } = await supabase.from("branches").select("id, name");
    const branchMap: Record<string, string> = {};
    (branchData || []).forEach((b: any) => branchMap[b.id] = b.name);

    // Get leave balances
    const { data: balances } = await supabase
      .from("leave_balances")
      .select("employee_id, sick_adj")
      .eq("year", 2026);
    const balanceMap: Record<string, number> = {};
    (balances || []).forEach((b: any) => balanceMap[b.employee_id] = +(b.sick_adj || 0));

    // Count sick leave used from daily logs (sick_authorised from May 2026 onwards)
    const { data: sickLogs } = await supabase
      .from("daily_logs")
      .select("employee_id")
      .eq("attendance_status", "sick_authorised")
      .gte("log_date", "2026-05-01");

    const sickUsed: Record<string, number> = {};
    (sickLogs || []).forEach((l: any) => {
      sickUsed[l.employee_id] = (sickUsed[l.employee_id] || 0) + 1;
    });

    // Build records
    const result: LeaveRecord[] = employees
      .filter((e: any) => {
        if (isSuperAdmin || !allowedBranchIds || allowedBranchIds.length === 0) return true;
        return allowedBranchIds.includes(e.branch_id);
      })
      .map((e: any) => {
        const entitled = balanceMap[e.id] || 10;
        const used = sickUsed[e.id] || 0;
        return {
          employee_id: e.id,
          employee_name: e.full_name,
          branch_name: branchMap[e.branch_id] || "Unknown",
          position: e.position,
          sick_entitled: entitled,
          sick_used: used,
          sick_remaining: entitled - used,
        };
      });

    setRecords(result);
    setLoading(false);
  }, [authLoading, isSuperAdmin, allowedBranchIds]);

  useEffect(() => { loadData(); }, [loadData]);

  const branchNames = Array.from(new Set(records.map(r => r.branch_name))).sort();
  const filtered = filterBranch === "all" ? records : records.filter(r => r.branch_name === filterBranch);

  const totals = filtered.reduce((t, r) => ({
    entitled: t.entitled + r.sick_entitled,
    used: t.used + r.sick_used,
    remaining: t.remaining + r.sick_remaining,
  }), { entitled: 0, used: 0, remaining: 0 });

  if (authLoading) return <div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">🏖️</div></div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Employee Leave Tracker</h1>
          <p className="text-[13px] mt-1" style={{ color: "#636363" }}>Tracking from <span style={{ color: "#4ade80" }}>May 2026</span> onwards • Sick leave resets annually</p>
        </div>
        <div className="flex gap-3">
          {branchNames.length > 1 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Branch</label>
              <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
                className="px-4 py-2.5 rounded-lg text-[13px] min-w-[200px] outline-none"
                style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="all">All Branches ({branchNames.length})</option>
                {branchNames.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Info banner */}
      <div className="px-4 py-3 rounded-lg text-[12px]" style={{ background: "#22d3ee10", border: "1px solid #22d3ee20" }}>
        <span style={{ color: "#22d3ee" }}>ℹ️ Leave Tracking:</span>
        <span style={{ color: "#f5f5f5" }}> Tracking began <strong>May 1, 2026</strong>. Used days are automatically counted from daily logs marked as "Sick Authorised".</span>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="chart-card p-4">
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#636363" }}>Total Entitled</div>
          <div className="text-[20px] font-bold" style={{ color: "#f5f5f5" }}>{totals.entitled} days</div>
          <div className="text-[11px]" style={{ color: "#636363" }}>{filtered.length} employees</div>
        </div>
        <div className="chart-card p-4">
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#636363" }}>Total Used</div>
          <div className="text-[20px] font-bold" style={{ color: totals.used > 0 ? "#fbbf24" : "#636363" }}>{totals.used} days</div>
          <div className="text-[11px]" style={{ color: "#636363" }}>Since May 2026</div>
        </div>
        <div className="chart-card p-4">
          <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#636363" }}>Total Remaining</div>
          <div className="text-[20px] font-bold" style={{ color: "#4ade80" }}>{totals.remaining} days</div>
          <div className="text-[11px]" style={{ color: "#636363" }}>Available</div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="text-2xl animate-pulse">Loading...</div></div>
      ) : (
        <div className="chart-card overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
            <thead>
              <tr>
                {["#", "Employee", "Branch", "Position", "Sick Leave Entitled", "Sick Leave Used", "Sick Leave Remaining", "Status"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b whitespace-nowrap"
                    style={{ textAlign: ["Employee", "Branch", "Position", "Status"].includes(h) ? "left" : "right", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.sort((a, b) => a.branch_name.localeCompare(b.branch_name) || a.employee_name.localeCompare(b.employee_name)).map((r, i) => (
                <tr key={i} className="row-hover">
                  <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: "#636363" }}>{i + 1}</td>
                  <td className="px-3 py-2.5 text-[12px] font-semibold" style={{ color: "#f5f5f5" }}>{r.employee_name}</td>
                  <td className="px-3 py-2.5 text-[11px]" style={{ color: "#636363" }}>{r.branch_name}</td>
                  <td className="px-3 py-2.5 text-[11px]" style={{ color: "#636363" }}>{r.position === "SUPERVISOR" ? "SUPERVISOR" : r.position.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{r.sick_entitled}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.sick_used > 0 ? "#fbbf24" : "#636363" }}>{r.sick_used}</td>
                  <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold" style={{ color: r.sick_remaining <= 2 ? "#f87171" : r.sick_remaining <= 5 ? "#fbbf24" : "#4ade80" }}>{r.sick_remaining}</td>
                  <td className="px-3 py-2.5 text-[11px]">
                    {r.sick_remaining <= 0 ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold" style={{ background: "#f8717120", color: "#f87171" }}>Exhausted</span>
                    ) : r.sick_remaining <= 2 ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold" style={{ background: "#fbbf2420", color: "#fbbf24" }}>Low</span>
                    ) : r.sick_remaining <= 5 ? (
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold" style={{ background: "#fbbf2415", color: "#fbbf24" }}>Moderate</span>
                    ) : (
                      <span className="px-2 py-1 rounded-full text-[10px] font-semibold" style={{ background: "#4ade8015", color: "#4ade80" }}>Available</span>
                    )}
                  </td>
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #22c55e" }}>
                <td colSpan={4} className="px-3 py-3 font-bold text-[12px]" style={{ color: "#22c55e" }}>TOTAL ({filtered.length} employees)</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#22c55e" }}>{totals.entitled}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#fbbf24" }}>{totals.used}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{totals.remaining}</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
