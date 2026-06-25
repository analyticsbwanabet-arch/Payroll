"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, useAuth } from "@/lib/auth-context";

interface SummaryRecord {
  employee_id: string; employee_name: string; branch_name: string; position: string;
  days_worked: number; days_present: number; days_late: number; days_absent: number;
  days_leave: number; night_shifts: number; extra_shifts: number;
  shortages: number; advances: number; fines: number; bonuses: number;
}

interface DayDetail {
  date: string; attendance: string; label: string; color: string;
  shortage: number; advance: number; fine: number; bonus: number; extra_shifts: number; comments: string;
}

interface Period { id: string; period_name: string; start_date: string; end_date: string; }

function fmt(n: number) { return "K" + n.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 }); }
function fmtDec(n: number) { return "K" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  present: { label: "Present", color: "#4ade80" },
  late: { label: "Late", color: "#fbbf24" },
  night_shift: { label: "Night Shift", color: "#a78bfa" },
  extra_shift: { label: "Extra Shift", color: "#22d3ee" },
  absent_no_reason: { label: "Absent (No Reason)", color: "#f87171" },
  absent_authorised: { label: "Absent Authorised", color: "#fbbf24" },
  sick_authorised: { label: "Sick Leave", color: "#fbbf24" },
  on_leave: { label: "On Leave", color: "#22d3ee" },
  on_leave_no_pay: { label: "Leave (No Pay)", color: "#636363" },
  maternity_leave: { label: "Maternity Leave", color: "#f472b6" },
  off_day: { label: "Off Day", color: "#636363" },
  trainee: { label: "Trainee", color: "#22d3ee" },
  "": { label: "Not Set", color: "#636363" },
};

