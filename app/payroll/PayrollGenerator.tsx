"use client";

import { useState, useCallback } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface Period {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  is_finalized: boolean;
}

interface DailySummary {
  employee_id: string;
  branch_id: string;
  full_name: string;
  branch_name: string;
  position: string;
  days_present: number;
  days_late: number;
  days_absent: number;
  days_leave: number;
  total_extra_shifts: number;
  total_shortages: number;
  total_advances: number;
  total_fines: number;
  total_days_logged: number;
}

interface FullPayrollRecord {
  employee_id: string;
  employee_name: string;
  position: string;
  branch_name: string;
  basic_salary: number;
  gross_salary: number;
  net_salary_due: number;
  napsa_employee: number;
  nhima_employee: number;
  paye_tax: number;
  extra_shifts_count: number;
  extra_shift_total: number;
  bonus: number;
  shortage_amount: number;
  advances: number;
  fines: number;
  absent_days: number;
  absence_deduction: number;
  other_deductions: number;
  comments: string | null;
}

const fmt = (n: number | string) =>
  `K${Number(n || 0).toLocaleString("en", { maximumFractionDigits: 0 })}`;

const fmtDec = (n: number | string) =>
  `K${Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function PayrollGenerator({ periods }: { periods: Period[] }) {
  const [periodId, setPeriodId] = useState("");
  const [step, setStep] = useState<"select" | "preview" | "generating" | "results">("select");
  const [summaries, setSummaries] = useState<DailySummary[]>([]);
  const [payrollRecords, setPayrollRecords] = useState<FullPayrollRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noLogsCount, setNoLogsCount] = useState(0);
  const [downloading, setDownloading] = useState<string | null>(null);

  const selectedPeriod = periods.find((p) => p.id === periodId);
  const monthStart = selectedPeriod?.start_date || "";

  const loadPreview = useCallback(async () => {
    if (!periodId || !monthStart) return;
    setLoading(true);
    setError(null);

    const { data: logs, error: logErr } = await supabase
      .from("daily_logs")
      .select("employee_id, branch_id, attendance_status, shortage_amount, advance_amount, fine_amount, extra_shifts_worked")
      .gte("log_date", monthStart)
      .lte("log_date", selectedPeriod?.end_date || "");

    if (logErr) { setError(logErr.message); setLoading(false); return; }

    const empIds = Array.from(new Set((logs || []).map((l: any) => l.employee_id)));
    const branchIds = Array.from(new Set((logs || []).map((l: any) => l.branch_id)));

    let employees: any[] = [];
    for (let i = 0; i < empIds.length; i += 40) {
      const batch = empIds.slice(i, i + 40);
      const { data } = await supabase.from("employees").select("id, full_name, position, branch_id").in("id", batch);
      employees = employees.concat(data || []);
    }
    const { data: branches } = await supabase.from("branches").select("id, name").in("id", branchIds);

    const empMap: Record<string, any> = {};
    employees.forEach((e) => (empMap[e.id] = e));
    const branchMap: Record<string, any> = {};
    (branches || []).forEach((b: any) => (branchMap[b.id] = b));

    const agg: Record<string, DailySummary> = {};
    (logs || []).forEach((l: any) => {
      if (!agg[l.employee_id]) {
        agg[l.employee_id] = {
          employee_id: l.employee_id, branch_id: l.branch_id,
          full_name: empMap[l.employee_id]?.full_name || "Unknown",
          branch_name: branchMap[l.branch_id]?.name || "Unknown",
          position: empMap[l.employee_id]?.position || "",
          days_present: 0, days_late: 0, days_absent: 0, days_leave: 0,
          total_extra_shifts: 0, total_shortages: 0, total_advances: 0, total_fines: 0,
          total_days_logged: 0,
        };
      }
      const s = agg[l.employee_id];
      s.total_days_logged++;
      if (l.attendance_status === "present") s.days_present++;
      if (l.attendance_status === "late") s.days_late++;
      if (l.attendance_status === "absent") s.days_absent++;
      if (l.attendance_status === "leave") s.days_leave++;
      s.total_extra_shifts += +l.extra_shifts_worked;
      s.total_shortages += +l.shortage_amount;
      s.total_advances += +l.advance_amount;
      s.total_fines += +l.fine_amount;
    });

    const { count } = await supabase.from("employees").select("id", { count: "exact", head: true }).eq("employment_status", "active");
    setNoLogsCount((count || 0) - Object.keys(agg).length);
    setSummaries(Object.values(agg).sort((a, b) => a.branch_name.localeCompare(b.branch_name) || a.full_name.localeCompare(b.full_name)));
    setStep("preview");
    setLoading(false);
  }, [periodId, monthStart, selectedPeriod?.end_date]);

  const generatePayroll = async () => {
    setStep("generating");
    setError(null);

    const { error: rpcErr } = await supabase.rpc("generate_payroll_from_daily_logs", {
      p_period_id: periodId,
      p_month: monthStart,
    });

    if (rpcErr) { setError(rpcErr.message); setStep("preview"); return; }
    await fetchPayrollRecords();
    setStep("results");
  };

  const fetchPayrollRecords = async () => {
    const { data: records, error: recErr } = await supabase
      .from("payroll_records")
      .select("*")
      .eq("payroll_period_id", periodId);

    if (recErr || !records || records.length === 0) {
      if (recErr) setError(recErr.message);
      return;
    }

    const empIds = Array.from(new Set(records.map((r: any) => r.employee_id)));
    const branchIds = Array.from(new Set(records.map((r: any) => r.branch_id)));

    // Fetch employees - use basic_pay (correct column name)
    let employees: any[] = [];
    for (let i = 0; i < empIds.length; i += 40) {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name, position, basic_pay")
        .in("id", empIds.slice(i, i + 40));
      if (data) employees = employees.concat(data);
    }

    let branches: any[] = [];
    for (let i = 0; i < branchIds.length; i += 40) {
      const { data } = await supabase
        .from("branches")
        .select("id, name")
        .in("id", branchIds.slice(i, i + 40));
      if (data) branches = branches.concat(data);
    }

    const empMap: Record<string, any> = {};
    employees.forEach((e) => (empMap[e.id] = e));
    const branchMap: Record<string, any> = {};
    branches.forEach((b: any) => (branchMap[b.id] = b));

    const fullRecords: FullPayrollRecord[] = records.map((r: any) => ({
      employee_id: r.employee_id,
      employee_name: empMap[r.employee_id]?.full_name || "Unknown",
      position: empMap[r.employee_id]?.position || "unknown",
      branch_name: branchMap[r.branch_id]?.name || "Unknown",
      basic_salary: +(empMap[r.employee_id]?.basic_pay || r.basic_pay || r.gross_salary || 0),
      gross_salary: +r.gross_salary,
      net_salary_due: +r.net_salary_due,
      napsa_employee: +r.napsa_employee,
      nhima_employee: +r.nhima_employee,
      paye_tax: +r.paye_tax,
      extra_shifts_count: +r.extra_shifts_count,
      extra_shift_total: +r.extra_shift_total,
      bonus: +r.bonus,
      shortage_amount: +r.shortage_amount,
      advances: +r.advances,
      fines: +r.fines,
      absent_days: +r.absent_days,
      absence_deduction: +r.absence_deduction,
      other_deductions: +r.other_deductions,
      comments: r.comments,
    })).sort((a: FullPayrollRecord, b: FullPayrollRecord) =>
      a.branch_name.localeCompare(b.branch_name) || a.employee_name.localeCompare(b.employee_name)
    );

    setPayrollRecords(fullRecords);
  };

  const downloadPayslip = async (record: FullPayrollRecord) => {
    setDownloading(record.employee_id);
    const { downloadPayslip: dl } = await import("@/lib/payslip");
    dl({
      ...record,
      period_name: selectedPeriod?.period_name || "",
      period_start: selectedPeriod?.start_date || "",
      period_end: selectedPeriod?.end_date || "",
    });
    setTimeout(() => setDownloading(null), 1000);
  };

  const downloadAllPayslips = async () => {
    setDownloading("all");
    const { downloadAllPayslips: dlAll } = await import("@/lib/payslip");
    dlAll(
      payrollRecords.map((r) => ({
        ...r,
        period_name: selectedPeriod?.period_name || "",
        period_start: selectedPeriod?.start_date || "",
        period_end: selectedPeriod?.end_date || "",
      }))
    );
    setTimeout(() => setDownloading(null), 1500);
  };

  const previewTotals = summaries.reduce(
    (a, b) => ({
      logged: a.logged + 1, absent: a.absent + b.days_absent,
      shortages: a.shortages + b.total_shortages, advances: a.advances + b.total_advances,
      fines: a.fines + b.total_fines, extraShifts: a.extraShifts + b.total_extra_shifts,
    }),
    { logged: 0, absent: 0, shortages: 0, advances: 0, fines: 0, extraShifts: 0 }
  );

  const resultTotals = payrollRecords.reduce(
    (a, b) => ({
      count: a.count + 1, net: a.net + b.net_salary_due, gross: a.gross + b.gross_salary,
      shortages: a.shortages + b.shortage_amount, advances: a.advances + b.advances, fines: a.fines + b.fines,
    }),
    { count: 0, net: 0, gross: 0, shortages: 0, advances: 0, fines: 0 }
  );

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Generate Payroll</h1>
        <p className="text-[13px] mt-1" style={{ color: "#636363" }}>Review daily logs, generate payroll, and download payslips</p>
      </div>

      {/* Step 1 */}
      <div className="chart-card">
        <div className="text-[13px] font-semibold mb-3" style={{ color: "#a3a3a3" }}>Step 1: Select Payroll Period</div>
        <div className="flex gap-3 items-end flex-wrap">
          <select value={periodId} onChange={(e) => { setPeriodId(e.target.value); setStep("select"); setPayrollRecords([]); setSummaries([]); }}
            className="px-4 py-2.5 rounded-lg text-[13px] min-w-[220px] outline-none"
            style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
            <option value="">Select period...</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.period_name} {p.is_finalized ? "✅ (Finalized)" : ""}</option>
            ))}
          </select>
          {periodId && step === "select" && (
            <button onClick={loadPreview} disabled={loading}
              className="px-6 py-2.5 rounded-lg font-semibold text-[13px]" style={{ background: "#22c55e", color: "#000" }}>
              {loading ? "Loading..." : "📋 Preview Daily Logs"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-[13px] font-medium" style={{ background: "#f8717120", color: "#f87171", border: "1px solid #f8717140" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBox icon="👥" label="Employees Logged" value={previewTotals.logged} color="#22c55e" />
            <StatBox icon="😴" label="No Logs Yet" value={noLogsCount} color="#636363" sub="Will get clean payroll" />
            <StatBox icon="❌" label="Total Absences" value={previewTotals.absent} color="#f87171" />
            <StatBox icon="⚠️" label="Total Shortages" value={fmt(previewTotals.shortages)} color="#f87171" />
            <StatBox icon="💳" label="Total Advances" value={fmt(previewTotals.advances)} color="#facc15" />
            <StatBox icon="💪" label="Extra Shifts" value={previewTotals.extraShifts} color="#22d3ee" />
          </div>

          <div className="chart-card overflow-x-auto">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <div className="text-[13px] font-semibold" style={{ color: "#a3a3a3" }}>Step 2: Review — {selectedPeriod?.period_name}</div>
              <button onClick={generatePayroll} className="px-6 py-2.5 rounded-lg font-bold text-[14px]" style={{ background: "#facc15", color: "#000" }}>
                ⚡ Generate Payroll for {previewTotals.logged + noLogsCount} Employees
              </button>
            </div>

            {summaries.length > 0 ? (
              <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
                <thead>
                  <tr>
                    {["Employee", "Branch", "Days", "Present", "Late", "Absent", "Leave", "Shifts+", "Shortages", "Advances", "Fines"].map((h) => (
                      <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold border-b whitespace-nowrap"
                        style={{ textAlign: h === "Employee" || h === "Branch" ? "left" : "right", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s, i) => (
                    <tr key={i} className="row-hover transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-[13px] whitespace-nowrap" style={{ color: "#f5f5f5" }}>{s.full_name}</td>
                      <td className="px-3 py-2.5 text-[12px]" style={{ color: "#a3a3a3" }}>{s.branch_name.replace(" Shop", "").replace(" UB Market", "")}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: "#f5f5f5" }}>{s.total_days_logged}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: "#4ade80" }}>{s.days_present}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: s.days_late > 0 ? "#facc15" : "#636363" }}>{s.days_late || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: s.days_absent > 0 ? "#f87171" : "#636363" }}>{s.days_absent || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: s.days_leave > 0 ? "#a78bfa" : "#636363" }}>{s.days_leave || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: s.total_extra_shifts > 0 ? "#22d3ee" : "#636363" }}>{s.total_extra_shifts || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: s.total_shortages > 0 ? "#f87171" : "#636363" }}>{s.total_shortages > 0 ? fmt(s.total_shortages) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: s.total_advances > 0 ? "#facc15" : "#636363" }}>{s.total_advances > 0 ? fmt(s.total_advances) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: s.total_fines > 0 ? "#f87171" : "#636363" }}>{s.total_fines > 0 ? fmt(s.total_fines) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-10" style={{ color: "#636363" }}>No daily logs found. All employees will receive clean payroll.</div>
            )}
          </div>
        </>
      )}

      {step === "generating" && (
        <div className="chart-card text-center py-16">
          <div className="text-4xl mb-4 animate-pulse">⚡</div>
          <div className="text-[15px] font-semibold mb-2" style={{ color: "#f5f5f5" }}>Generating Payroll...</div>
          <div className="text-[13px]" style={{ color: "#636363" }}>Calculating NAPSA, NHIMA, PAYE and net pay</div>
        </div>
      )}

      {/* Results */}
      {step === "results" && payrollRecords.length > 0 && (
        <>
          <div className="px-5 py-4 rounded-lg" style={{ background: "#22c55e15", border: "1px solid #22c55e40" }}>
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <div className="font-bold text-[15px]" style={{ color: "#4ade80" }}>✅ Payroll Generated Successfully!</div>
                <div className="text-[13px] mt-1" style={{ color: "#a3a3a3" }}>
                  {selectedPeriod?.period_name} — {resultTotals.count} employees — Net payout: <span className="font-bold" style={{ color: "#4ade80" }}>{fmtDec(resultTotals.net)}</span>
                </div>
              </div>
              <button onClick={downloadAllPayslips} disabled={downloading === "all"}
                className="px-6 py-3 rounded-lg font-bold text-[14px] flex items-center gap-2"
                style={{ background: downloading === "all" ? "#2a2a2a" : "#facc15", color: downloading === "all" ? "#636363" : "#000" }}>
                {downloading === "all" ? "⏳ Generating..." : "📄 Download All Payslips (PDF)"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox icon="👥" label="Employees" value={resultTotals.count} color="#22c55e" />
            <StatBox icon="💰" label="Gross Payroll" value={fmt(resultTotals.gross)} color="#facc15" />
            <StatBox icon="✅" label="Net Payout" value={fmt(resultTotals.net)} color="#4ade80" />
            <StatBox icon="⚠️" label="Deductions" value={fmt(resultTotals.shortages + resultTotals.advances + resultTotals.fines)} color="#f87171" />
          </div>

          <div className="chart-card overflow-x-auto">
            <div className="text-[13px] font-semibold mb-4" style={{ color: "#a3a3a3" }}>Payroll Results — {selectedPeriod?.period_name}</div>
            <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
              <thead>
                <tr>
                  {["Employee", "Branch", "Gross", "NAPSA", "NHIMA", "Shortages", "Advances", "Net Pay", "Payslip"].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold border-b whitespace-nowrap"
                      style={{ textAlign: h === "Employee" || h === "Branch" || h === "Payslip" ? "left" : "right", color: "#636363", borderColor: "#2a2a2a" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollRecords.map((r, i) => (
                  <tr key={i} className="row-hover transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-[13px] whitespace-nowrap" style={{ color: "#f5f5f5" }}>{r.employee_name}</td>
                    <td className="px-3 py-2.5 text-[12px]" style={{ color: "#a3a3a3" }}>{r.branch_name.replace(" Shop", "").replace(" UB Market", "")}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#f5f5f5" }}>{fmt(r.gross_salary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#a3a3a3" }}>{fmt(r.napsa_employee)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: "#a3a3a3" }}>{fmt(r.nhima_employee)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.shortage_amount > 0 ? "#f87171" : "#636363" }}>
                      {r.shortage_amount > 0 ? fmt(r.shortage_amount) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.advances > 0 ? "#facc15" : "#636363" }}>
                      {r.advances > 0 ? fmt(r.advances) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold" style={{ color: "#4ade80" }}>{fmtDec(r.net_salary_due)}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => downloadPayslip(r)} disabled={downloading === r.employee_id}
                        className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
                        style={{
                          background: downloading === r.employee_id ? "#2a2a2a" : "#22c55e20",
                          color: downloading === r.employee_id ? "#636363" : "#4ade80",
                          border: "1px solid " + (downloading === r.employee_id ? "#2a2a2a" : "#22c55e40"),
                        }}>
                        {downloading === r.employee_id ? "⏳" : "📄 PDF"}
                      </button>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid #facc15" }}>
                  <td className="px-3 py-3 font-bold" style={{ color: "#facc15" }} colSpan={2}>TOTAL ({resultTotals.count})</td>
                  <td className="px-3 py-3 text-right font-mono font-bold" style={{ color: "#facc15" }}>{fmt(resultTotals.gross)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold" style={{ color: "#facc15" }}>{fmt(payrollRecords.reduce((a, b) => a + b.napsa_employee, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold" style={{ color: "#facc15" }}>{fmt(payrollRecords.reduce((a, b) => a + b.nhima_employee, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold" style={{ color: "#facc15" }}>{fmt(resultTotals.shortages)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold" style={{ color: "#facc15" }}>{fmt(resultTotals.advances)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold" style={{ color: "#facc15" }}>{fmtDec(resultTotals.net)}</td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={() => { setStep("select"); setPayrollRecords([]); setSummaries([]); }}
              className="px-5 py-2.5 rounded-lg text-[13px]" style={{ border: "1px solid #2a2a2a", color: "#a3a3a3" }}>
              ← Back
            </button>
            <button onClick={downloadAllPayslips} disabled={downloading === "all"}
              className="px-5 py-2.5 rounded-lg text-[13px] font-medium"
              style={{ background: "#facc15", color: "#000" }}>
              {downloading === "all" ? "⏳ Generating..." : "📄 Download All " + resultTotals.count + " Payslips"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function StatBox({ icon, label, value, color, sub }: { icon: string; label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div className="stat-card">
      <div className="glow" style={{ background: color }} />
      <div className="text-[11px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>{icon} {label}</div>
      <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] mt-0.5" style={{ color: "#636363" }}>{sub}</div>}
    </div>
  );
}
