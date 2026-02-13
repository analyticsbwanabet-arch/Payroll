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
    const { data: records } = await supabase
      .from("payroll_records")
      .select("*, employee_id, branch_id")
      .eq("payroll_period_id", periodId);

    if (!records || records.length === 0) return;

    const empIds = Array.from(new Set(records.map((r: any) => r.employee_id)));
    const branchIds = Array.from(new Set(records.map((r: any) => r.branch_id)));

    let employees: any[] = [];
    for (let i = 0; i < empIds.length; i += 40) {
      const { data } = await supabase.from("employees").select("id, full_name, position, basic_salary").in("id", empIds.slice(i, i + 40));
      employees = employees.concat(data || []);
    }
    const { data: branches } = await supabase.from("branches").select("id, name").in("id", branchIds);

    const empMap: Record<string, any> = {};
    employees.forEach((e) => (empMap[e.id] = e));
    const branchMap: Record<string, any> = {};
    (branches || []).forEach((b: any) => (branchMap[b.id] = b));

    const fullRecords: FullPayrollRecord[] = records.map((r: any) => ({
      employee_id: r.employee_id,
      employee_name: empMap[r.employee_id]?.full_name || "Unknown",
      position: empMap[r.employee_id]?.position || "unknown",
      branch_name: branchMap[r.branch_id]?.name || "Unknown",
      basic_salary: +empMap[r.employee_id]?.basic_salary || +r.gross_salary,
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
        <h1 className="text-xl font-bold">Generate Payroll</h1>
        <p className="text-[13px] text-[--text-muted] mt-1">Review daily logs, generate payroll, and download payslips</p>
      </div>

      {/* Step 1 */}
      <div className="chart-card">
        <div className="text-[13px] font-semibold mb-3 text-[--text-dim]">Step 1: Select Payroll Period</div>
        <div className="flex gap-3 items-end flex-wrap">
          <select value={periodId} onChange={(e) => { setPeriodId(e.target.value); setStep("select"); setPayrollRecords([]); setSummaries([]); }}
            className="px-4 py-2.5 rounded-lg border border-[--border] bg-[--card] text-[--text] text-[13px] min-w-[220px] outline-none focus:border-[--accent]">
            <option value="">Select period...</option>
            {periods.map((p) => (
              <option key={p.id} value={p.id}>{p.period_name} {p.is_finalized ? "✅ (Finalized)" : ""}</option>
            ))}
          </select>
          {periodId && step === "select" && (
            <button onClick={loadPreview} disabled={loading}
              className="px-6 py-2.5 rounded-lg font-semibold text-[13px]" style={{ background: "var(--blue)", color: "#fff" }}>
              {loading ? "Loading..." : "📋 Preview Daily Logs"}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg text-[13px] font-medium" style={{ background: "#ef444420", color: "var(--red)", border: "1px solid #ef444440" }}>
          ⚠️ {error}
        </div>
      )}

      {/* Step 2: Preview */}
      {step === "preview" && (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatBox icon="👥" label="Employees Logged" value={previewTotals.logged} color="var(--blue)" />
            <StatBox icon="😴" label="No Logs Yet" value={noLogsCount} color="var(--text-muted)" sub="Will get clean payroll" />
            <StatBox icon="❌" label="Total Absences" value={previewTotals.absent} color="var(--red)" />
            <StatBox icon="⚠️" label="Total Shortages" value={fmt(previewTotals.shortages)} color="var(--red)" />
            <StatBox icon="💳" label="Total Advances" value={fmt(previewTotals.advances)} color="var(--accent)" />
            <StatBox icon="💪" label="Extra Shifts" value={previewTotals.extraShifts} color="var(--cyan)" />
          </div>

          <div className="chart-card overflow-x-auto">
            <div className="flex justify-between items-center mb-4 flex-wrap gap-3">
              <div className="text-[13px] font-semibold text-[--text-dim]">Step 2: Review — {selectedPeriod?.period_name} Daily Log Summary</div>
              <button onClick={generatePayroll} className="px-6 py-2.5 rounded-lg font-bold text-[14px]" style={{ background: "var(--accent)", color: "#000" }}>
                ⚡ Generate Payroll for {previewTotals.logged + noLogsCount} Employees
              </button>
            </div>

            {summaries.length > 0 ? (
              <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
                <thead>
                  <tr>
                    {["Employee", "Branch", "Days", "Present", "Late", "Absent", "Leave", "Shifts+", "Shortages", "Advances", "Fines"].map((h) => (
                      <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-[--text-muted] border-b border-[--border] whitespace-nowrap"
                        style={{ textAlign: h === "Employee" || h === "Branch" ? "left" : "right" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {summaries.map((s, i) => (
                    <tr key={i} className="row-hover transition-colors">
                      <td className="px-3 py-2.5 font-semibold text-[13px] text-[--text] whitespace-nowrap">{s.full_name}</td>
                      <td className="px-3 py-2.5 text-[12px] text-[--text-dim]">{s.branch_name.replace(" Shop", "").replace(" UB Market", "")}</td>
                      <td className="px-3 py-2.5 text-right text-[12px] text-[--text]">{s.total_days_logged}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: "var(--green)" }}>{s.days_present}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: s.days_late > 0 ? "var(--accent)" : "var(--text-muted)" }}>{s.days_late || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: s.days_absent > 0 ? "var(--red)" : "var(--text-muted)" }}>{s.days_absent || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: s.days_leave > 0 ? "var(--purple)" : "var(--text-muted)" }}>{s.days_leave || "—"}</td>
                      <td className="px-3 py-2.5 text-right text-[12px]" style={{ color: s.total_extra_shifts > 0 ? "var(--cyan)" : "var(--text-muted)" }}>{s.total_extra_shifts || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: s.total_shortages > 0 ? "var(--red)" : "var(--text-muted)" }}>{s.total_shortages > 0 ? fmt(s.total_shortages) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: s.total_advances > 0 ? "var(--accent)" : "var(--text-muted)" }}>{s.total_advances > 0 ? fmt(s.total_advances) : "—"}</td>
                      <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: s.total_fines > 0 ? "var(--red)" : "var(--text-muted)" }}>{s.total_fines > 0 ? fmt(s.total_fines) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="text-center py-10 text-[--text-muted]">No daily logs found. All employees will receive clean payroll.</div>
            )}
          </div>
        </>
      )}

      {/* Generating */}
      {step === "generating" && (
        <div className="chart-card text-center py-16">
          <div className="text-4xl mb-4 animate-pulse">⚡</div>
          <div className="text-[--text] text-[15px] font-semibold mb-2">Generating Payroll...</div>
          <div className="text-[--text-muted] text-[13px]">Calculating NAPSA, NHIMA, PAYE and net pay</div>
        </div>
      )}

      {/* Results */}
      {step === "results" && payrollRecords.length > 0 && (
        <>
          <div className="px-5 py-4 rounded-lg" style={{ background: "#10b98120", border: "1px solid #10b98140" }}>
            <div className="flex justify-between items-center flex-wrap gap-3">
              <div>
                <div className="text-[--green] font-bold text-[15px]">✅ Payroll Generated Successfully!</div>
                <div className="text-[--text-dim] text-[13px] mt-1">
                  {selectedPeriod?.period_name} — {resultTotals.count} employees — Net payout: <span className="font-bold text-[--green]">{fmtDec(resultTotals.net)}</span>
                </div>
              </div>
              <button onClick={downloadAllPayslips} disabled={downloading === "all"}
                className="px-6 py-3 rounded-lg font-bold text-[14px] flex items-center gap-2"
                style={{ background: downloading === "all" ? "var(--border)" : "var(--accent)", color: downloading === "all" ? "var(--text-muted)" : "#000" }}>
                {downloading === "all" ? "⏳ Generating..." : "📄 Download All Payslips (PDF)"}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBox icon="👥" label="Employees" value={resultTotals.count} color="var(--blue)" />
            <StatBox icon="💰" label="Gross Payroll" value={fmt(resultTotals.gross)} color="var(--accent)" />
            <StatBox icon="✅" label="Net Payout" value={fmt(resultTotals.net)} color="var(--green)" />
            <StatBox icon="⚠️" label="Deductions" value={fmt(resultTotals.shortages + resultTotals.advances + resultTotals.fines)} color="var(--red)" />
          </div>

          <div className="chart-card overflow-x-auto">
            <div className="text-[13px] font-semibold mb-4 text-[--text-dim]">Payroll Results — {selectedPeriod?.period_name}</div>
            <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
              <thead>
                <tr>
                  {["Employee", "Branch", "Gross", "NAPSA", "NHIMA", "Shortages", "Advances", "Net Pay", "Payslip"].map((h) => (
                    <th key={h} className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-[--text-muted] border-b border-[--border] whitespace-nowrap"
                      style={{ textAlign: h === "Employee" || h === "Branch" || h === "Payslip" ? "left" : "right" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {payrollRecords.map((r, i) => (
                  <tr key={i} className="row-hover transition-colors">
                    <td className="px-3 py-2.5 font-semibold text-[13px] text-[--text] whitespace-nowrap">{r.employee_name}</td>
                    <td className="px-3 py-2.5 text-[12px] text-[--text-dim]">{r.branch_name.replace(" Shop", "").replace(" UB Market", "")}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[--text]">{fmt(r.gross_salary)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[--text-dim]">{fmt(r.napsa_employee)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] text-[--text-dim]">{fmt(r.nhima_employee)}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.shortage_amount > 0 ? "var(--red)" : "var(--text-muted)" }}>
                      {r.shortage_amount > 0 ? fmt(r.shortage_amount) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px]" style={{ color: r.advances > 0 ? "var(--accent)" : "var(--text-muted)" }}>
                      {r.advances > 0 ? fmt(r.advances) : "—"}
                    </td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-bold" style={{ color: "var(--green)" }}>{fmtDec(r.net_salary_due)}</td>
                    <td className="px-3 py-2.5">
                      <button onClick={() => downloadPayslip(r)} disabled={downloading === r.employee_id}
                        className="px-3 py-1.5 rounded-md text-[11px] font-medium transition-all"
                        style={{
                          background: downloading === r.employee_id ? "var(--border)" : "#3b82f620",
                          color: downloading === r.employee_id ? "var(--text-muted)" : "var(--blue)",
                          border: "1px solid " + (downloading === r.employee_id ? "var(--border)" : "#3b82f640"),
                        }}>
                        {downloading === r.employee_id ? "⏳" : "📄 PDF"}
                      </button>
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid var(--accent)" }}>
                  <td className="px-3 py-3 font-bold text-[--accent]" colSpan={2}>TOTAL ({resultTotals.count})</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[--accent]">{fmt(resultTotals.gross)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[--accent]">{fmt(payrollRecords.reduce((a, b) => a + b.napsa_employee, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[--accent]">{fmt(payrollRecords.reduce((a, b) => a + b.nhima_employee, 0))}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[--accent]">{fmt(resultTotals.shortages)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[--accent]">{fmt(resultTotals.advances)}</td>
                  <td className="px-3 py-3 text-right font-mono font-bold text-[--accent]">{fmtDec(resultTotals.net)}</td>
                  <td className="px-3 py-3"></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="flex gap-3 flex-wrap">
            <button onClick={() => { setStep("select"); setPayrollRecords([]); setSummaries([]); }}
              className="px-5 py-2.5 rounded-lg border border-[--border] text-[--text-dim] text-[13px] hover:text-[--text] transition-colors">
              ← Back
            </button>
            <button onClick={downloadAllPayslips} disabled={downloading === "all"}
              className="px-5 py-2.5 rounded-lg text-[13px] font-medium"
              style={{ background: "var(--accent)", color: "#000" }}>
              {downloading === "all" ? "⏳ Generating..." : "📄 Download All " + resultTotals.count + " Payslips"}
            </button>
            <a href="/employees" className="px-5 py-2.5 rounded-lg text-[13px] font-medium" style={{ background: "var(--blue)", color: "#fff" }}>
              👥 View Employee Details
            </a>
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
      <div className="text-[11px] text-[--text-muted] uppercase tracking-wider font-medium mb-1">{icon} {label}</div>
      <div className="text-xl font-bold font-mono" style={{ color }}>{value}</div>
      {sub && <div className="text-[10px] text-[--text-muted] mt-0.5">{sub}</div>}
    </div>
  );
}
