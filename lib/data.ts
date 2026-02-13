import { supabase } from "./supabase";
import type { PayrollRecord } from "./helpers";

export async function getPayrollData(
  periodName: string = "January 2026"
): Promise<PayrollRecord[]> {
  // 1. Get the period ID
  const { data: periods } = await supabase
    .from("payroll_periods")
    .select("id")
    .eq("period_name", periodName)
    .limit(1);

  if (!periods || periods.length === 0) return [];
  const periodId = periods[0].id;

  // 2. Get all payroll records for this period
  const { data: records } = await supabase
    .from("payroll_records")
    .select(
      `
      gross_salary, net_salary_due, napsa_employee, nhima_employee, paye_tax,
      extra_shifts_count, extra_shift_total, bonus, shortage_amount,
      advances, fines, absent_days, absence_deduction, comments,
      employee_id, branch_id
    `
    )
    .eq("payroll_period_id", periodId);

  if (!records || records.length === 0) return [];

  // 3. Get employees and branches
  const empIds = Array.from(new Set(records.map((r: any) => r.employee_id)));
  const branchIds = Array.from(new Set(records.map((r: any) => r.branch_id)));

  const [{ data: employees }, { data: branches }] = await Promise.all([
    supabase.from("employees").select("id, full_name, position").in("id", empIds),
    supabase.from("branches").select("id, name").in("id", branchIds),
  ]);

  const empMap: Record<string, any> = {};
  (employees || []).forEach((e: any) => (empMap[e.id] = e));
  const branchMap: Record<string, any> = {};
  (branches || []).forEach((b: any) => (branchMap[b.id] = b));

  // 4. Enrich and return
  return records
    .map((r: any) => ({
      full_name: empMap[r.employee_id]?.full_name || "Unknown",
      position: empMap[r.employee_id]?.position || "unknown",
      branch_name: branchMap[r.branch_id]?.name || "Unknown",
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
      comments: r.comments,
    }))
    .sort((a: PayrollRecord, b: PayrollRecord) =>
      a.branch_name.localeCompare(b.branch_name) || a.full_name.localeCompare(b.full_name)
    );
}
