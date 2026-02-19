import { supabase } from "./supabase";
import type { PayrollRecord, EmployeeContact } from "./helpers";

export async function getEmployeeContacts(
  branchIds?: string[] | null
): Promise<EmployeeContact[]> {
  let query = supabase
    .from("employees")
    .select(
      `id, full_name, phone, email, mobile_money_number, home_address,
       nrc_number, tpin, bank_name, bank_account_number, social_security_number,
       emergency_contact_name, emergency_contact_phone, date_started, branch_id`
    )
    .eq("employment_status", "active");

  if (branchIds && branchIds.length > 0) {
    query = query.in("branch_id", branchIds);
  }

  const { data } = await query;
  if (!data) return [];

  return data.map((e: any) => ({
    employee_id: e.id,
    full_name: e.full_name,
    phone: e.phone,
    email: e.email,
    mobile_money_number: e.mobile_money_number,
    home_address: e.home_address,
    nrc_number: e.nrc_number,
    tpin: e.tpin,
    bank_name: e.bank_name,
    bank_account_number: e.bank_account_number,
    social_security_number: e.social_security_number,
    emergency_contact_name: e.emergency_contact_name,
    emergency_contact_phone: e.emergency_contact_phone,
    date_started: e.date_started,
  }));
}

export async function getPayrollData(
  periodName: string = "January 2026",
  branchIds?: string[] | null // null = all branches (super admin), array = filter
): Promise<PayrollRecord[]> {
  // 1. Get the period ID
  const { data: periods } = await supabase
    .from("payroll_periods")
    .select("id")
    .eq("period_name", periodName)
    .limit(1);

  if (!periods || periods.length === 0) return [];
  const periodId = periods[0].id;

  // 2. Get payroll records, filtered by branch if needed
  let query = supabase
    .from("payroll_records")
    .select(
      `gross_salary, net_salary_due, napsa_employee, nhima_employee, paye_tax,
       extra_shifts_count, extra_shift_total, bonus, shortage_amount,
       advances, fines, absent_days, absence_deduction, comments,
       employee_id, branch_id`
    )
    .eq("payroll_period_id", periodId);

  // Branch filtering for non-super-admins
  if (branchIds && branchIds.length > 0) {
    query = query.in("branch_id", branchIds);
  }

  const { data: records } = await query;
  if (!records || records.length === 0) return [];

  // 3. Get employees and branches
  const empIds = Array.from(new Set(records.map((r: any) => r.employee_id)));
  const branchIdsFromRecords = Array.from(new Set(records.map((r: any) => r.branch_id)));

  const [{ data: employees }, { data: branches }] = await Promise.all([
    supabase.from("employees").select("id, full_name, position").in("id", empIds),
    supabase.from("branches").select("id, name").in("id", branchIdsFromRecords),
  ]);

  const empMap: Record<string, any> = {};
  (employees || []).forEach((e: any) => (empMap[e.id] = e));
  const branchMap: Record<string, any> = {};
  (branches || []).forEach((b: any) => (branchMap[b.id] = b));

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