export default function SummaryPage() {
  const { isSuperAdmin, allowedBranchIds, loading: authLoading } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [records, setRecords] = useState<SummaryRecord[]>([]);
  const [filterBranch, setFilterBranch] = useState("all");
  const [loading, setLoading] = useState(true);
  const [selectedEmp, setSelectedEmp] = useState<string | null>(null);
  const [dayDetails, setDayDetails] = useState<DayDetail[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("payroll_periods").select("id, period_name, start_date, end_date").order("start_date", { ascending: false });
      const list = data || [];
      setPeriods(list);
      if (list.length > 0) setSelectedPeriod(list[0].id);
    };
    load();
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedPeriod || authLoading) return;
    setLoading(true);
    setSelectedEmp(null);

    const period = periods.find(p => p.id === selectedPeriod);
    if (!period) { setLoading(false); return; }

    const { data: summaries } = await supabase
      .from("monthly_employee_summary")
      .select("employee_id, days_worked, days_present, days_late, days_absent, days_leave, night_shift_count, total_extra_shifts, total_shortages, total_advances, total_fines, total_bonuses")
      .eq("month", period.start_date);

    if (!summaries || summaries.length === 0) { setRecords([]); setLoading(false); return; }

    const empIds = Array.from(new Set(summaries.map((s: any) => s.employee_id)));
    let employees: any[] = [];
    for (let i = 0; i < empIds.length; i += 40) {
      const { data } = await supabase.from("employees").select("id, full_name, position, branch_id, employment_status").in("id", empIds.slice(i, i + 40));
      if (data) employees = employees.concat(data);
    }
    const empMap: Record<string, any> = {};
    employees.forEach(e => empMap[e.id] = e);

    const { data: branchData } = await supabase.from("branches").select("id, name");
    const branchMap: Record<string, string> = {};
    (branchData || []).forEach((b: any) => branchMap[b.id] = b.name);

    const agg: Record<string, SummaryRecord> = {};
    summaries.forEach((s: any) => {
      const emp = empMap[s.employee_id];
      if (!emp || emp.employment_status !== "active") return;
      if (!isSuperAdmin && allowedBranchIds && allowedBranchIds.length > 0 && !allowedBranchIds.includes(emp.branch_id)) return;
      if (!agg[s.employee_id]) {
        agg[s.employee_id] = {
          employee_id: s.employee_id, employee_name: emp.full_name,
          branch_name: branchMap[emp.branch_id] || "Unknown", position: emp.position,
          days_worked: 0, days_present: 0, days_late: 0, days_absent: 0, days_leave: 0,
          night_shifts: 0, extra_shifts: 0, shortages: 0, advances: 0, fines: 0, bonuses: 0,
        };
      }
      const r = agg[s.employee_id];
      r.days_worked += +(s.days_worked || 0); r.days_present += +(s.days_present || 0);
      r.days_late += +(s.days_late || 0); r.days_absent += +(s.days_absent || 0);
      r.days_leave += +(s.days_leave || 0); r.night_shifts += +(s.night_shift_count || 0);
      r.extra_shifts += +(s.total_extra_shifts || 0); r.shortages += +(s.total_shortages || 0);
      r.advances += +(s.total_advances || 0); r.fines += +(s.total_fines || 0);
      r.bonuses += +(s.total_bonuses || 0);
    });

    setRecords(Object.values(agg));
    setLoading(false);
  }, [selectedPeriod, authLoading, isSuperAdmin, allowedBranchIds, periods]);

  useEffect(() => { loadData(); }, [loadData]);

  const loadEmployeeDetails = async (empId: string) => {
    if (selectedEmp === empId) { setSelectedEmp(null); return; }
    setSelectedEmp(empId);
    setDetailLoading(true);

    const period = periods.find(p => p.id === selectedPeriod);
    if (!period) { setDetailLoading(false); return; }

    const { data } = await supabase
      .from("daily_logs")
      .select("log_date, attendance_status, shortage_amount, advance_amount, fine_amount, bonus_amount, extra_shifts_worked, comments")
      .eq("employee_id", empId)
      .gte("log_date", period.start_date)
      .lte("log_date", period.end_date)
      .order("log_date", { ascending: true });

    setDayDetails((data || []).map((d: any) => ({
      date: d.log_date,
      attendance: d.attendance_status,
      label: STATUS_LABELS[d.attendance_status]?.label || d.attendance_status,
      color: STATUS_LABELS[d.attendance_status]?.color || "#636363",
      shortage: +(d.shortage_amount || 0),
      advance: +(d.advance_amount || 0),
      fine: +(d.fine_amount || 0),
      bonus: +(d.bonus_amount || 0),
      extra_shifts: +(d.extra_shifts_worked || 0),
      comments: d.comments || "",
    })));
    setDetailLoading(false);
  };

  const branchNames = Array.from(new Set(records.map(r => r.branch_name))).sort();
  const filtered = filterBranch === "all" ? records : records.filter(r => r.branch_name === filterBranch);
  const sorted = filtered.sort((a, b) => a.branch_name.localeCompare(b.branch_name) || a.employee_name.localeCompare(b.employee_name));
  const selectedRecord = records.find(r => r.employee_id === selectedEmp);

  const totals = filtered.reduce((t, r) => ({
    days_worked: t.days_worked + r.days_worked, days_present: t.days_present + r.days_present,
    days_late: t.days_late + r.days_late, days_absent: t.days_absent + r.days_absent,
    days_leave: t.days_leave + r.days_leave, night_shifts: t.night_shifts + r.night_shifts,
    extra_shifts: t.extra_shifts + r.extra_shifts, shortages: t.shortages + r.shortages,
    advances: t.advances + r.advances, fines: t.fines + r.fines, bonuses: t.bonuses + r.bonuses,
  }), { days_worked: 0, days_present: 0, days_late: 0, days_absent: 0, days_leave: 0, night_shifts: 0, extra_shifts: 0, shortages: 0, advances: 0, fines: 0, bonuses: 0 });

  const periodName = periods.find(p => p.id === selectedPeriod)?.period_name || "";

  const formatDate = (d: string) => {
    const dt = new Date(d + "T00:00:00");
    return dt.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });
  };

  // Detail totals
  const detailTotals = dayDetails.reduce((t, d) => ({
    shortages: t.shortages + d.shortage, advances: t.advances + d.advance,
    fines: t.fines + d.fine, bonuses: t.bonuses + d.bonus,
  }), { shortages: 0, advances: 0, fines: 0, bonuses: 0 });

  if (authLoading) return <div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">📊</div></div>;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Monthly Summary</h1>
          <p className="text-[13px] mt-1" style={{ color: "#636363" }}>Daily log totals for {periodName} • Click an employee for daily breakdown</p>
        </div>
        <div className="flex gap-3 flex-wrap">
          {branchNames.length > 1 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Branch</label>
              <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
                className="px-4 py-2.5 rounded-lg text-[13px] min-w-[180px] outline-none"
                style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="all">All Branches ({branchNames.length})</option>
                {branchNames.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Month</label>
            <select value={selectedPeriod} onChange={(e) => { setSelectedPeriod(e.target.value); setFilterBranch("all"); }}
              className="px-4 py-2.5 rounded-lg text-[13px] min-w-[180px] outline-none"
              style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
              {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card label="Employees" value={filtered.length.toString()} sub={`${branchNames.length} branches`} color="#22c55e" />
        <Card label="Total Shortages" value={fmt(totals.shortages)} sub="Cash shortages" color="#f87171" />
        <Card label="Total Advances" value={fmt(totals.advances)} sub="Staff advances" color="#fbbf24" />
        <Card label="Total Fines" value={fmt(totals.fines)} sub="Lateness / conduct" color="#f87171" />
        <Card label="Total Bonuses" value={fmt(totals.bonuses)} sub="Performance" color="#4ade80" />
        <Card label="Night Shifts" value={totals.night_shifts.toString()} sub="Total across all" color="#a78bfa" />
      </div>

      {/* Employee detail panel */}
      {selectedEmp && selectedRecord && (
        <div className="chart-card" style={{ border: "1px solid #22c55e30" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-[14px] font-bold" style={{ color: "#f5f5f5" }}>{selectedRecord.employee_name}</h3>
              <p className="text-[11px]" style={{ color: "#636363" }}>{selectedRecord.branch_name} • {periodName}</p>
            </div>
            <button onClick={() => setSelectedEmp(null)} className="px-3 py-1 rounded-lg text-[11px]" style={{ background: "#1c1c1c", color: "#636363", border: "1px solid #2a2a2a" }}>✕ Close</button>
          </div>

          {/* Mini summary */}
          <div className="grid grid-cols-4 gap-3 mb-4">
            <MiniStat label="Shortages" value={fmtDec(detailTotals.shortages)} color="#f87171" />
            <MiniStat label="Advances" value={fmtDec(detailTotals.advances)} color="#fbbf24" />
            <MiniStat label="Fines" value={fmtDec(detailTotals.fines)} color="#f87171" />
            <MiniStat label="Bonuses" value={fmtDec(detailTotals.bonuses)} color="#4ade80" />
          </div>

          {detailLoading ? (
            <div className="text-center py-4 text-[13px]" style={{ color: "#636363" }}>Loading daily breakdown...</div>
          ) : dayDetails.length === 0 ? (
            <div className="text-center py-4 text-[13px]" style={{ color: "#636363" }}>No daily log entries for {periodName}</div>
          ) : (
            <div style={{ maxHeight: "400px", overflowY: "auto" }}>
              <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 1px" }}>
                <thead>
                  <tr>
                    {["Date", "Status", "Shortage", "Advance", "Fine", "Bonus", "Shifts+", "Comments"].map(h => (
                      <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold border-b sticky top-0"
                        style={{ textAlign: ["Date", "Status", "Comments"].includes(h) ? "left" : "right", color: "#636363", borderColor: "#2a2a2a", background: "#111" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {dayDetails.map((d, i) => {
                    const hasAmount = d.shortage > 0 || d.advance > 0 || d.fine > 0 || d.bonus > 0;
                    return (
                      <tr key={i} style={{ background: hasAmount ? "#fbbf2408" : undefined }}>
                        <td className="px-3 py-2 text-[12px] whitespace-nowrap" style={{ color: "#f5f5f5" }}>{formatDate(d.date)}</td>
                        <td className="px-3 py-2">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold" style={{ background: d.color + "20", color: d.color }}>{d.label}</span>
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: d.shortage > 0 ? "#f87171" : "#333" }}>{d.shortage > 0 ? fmtDec(d.shortage) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: d.advance > 0 ? "#fbbf24" : "#333" }}>{d.advance > 0 ? fmtDec(d.advance) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: d.fine > 0 ? "#f87171" : "#333" }}>{d.fine > 0 ? fmtDec(d.fine) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: d.bonus > 0 ? "#4ade80" : "#333" }}>{d.bonus > 0 ? fmtDec(d.bonus) : "—"}</td>
                        <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: d.extra_shifts > 0 ? "#22d3ee" : "#333" }}>{d.extra_shifts > 0 ? d.extra_shifts : "—"}</td>
                        <td className="px-3 py-2 text-[11px]" style={{ color: d.comments ? "#f5f5f5" : "#333", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.comments || "—"}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ borderTop: "2px solid #22c55e" }}>
                    <td colSpan={2} className="px-3 py-2 font-bold text-[11px]" style={{ color: "#22c55e" }}>TOTAL ({dayDetails.length} days logged)</td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#f87171" }}>{detailTotals.shortages > 0 ? fmtDec(detailTotals.shortages) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#fbbf24" }}>{detailTotals.advances > 0 ? fmtDec(detailTotals.advances) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#f87171" }}>{detailTotals.fines > 0 ? fmtDec(detailTotals.fines) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[11px] font-bold" style={{ color: "#4ade80" }}>{detailTotals.bonuses > 0 ? fmtDec(detailTotals.bonuses) : "—"}</td>
                    <td colSpan={2}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="text-2xl animate-pulse">Loading...</div></div>
      ) : sorted.length === 0 ? (
        <div className="chart-card text-center py-12">
          <p style={{ color: "#636363" }}>No daily log records found for {periodName}</p>
        </div>
      ) : (
        <div className="chart-card overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
            <thead>
              <tr>
                {["#", "Employee", "Branch", "Days", "Present", "Late", "Absent", "Leave", "Night", "Shifts+", "Shortages", "Advances", "Fines", "Bonuses"].map(h => (
                  <th key={h} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b whitespace-nowrap"
                    style={{ textAlign: ["Employee", "Branch"].includes(h) ? "left" : "right", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((r, i) => {
                const isSelected = selectedEmp === r.employee_id;
                return (
                  <tr key={i} className="row-hover cursor-pointer" onClick={() => loadEmployeeDetails(r.employee_id)}
                    style={{ background: isSelected ? "#22c55e10" : undefined }}>
                    <td className="px-3 py-2 text-right text-[12px]" style={{ color: "#636363" }}>{i + 1}</td>
                    <td className="px-3 py-2 text-[12px] font-semibold" style={{ color: isSelected ? "#4ade80" : "#f5f5f5" }}>
                      {r.employee_name} {isSelected && <span className="text-[10px]" style={{ color: "#4ade80" }}>▼</span>}
                    </td>
                    <td className="px-3 py-2 text-[11px]" style={{ color: "#636363" }}>{r.branch_name}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{r.days_worked}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: "#4ade80" }}>{r.days_present || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.days_late > 0 ? "#fbbf24" : "#636363" }}>{r.days_late || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.days_absent > 0 ? "#f87171" : "#636363" }}>{r.days_absent || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.days_leave > 0 ? "#22d3ee" : "#636363" }}>{r.days_leave || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.night_shifts > 0 ? "#a78bfa" : "#636363" }}>{r.night_shifts || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.extra_shifts > 0 ? "#22d3ee" : "#636363" }}>{r.extra_shifts || "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.shortages > 0 ? "#f87171" : "#636363" }}>{r.shortages > 0 ? fmt(r.shortages) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.advances > 0 ? "#fbbf24" : "#636363" }}>{r.advances > 0 ? fmt(r.advances) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.fines > 0 ? "#f87171" : "#636363" }}>{r.fines > 0 ? fmt(r.fines) : "—"}</td>
                    <td className="px-3 py-2 text-right font-mono text-[12px]" style={{ color: r.bonuses > 0 ? "#4ade80" : "#636363" }}>{r.bonuses > 0 ? fmt(r.bonuses) : "—"}</td>
                  </tr>
                );
              })}
              <tr style={{ borderTop: "2px solid #22c55e" }}>
                <td colSpan={3} className="px-3 py-3 font-bold text-[12px]" style={{ color: "#22c55e" }}>TOTAL ({filtered.length})</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#22c55e" }}>{totals.days_worked}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{totals.days_present}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#fbbf24" }}>{totals.days_late}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#f87171" }}>{totals.days_absent}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#22d3ee" }}>{totals.days_leave}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#a78bfa" }}>{totals.night_shifts}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#22d3ee" }}>{totals.extra_shifts}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#f87171" }}>{fmt(totals.shortages)}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#fbbf24" }}>{fmt(totals.advances)}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#f87171" }}>{fmt(totals.fines)}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{fmt(totals.bonuses)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Card({ label, value, sub, color }: { label: string; value: string; sub: string; color: string }) {
  return (
    <div className="chart-card p-4">
      <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#636363" }}>{label}</div>
      <div className="text-[18px] font-bold mt-1" style={{ color }}>{value}</div>
      <div className="text-[10px] mt-1" style={{ color: "#636363" }}>{sub}</div>
    </div>
  );
}

function MiniStat({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-3 py-2 rounded-lg" style={{ background: "#0a0a0a" }}>
      <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color }}>{label}</div>
      <div className="text-[14px] font-bold mt-1" style={{ color: "#f5f5f5" }}>{value}</div>
    </div>
  );
}
