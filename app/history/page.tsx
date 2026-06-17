"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase, useAuth } from "@/lib/auth-context";

function fmt(n: number) { return "K" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function pct(curr: number, prev: number) {
  if (prev === 0) return curr > 0 ? "+100%" : "—";
  const p = ((curr - prev) / prev) * 100;
  return (p >= 0 ? "+" : "") + p.toFixed(1) + "%";
}
function diffColor(curr: number, prev: number, invert = false) {
  if (curr === prev) return "#636363";
  const up = curr > prev;
  return (invert ? !up : up) ? "#4ade80" : "#f87171";
}

interface Period { id: string; period_name: string; start_date: string; }
interface EmpRecord {
  employee_id: string; employee_name: string; branch_name: string;
  gross: number; net: number; napsa: number; nhima: number; paye: number;
  shortages: number; advances: number; fines: number; bonus: number; extraShifts: number;
}

export default function HistoryPage() {
  const { isSuperAdmin, isOwner, allowedBranchIds, loading: authLoading } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [periodA, setPeriodA] = useState("");
  const [periodB, setPeriodB] = useState("");
  const [dataA, setDataA] = useState<EmpRecord[]>([]);
  const [dataB, setDataB] = useState<EmpRecord[]>([]);
  const [filterBranch, setFilterBranch] = useState("all");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from("payroll_periods").select("id, period_name, start_date").order("start_date", { ascending: false });
      const list = data || [];
      setPeriods(list);
      if (list.length >= 2) { setPeriodA(list[0].id); setPeriodB(list[1].id); }
      else if (list.length === 1) { setPeriodA(list[0].id); }
    };
    load();
  }, []);

  const loadPeriodData = useCallback(async (periodId: string): Promise<EmpRecord[]> => {
    if (!periodId) return [];
    const { data: records } = await supabase
      .from("payroll_records")
      .select("employee_id, branch_id, gross_salary, net_salary_due, napsa_employee, nhima_employee, paye_tax, shortage_amount, advances, fines, bonus, extra_shift_total")
      .eq("payroll_period_id", periodId);
    if (!records || records.length === 0) return [];

    const empIds = Array.from(new Set(records.map((r: any) => r.employee_id)));
    let employees: any[] = [];
    for (let i = 0; i < empIds.length; i += 40) {
      const { data } = await supabase.from("employees").select("id, full_name, employment_status, branch_id").in("id", empIds.slice(i, i + 40));
      if (data) employees = employees.concat(data);
    }
    const empMap: Record<string, any> = {};
    employees.forEach(e => empMap[e.id] = e);

    const { data: branchData } = await supabase.from("branches").select("id, name");
    const branchMap: Record<string, string> = {};
    (branchData || []).forEach((b: any) => branchMap[b.id] = b.name);

    return records
      .filter((r: any) => empMap[r.employee_id]?.employment_status === "active")
      .filter((r: any) => {
        if (isSuperAdmin || !allowedBranchIds || allowedBranchIds.length === 0) return true;
        return allowedBranchIds.includes(empMap[r.employee_id]?.branch_id);
      })
      .map((r: any) => ({
        employee_id: r.employee_id,
        employee_name: empMap[r.employee_id]?.full_name || "Unknown",
        branch_name: branchMap[empMap[r.employee_id]?.branch_id] || "Unknown",
        gross: +(r.gross_salary || 0), net: +(r.net_salary_due || 0),
        napsa: +(r.napsa_employee || 0), nhima: +(r.nhima_employee || 0), paye: +(r.paye_tax || 0),
        shortages: +(r.shortage_amount || 0), advances: +(r.advances || 0),
        fines: +(r.fines || 0), bonus: +(r.bonus || 0), extraShifts: +(r.extra_shift_total || 0),
      }));
  }, [isSuperAdmin, allowedBranchIds]);

  const loadComparison = useCallback(async () => {
    if (!periodA || authLoading) return;
    setLoading(true);
    const [a, b] = await Promise.all([loadPeriodData(periodA), periodB ? loadPeriodData(periodB) : Promise.resolve([])]);
    setDataA(a); setDataB(b);
    setLoading(false);
  }, [periodA, periodB, authLoading, loadPeriodData]);

  useEffect(() => { loadComparison(); }, [loadComparison]);

  const branchNames = Array.from(new Set([...dataA.map(d => d.branch_name), ...dataB.map(d => d.branch_name)])).sort();
  const filtA = filterBranch === "all" ? dataA : dataA.filter(d => d.branch_name === filterBranch);
  const filtB = filterBranch === "all" ? dataB : dataB.filter(d => d.branch_name === filterBranch);

  const sum = (arr: EmpRecord[]) => arr.reduce((t, r) => ({
    employees: t.employees + 1, gross: t.gross + r.gross, net: t.net + r.net,
    napsa: t.napsa + r.napsa, nhima: t.nhima + r.nhima, paye: t.paye + r.paye,
    shortages: t.shortages + r.shortages, advances: t.advances + r.advances,
    fines: t.fines + r.fines, bonus: t.bonus + r.bonus, extraShifts: t.extraShifts + r.extraShifts,
  }), { employees: 0, gross: 0, net: 0, napsa: 0, nhima: 0, paye: 0, shortages: 0, advances: 0, fines: 0, bonus: 0, extraShifts: 0 });

  const totA = sum(filtA); const totB = sum(filtB);
  const nameA = periods.find(p => p.id === periodA)?.period_name || "Current";
  const nameB = periods.find(p => p.id === periodB)?.period_name || "Previous";

  // Find anomalies: employees with big changes
  const anomalies: { name: string; branch: string; field: string; prev: number; curr: number }[] = [];
  if (filtB.length > 0) {
    const bMap: Record<string, EmpRecord> = {};
    filtB.forEach(r => bMap[r.employee_id] = r);
    filtA.forEach(a => {
      const b = bMap[a.employee_id];
      if (!b) return;
      if (a.shortages > 0 && a.shortages > b.shortages + 100) anomalies.push({ name: a.employee_name, branch: a.branch_name, field: "Shortages", prev: b.shortages, curr: a.shortages });
      if (a.advances > 0 && a.advances > b.advances + 200) anomalies.push({ name: a.employee_name, branch: a.branch_name, field: "Advances", prev: b.advances, curr: a.advances });
      if (a.fines > 0 && a.fines > b.fines + 50) anomalies.push({ name: a.employee_name, branch: a.branch_name, field: "Fines", prev: b.fines, curr: a.fines });
      if (Math.abs(a.net - b.net) > 500) anomalies.push({ name: a.employee_name, branch: a.branch_name, field: "Net Pay", prev: b.net, curr: a.net });
    });
    // New employees (in A but not in B)
    const bIds = new Set(filtB.map(r => r.employee_id));
    filtA.filter(a => !bIds.has(a.employee_id)).forEach(a => anomalies.push({ name: a.employee_name, branch: a.branch_name, field: "New Employee", prev: 0, curr: a.net }));
    // Departed (in B but not in A)
    const aIds = new Set(filtA.map(r => r.employee_id));
    filtB.filter(b => !aIds.has(b.employee_id)).forEach(b => anomalies.push({ name: b.employee_name, branch: b.branch_name, field: "Departed", prev: b.net, curr: 0 }));
  }

  if (authLoading) return <div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">📊</div></div>;

  if (!isOwner) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-4xl">🔒</div>
        <h2 className="text-lg font-bold" style={{ color: "#f5f5f5" }}>Access Restricted</h2>
        <p className="text-[13px]" style={{ color: "#636363" }}>Payroll History is only accessible to the Owner.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Payroll History</h1>
          <p className="text-[13px] mt-1" style={{ color: "#636363" }}>Compare payroll across months and spot anomalies</p>
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
            <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#4ade80" }}>Current Period</label>
            <select value={periodA} onChange={(e) => setPeriodA(e.target.value)}
              className="px-4 py-2.5 rounded-lg text-[13px] min-w-[180px] outline-none"
              style={{ border: "1px solid #22c55e40", background: "#0a0a0a", color: "#4ade80" }}>
              {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Compare To</label>
            <select value={periodB} onChange={(e) => setPeriodB(e.target.value)}
              className="px-4 py-2.5 rounded-lg text-[13px] min-w-[180px] outline-none"
              style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
              <option value="">None</option>
              {periods.filter(p => p.id !== periodA).map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="text-2xl animate-pulse">Loading...</div></div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <CompareCard label="Headcount" currVal={totA.employees.toString()} prevVal={totB.employees.toString()} diff={totA.employees - totB.employees} showDiff={!!periodB} />
            <CompareCard label="Gross Payroll" currVal={fmt(totA.gross)} prevVal={fmt(totB.gross)} diff={totA.gross - totB.gross} showDiff={!!periodB} />
            <CompareCard label="Net Payout" currVal={fmt(totA.net)} prevVal={fmt(totB.net)} diff={totA.net - totB.net} showDiff={!!periodB} />
            <CompareCard label="NAPSA+NHIMA" currVal={fmt(totA.napsa + totA.nhima)} prevVal={fmt(totB.napsa + totB.nhima)} diff={(totA.napsa + totA.nhima) - (totB.napsa + totB.nhima)} showDiff={!!periodB} />
            <CompareCard label="Shortages" currVal={fmt(totA.shortages)} prevVal={fmt(totB.shortages)} diff={totA.shortages - totB.shortages} showDiff={!!periodB} invert />
            <CompareCard label="Advances" currVal={fmt(totA.advances)} prevVal={fmt(totB.advances)} diff={totA.advances - totB.advances} showDiff={!!periodB} invert />
          </div>

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div className="chart-card">
              <h3 className="text-[13px] font-bold mb-3" style={{ color: "#fbbf24" }}>⚠️ Anomalies & Changes ({anomalies.length})</h3>
              <div className="flex flex-col gap-1.5">
                {anomalies.slice(0, 20).map((a, i) => (
                  <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg text-[12px]"
                    style={{ background: a.field === "New Employee" ? "#22c55e10" : a.field === "Departed" ? "#f8717110" : "#fbbf2410", border: `1px solid ${a.field === "New Employee" ? "#22c55e20" : a.field === "Departed" ? "#f8717120" : "#fbbf2420"}` }}>
                    <span style={{ color: a.field === "New Employee" ? "#4ade80" : a.field === "Departed" ? "#f87171" : "#fbbf24", fontWeight: 600 }}>
                      {a.field === "New Employee" ? "🆕" : a.field === "Departed" ? "👋" : "⚠️"} {a.field}
                    </span>
                    <span style={{ color: "#f5f5f5" }}>{a.name}</span>
                    <span style={{ color: "#636363" }}>({a.branch})</span>
                    {a.field !== "New Employee" && a.field !== "Departed" && (
                      <span style={{ color: "#636363" }}>{fmt(a.prev)} → <span style={{ color: a.curr > a.prev ? "#f87171" : "#4ade80" }}>{fmt(a.curr)}</span></span>
                    )}
                    {a.field === "New Employee" && <span style={{ color: "#4ade80" }}>Net: {fmt(a.curr)}</span>}
                    {a.field === "Departed" && <span style={{ color: "#f87171" }}>Was: {fmt(a.prev)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Per-branch comparison */}
          <div className="chart-card overflow-x-auto">
            <h3 className="text-[13px] font-bold mb-3" style={{ color: "#f5f5f5" }}>Branch Comparison</h3>
            <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
              <thead>
                <tr>
                  {["Branch", "Staff", `Net (${nameA})`, periodB ? `Net (${nameB})` : null, periodB ? "Change" : null].filter(Boolean).map(h => (
                    <th key={h!} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold border-b"
                      style={{ textAlign: h === "Branch" ? "left" : "right", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {branchNames.filter(b => filterBranch === "all" || b === filterBranch).map(branch => {
                  const aTotal = dataA.filter(d => d.branch_name === branch).reduce((s, r) => s + r.net, 0);
                  const bTotal = dataB.filter(d => d.branch_name === branch).reduce((s, r) => s + r.net, 0);
                  const aCount = dataA.filter(d => d.branch_name === branch).length;
                  return (
                    <tr key={branch} className="row-hover">
                      <td className="px-3 py-2.5 text-[12px] font-semibold" style={{ color: "#f5f5f5" }}>{branch}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{aCount}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#4ade80" }}>{fmt(aTotal)}</td>
                      {periodB && <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#636363" }}>{fmt(bTotal)}</td>}
                      {periodB && <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: diffColor(aTotal, bTotal) }}>{pct(aTotal, bTotal)}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Employee-level detail */}
          <div className="chart-card overflow-x-auto">
            <h3 className="text-[13px] font-bold mb-3" style={{ color: "#f5f5f5" }}>Employee Detail — {nameA}</h3>
            <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
              <thead>
                <tr>
                  {["Employee", "Branch", "Gross", "Bonus", "Shortages", "Advances", "Fines", "Net Pay", periodB ? `Prev Net` : null, periodB ? "Δ" : null].filter(Boolean).map(h => (
                    <th key={h!} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold border-b whitespace-nowrap"
                      style={{ textAlign: h === "Employee" || h === "Branch" ? "left" : "right", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtA.sort((a, b) => a.branch_name.localeCompare(b.branch_name) || a.employee_name.localeCompare(b.employee_name)).map((r, i) => {
                  const prev = filtB.find(b => b.employee_id === r.employee_id);
                  return (
                    <tr key={i} className="row-hover">
                      <td className="px-3 py-2 text-[12px]" style={{ color: "#f5f5f5" }}>{r.employee_name}</td>
                      <td className="px-3 py-2 text-[11px]" style={{ color: "#636363" }}>{r.branch_name}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: "#f5f5f5" }}>{fmt(r.gross)}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: r.bonus > 0 ? "#4ade80" : "#636363" }}>{r.bonus > 0 ? fmt(r.bonus) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: r.shortages > 0 ? "#f87171" : "#636363" }}>{r.shortages > 0 ? fmt(r.shortages) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: r.advances > 0 ? "#fbbf24" : "#636363" }}>{r.advances > 0 ? fmt(r.advances) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: r.fines > 0 ? "#f87171" : "#636363" }}>{r.fines > 0 ? fmt(r.fines) : "—"}</td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] font-semibold" style={{ color: "#4ade80" }}>{fmt(r.net)}</td>
                      {periodB && <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: "#636363" }}>{prev ? fmt(prev.net) : "—"}</td>}
                      {periodB && prev && <td className="px-3 py-2 text-right font-mono text-[11px]" style={{ color: diffColor(r.net, prev.net) }}>{pct(r.net, prev.net)}</td>}
                      {periodB && !prev && <td className="px-3 py-2 text-right text-[10px]" style={{ color: "#4ade80" }}>NEW</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function CompareCard({ label, currVal, prevVal, diff, showDiff, invert }: { label: string; currVal: string; prevVal: string; diff: number; showDiff: boolean; invert?: boolean }) {
  const color = diff === 0 ? "#636363" : (invert ? diff < 0 : diff > 0) ? "#4ade80" : "#f87171";
  return (
    <div className="chart-card flex flex-col gap-1 p-4">
      <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#636363" }}>{label}</div>
      <div className="text-[16px] font-bold" style={{ color: "#f5f5f5" }}>{currVal}</div>
      {showDiff && (
        <div className="flex items-center gap-2">
          <span className="text-[10px]" style={{ color: "#636363" }}>was {prevVal}</span>
          <span className="text-[10px] font-semibold" style={{ color }}>
            {diff > 0 ? "↑" : diff < 0 ? "↓" : "="} {diff !== 0 ? (typeof diff === "number" && label !== "Headcount" ? fmt(Math.abs(diff)) : Math.abs(diff).toString()) : ""}
          </span>
        </div>
      )}
    </div>
  );
}
