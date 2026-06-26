"use client";

import { useState, useCallback, useEffect } from "react";
import { useAuth, supabase } from "@/lib/auth-context";

interface Period { id: string; period_name: string; start_date: string; end_date: string; is_finalized: boolean; }

interface FullPayrollRecord {
  employee_id: string; employee_name: string; position: string; branch_name: string;
  basic_salary: number; gross_salary: number; net_salary_due: number;
  napsa_employee: number; nhima_employee: number; paye_tax: number;
  extra_shifts_count: number; extra_shift_total: number; bonus: number;
  shortage_amount: number; advances: number; fines: number;
  absent_days: number; absence_deduction: number; other_deductions: number; comments: string | null;
}

const fmt = (n: number | string) => `K${Number(n || 0).toLocaleString("en", { maximumFractionDigits: 0 })}`;
const fmtDec = (n: number | string) => `K${Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayrollGenerator({ periods }: { periods: Period[] }) {
  const { allowedBranchIds, isSuperAdmin, readOnly } = useAuth();
  const [periodId, setPeriodId] = useState("");
  const [payrollRecords, setPayrollRecords] = useState<FullPayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState<string | null>(null);
  const [filterBranch, setFilterBranch] = useState<string>("all");

  const selectedPeriod = periods.find((p) => p.id === periodId);

  const fetchPayrollRecords = useCallback(async () => {
    if (!periodId) return;
    setLoading(true); setError(null);

    const { data: records, error: err } = await supabase
      .from("payroll_records")
      .select("*")
      .eq("payroll_period_id", periodId);

    if (err || !records) { setError(err?.message || "Failed to load"); setLoading(false); return; }

    const empIds = Array.from(new Set(records.map((r: any) => r.employee_id)));
    let employees: any[] = [];
    for (let i = 0; i < empIds.length; i += 40) {
      const { data } = await supabase.from("employees").select("id, full_name, position, basic_pay, branch_id, employment_status").in("id", empIds.slice(i, i + 40));
      if (data) employees = employees.concat(data);
    }
    const empMap: Record<string, any> = {};
    const currentBranchIds = new Set<string>();
    employees.forEach((e) => { empMap[e.id] = e; if (e.branch_id) currentBranchIds.add(e.branch_id); });

    const allBranchIds = Array.from(new Set([...records.map((r: any) => r.branch_id), ...Array.from(currentBranchIds)]));
    let branches: any[] = [];
    for (let i = 0; i < allBranchIds.length; i += 40) {
      const { data } = await supabase.from("branches").select("id, name").in("id", allBranchIds.slice(i, i + 40));
      if (data) branches = branches.concat(data);
    }
    const branchMap: Record<string, any> = {};
    branches.forEach((b: any) => (branchMap[b.id] = b));

    let fullRecords: FullPayrollRecord[] = records
      .filter((r: any) => empMap[r.employee_id]?.employment_status === "active")
      .map((r: any) => ({
        employee_id: r.employee_id,
        employee_name: empMap[r.employee_id]?.full_name || "Unknown",
        position: empMap[r.employee_id]?.position || "unknown",
        branch_name: branchMap[empMap[r.employee_id]?.branch_id]?.name || branchMap[r.branch_id]?.name || "Unknown",
        basic_salary: +(empMap[r.employee_id]?.basic_pay || r.basic_pay || r.gross_salary || 0),
        gross_salary: +(r.gross_salary || 0), net_salary_due: +(r.net_salary_due || 0),
        napsa_employee: +(r.napsa_employee || 0), nhima_employee: +(r.nhima_employee || 0), paye_tax: +(r.paye_tax || 0),
        extra_shifts_count: +(r.extra_shifts_count || 0), extra_shift_total: +(r.extra_shift_total || 0),
        bonus: +(r.bonus || 0), shortage_amount: +(r.shortage_amount || 0), advances: +(r.advances || 0),
        fines: +(r.fines || 0), absent_days: +(r.absent_days || 0), absence_deduction: +(r.absence_deduction || 0),
        other_deductions: +(r.other_deductions || 0), comments: r.comments,
      }));

    setPayrollRecords(fullRecords);
    setLoading(false);
  }, [periodId]);

  // Auto-load when period changes
  useEffect(() => { if (periodId) fetchPayrollRecords(); }, [periodId, fetchPayrollRecords]);

  const generatePayroll = async () => {
    if (!periodId || !selectedPeriod) return;
    setGenerating(true); setError(null);

    const { error: rpcErr } = await supabase.rpc("generate_payroll_from_daily_logs", {
      p_period_id: periodId,
      p_month: selectedPeriod.start_date,
    });

    if (rpcErr) { setError(rpcErr.message); setGenerating(false); return; }
    await fetchPayrollRecords();
    setGenerating(false);
  };

  const downloadPayslip = async (record: FullPayrollRecord) => {
    setDownloading(record.employee_id);
    const { downloadPayslip: dl } = await import("@/lib/payslip");
    dl({ ...record, period_name: selectedPeriod?.period_name || "", period_start: selectedPeriod?.start_date || "", period_end: selectedPeriod?.end_date || "" });
    setDownloading(null);
  };

  const downloadAllPayslips = async () => {
    setDownloading("all");
    const { downloadAllPayslips: dlAll } = await import("@/lib/payslip");
    dlAll(filteredPayroll.map((r) => ({ ...r, period_name: selectedPeriod?.period_name || "", period_start: selectedPeriod?.start_date || "", period_end: selectedPeriod?.end_date || "" })));
    setDownloading(null);
  };

  // Branch filter
  const branchNames = Array.from(new Set(payrollRecords.map(r => r.branch_name))).sort();
  const filteredPayroll = filterBranch === "all" ? payrollRecords : payrollRecords.filter(r => r.branch_name === filterBranch);

  const totals = filteredPayroll.reduce((t, r) => ({
    count: t.count + 1, gross: t.gross + r.gross_salary, net: t.net + r.net_salary_due,
    napsa: t.napsa + r.napsa_employee, nhima: t.nhima + r.nhima_employee, paye: t.paye + r.paye_tax,
    bonus: t.bonus + r.bonus, shortages: t.shortages + r.shortage_amount,
    advances: t.advances + r.advances, fines: t.fines + r.fines,
  }), { count: 0, gross: 0, net: 0, napsa: 0, nhima: 0, paye: 0, bonus: 0, shortages: 0, advances: 0, fines: 0 });

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="chart-card flex flex-col gap-4">
        <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Payroll</h1>
        <div className="flex items-end gap-3 flex-wrap">
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Payroll Period</label>
            <select value={periodId} onChange={(e) => { setPeriodId(e.target.value); setPayrollRecords([]); setFilterBranch("all"); }}
              className="px-4 py-2.5 rounded-lg text-[13px] min-w-[220px] outline-none"
              style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
              <option value="">Select period...</option>
              {periods.map((p) => <option key={p.id} value={p.id}>{p.period_name}</option>)}
            </select>
          </div>
          {branchNames.length > 1 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Filter by Store</label>
              <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
                className="px-4 py-2.5 rounded-lg text-[13px] min-w-[200px] outline-none"
                style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="all">All Stores ({branchNames.length})</option>
                {branchNames.map(b => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          )}
          {periodId && !readOnly && (
            <button onClick={generatePayroll} disabled={generating}
              className="px-6 py-2.5 rounded-lg font-bold text-[13px]"
              style={{ background: "#facc15", color: "#000", opacity: generating ? 0.5 : 1 }}>
              {generating ? "⏳ Generating..." : "⚡ Generate Payroll"}
            </button>
          )}
        </div>
        {error && <div className="text-[12px] px-3 py-2 rounded-lg" style={{ background: "#f8717115", color: "#f87171", border: "1px solid #f8717130" }}>❌ {error}</div>}
      </div>

      {/* Loading */}
      {loading && <div className="flex items-center justify-center py-12"><div className="text-2xl animate-pulse">Loading payroll...</div></div>}

      {/* Results */}
      {filteredPayroll.length > 0 && (
        <div className="chart-card flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="text-[13px] font-semibold" style={{ color: "#a3a3a3" }}>
              {selectedPeriod?.period_name} — {totals.count} employees
              {filterBranch !== "all" && ` • ${filterBranch}`}
            </div>
            <button onClick={downloadAllPayslips} disabled={downloading === "all"}
              className="px-4 py-2 rounded-lg text-[12px] font-semibold"
              style={{ background: "#22c55e", color: "#000", opacity: downloading === "all" ? 0.5 : 1 }}>
              {downloading === "all" ? "⏳ Generating..." : `📄 Download All ${totals.count} Payslips`}
            </button>
          </div>

          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <MiniCard label="Gross Payroll" value={fmtDec(totals.gross)} color="#facc15" />
            <MiniCard label="Net Payout" value={fmtDec(totals.net)} color="#4ade80" />
            <MiniCard label="NAPSA + NHIMA" value={fmtDec(totals.napsa + totals.nhima)} color="#fbbf24" />
            <MiniCard label="Shortages" value={fmtDec(totals.shortages)} color="#f87171" />
            <MiniCard label="Advances" value={fmtDec(totals.advances)} color="#fbbf24" />
          </div>

          {/* Payroll table */}
          <div className="overflow-x-auto">
            <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
              <thead>
                <tr>
                  {["Employee", "Branch", "Gross", "Bonus", "NAPSA", "NHIMA", "PAYE", "Shortages", "Advances", "Fines", "Net Pay", "Payslip"].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold border-b whitespace-nowrap"
                      style={{ textAlign: ["Employee", "Branch"].includes(h) ? "left" : h === "Payslip" ? "center" : "right", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredPayroll.sort((a, b) => a.branch_name.localeCompare(b.branch_name) || a.employee_name.localeCompare(b.employee_name)).map((r, i) => (
                  <tr key={i} className="row-hover">
                    <td className="px-3 py-2.5 text-[12px] font-semibold" style={{ color: "#f5f5f5" }}>{r.employee_name}</td>
                    <td className="px-3 py-2.5 text-[11px]" style={{ color: "#636363" }}>{r.branch_name}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{fmtDec(r.gross_salary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.bonus > 0 ? "#4ade80" : "#636363" }}>{r.bonus > 0 ? "+" + fmt(r.bonus) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#facc15" }}>{fmtDec(r.napsa_employee)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#facc15" }}>{fmtDec(r.nhima_employee)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.paye_tax > 0 ? "#f87171" : "#636363" }}>{r.paye_tax > 0 ? fmtDec(r.paye_tax) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.shortage_amount > 0 ? "#f87171" : "#636363" }}>{r.shortage_amount > 0 ? fmtDec(r.shortage_amount) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.advances > 0 ? "#fbbf24" : "#636363" }}>{r.advances > 0 ? fmtDec(r.advances) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.fines > 0 ? "#f87171" : "#636363" }}>{r.fines > 0 ? fmtDec(r.fines) : "—"}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{fmtDec(r.net_salary_due)}</td>
                    <td className="px-3 py-2.5 text-center">
                      <button onClick={() => downloadPayslip(r)} disabled={downloading === r.employee_id}
                        className="px-2 py-1 rounded text-[10px] font-semibold"
                        style={{ background: "#22c55e20", color: "#4ade80", border: "1px solid #22c55e30" }}>
                        {downloading === r.employee_id ? "..." : "📄 PDF"}
                      </button>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #22c55e" }}>
                  <td className="px-3 py-3 font-bold text-[12px]" style={{ color: "#22c55e" }}>TOTAL</td>
                  <td></td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[12px]" style={{ color: "#22c55e" }}>{fmtDec(totals.gross)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[12px]" style={{ color: "#4ade80" }}>{fmt(totals.bonus)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[12px]" style={{ color: "#facc15" }}>{fmtDec(totals.napsa)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[12px]" style={{ color: "#facc15" }}>{fmtDec(totals.nhima)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[12px]" style={{ color: "#f87171" }}>{fmtDec(totals.paye)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[12px]" style={{ color: "#f87171" }}>{fmtDec(totals.shortages)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[12px]" style={{ color: "#fbbf24" }}>{fmtDec(totals.advances)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[12px]" style={{ color: "#f87171" }}>{fmtDec(totals.fines)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[12px]" style={{ color: "#4ade80" }}>{fmtDec(totals.net)}</td>
                  <td></td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Bottom download button */}
          <div className="flex justify-end">
            <button onClick={downloadAllPayslips} disabled={downloading === "all"}
              className="px-5 py-2.5 rounded-lg text-[12px] font-semibold"
              style={{ background: "#22c55e", color: "#000", opacity: downloading === "all" ? 0.5 : 1 }}>
              {downloading === "all" ? "⏳ Generating..." : `📄 Download All ${totals.count} Payslips`}
            </button>
          </div>
        </div>
      )}

      {/* No records message */}
      {!loading && periodId && filteredPayroll.length === 0 && (
        <div className="chart-card text-center py-12">
          <p style={{ color: "#636363" }}>No payroll records for {selectedPeriod?.period_name}. Click "Generate Payroll" to create them from daily logs.</p>
        </div>
      )}
    </div>
  );
}

function MiniCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="px-4 py-3 rounded-lg" style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}>
      <div className="text-[10px] uppercase tracking-wider font-medium" style={{ color: "#636363" }}>{label}</div>
      <div className="text-[16px] font-bold mt-1" style={{ color }}>{value}</div>
    </div>
  );
}
