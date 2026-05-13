"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { supabase, useAuth } from "@/lib/auth-context";

const COLORS = ["#22c55e", "#facc15", "#4ade80", "#fbbf24", "#22d3ee", "#a78bfa"];

interface Period { id: string; period_name: string; }
interface BranchRow {
  branch: string; employees: number; gross: number; extraShifts: number;
  napsa: number; nhima: number; shortages: number; advances: number; fines: number; net: number;
}

function fmt(n: number) { return "K" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

export default function BranchesPage() {
  const { isSuperAdmin, allowedBranchIds, loading: authLoading } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [branches, setBranches] = useState<BranchRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPeriods = async () => {
      const { data } = await supabase
        .from("payroll_periods")
        .select("id, period_name")
        .order("start_date", { ascending: false });
      const list = data || [];
      setPeriods(list);
      if (list.length > 0) setSelectedPeriod(list[0].id);
    };
    loadPeriods();
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedPeriod || authLoading) return;
    setLoading(true);

    const { data: records } = await supabase
      .from("payroll_records")
      .select("employee_id, branch_id, gross_salary, net_salary_due, napsa_employee, nhima_employee, extra_shift_total, shortage_amount, advances, fines")
      .eq("payroll_period_id", selectedPeriod);

    if (!records || records.length === 0) { setBranches([]); setLoading(false); return; }

    const empIds = Array.from(new Set(records.map((r: any) => r.employee_id)));
    let employees: any[] = [];
    for (let i = 0; i < empIds.length; i += 40) {
      const { data } = await supabase.from("employees").select("id, employment_status, branch_id").in("id", empIds.slice(i, i + 40));
      if (data) employees = employees.concat(data);
    }
    const empMap: Record<string, any> = {};
    employees.forEach(e => empMap[e.id] = e);

    const { data: branchData } = await supabase.from("branches").select("id, name");
    const branchMap: Record<string, string> = {};
    (branchData || []).forEach((b: any) => branchMap[b.id] = b.name);

    const agg: Record<string, BranchRow> = {};
    records.forEach((r: any) => {
      const emp = empMap[r.employee_id];
      if (!emp || emp.employment_status !== "active") return;
      const currentBranchId = emp.branch_id;
      if (!isSuperAdmin && allowedBranchIds && allowedBranchIds.length > 0) {
        if (!allowedBranchIds.includes(currentBranchId)) return;
      }
      const branchName = branchMap[currentBranchId] || "Unknown";
      if (!agg[branchName]) {
        agg[branchName] = { branch: branchName, employees: 0, gross: 0, extraShifts: 0, napsa: 0, nhima: 0, shortages: 0, advances: 0, fines: 0, net: 0 };
      }
      const b = agg[branchName];
      b.employees++;
      b.gross += +(r.gross_salary || 0);
      b.net += +(r.net_salary_due || 0);
      b.napsa += +(r.napsa_employee || 0);
      b.nhima += +(r.nhima_employee || 0);
      b.extraShifts += +(r.extra_shift_total || 0);
      b.shortages += +(r.shortage_amount || 0);
      b.advances += +(r.advances || 0);
      b.fines += +(r.fines || 0);
    });

    setBranches(Object.values(agg).sort((a, b) => a.branch.localeCompare(b.branch)));
    setLoading(false);
  }, [selectedPeriod, authLoading, isSuperAdmin, allowedBranchIds]);

  useEffect(() => { loadData(); }, [loadData]);

  const totals = branches.reduce((t, r) => ({
    employees: t.employees + r.employees, gross: t.gross + r.gross, extraShifts: t.extraShifts + r.extraShifts,
    napsa: t.napsa + r.napsa, nhima: t.nhima + r.nhima, shortages: t.shortages + r.shortages,
    advances: t.advances + r.advances, fines: t.fines + r.fines, net: t.net + r.net,
  }), { employees: 0, gross: 0, extraShifts: 0, napsa: 0, nhima: 0, shortages: 0, advances: 0, fines: 0, net: 0 });

  const periodName = periods.find(p => p.id === selectedPeriod)?.period_name || "";
  const headers = ["Branch", "Staff", "Gross Pay", "Extra Shifts", "NAPSA+NHIMA", "Shortages", "Advances", "Fines", "Net Pay"];

  if (authLoading) {
    return <div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">🏢</div></div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Branch Payroll Summary</h1>
          <p className="text-[13px] mt-1" style={{ color: "#636363" }}>
            {periodName} {!isSuperAdmin && ` • Showing ${branches.length} branch${branches.length !== 1 ? "es" : ""}`}
          </p>
        </div>
        <div>
          <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Payroll Period</label>
          <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-4 py-2.5 rounded-lg text-[13px] min-w-[200px] outline-none"
            style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
            {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="text-2xl animate-pulse">Loading...</div></div>
      ) : branches.length === 0 ? (
        <div className="chart-card text-center py-12">
          <p style={{ color: "#636363" }}>No payroll records found for {periodName}</p>
        </div>
      ) : (
        <div className="chart-card overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
            <thead>
              <tr>
                {headers.map((h) => (
                  <th key={h} className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b"
                    style={{ textAlign: h === "Branch" ? "left" : "right", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {branches.map((row, i) => (
                <tr key={i} className="row-hover cursor-pointer transition-colors">
                  <td className="px-4 py-3.5 font-semibold" style={{ color: "#f5f5f5" }}>
                    <Link href={`/employees?branch=${encodeURIComponent(row.branch)}`} className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                      {row.branch}
                    </Link>
                  </td>
                  <Cell value={row.employees} bold />
                  <Cell value={fmt(row.gross)} />
                  <Cell value={row.extraShifts > 0 ? fmt(row.extraShifts) : "—"} color={row.extraShifts > 0 ? "#22d3ee" : undefined} />
                  <Cell value={fmt(row.napsa + row.nhima)} color="#facc15" />
                  <Cell value={row.shortages > 0 ? fmt(row.shortages) : "—"} color={row.shortages > 0 ? "#f87171" : undefined} />
                  <Cell value={row.advances > 0 ? fmt(row.advances) : "—"} color={row.advances > 0 ? "#fbbf24" : undefined} />
                  <Cell value={row.fines > 0 ? fmt(row.fines) : "—"} color={row.fines > 0 ? "#f87171" : undefined} />
                  <Cell value={fmt(row.net)} color="#4ade80" bold />
                </tr>
              ))}
              <tr style={{ borderTop: "2px solid #22c55e" }}>
                <td className="px-4 py-3.5 font-bold" style={{ color: "#22c55e" }}>TOTAL</td>
                <TotalCell value={totals.employees} />
                <TotalCell value={fmt(totals.gross)} />
                <TotalCell value={fmt(totals.extraShifts)} />
                <TotalCell value={fmt(totals.napsa + totals.nhima)} />
                <TotalCell value={fmt(totals.shortages)} />
                <TotalCell value={fmt(totals.advances)} />
                <TotalCell value={fmt(totals.fines)} />
                <TotalCell value={fmt(totals.net)} />
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Cell({ value, color, bold }: { value: string | number; color?: string; bold?: boolean }) {
  return (
    <td className="px-4 py-3.5 text-right font-mono text-[12px]"
      style={{ color: color || (value === "—" ? "#636363" : "#f5f5f5"), fontWeight: bold ? 700 : 400 }}>{value}</td>
  );
}
function TotalCell({ value }: { value: string | number }) {
  return <td className="px-4 py-3.5 text-right font-mono text-[12px] font-bold" style={{ color: "#22c55e" }}>{value}</td>;
}
