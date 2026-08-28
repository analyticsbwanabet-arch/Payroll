import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  // Find payroll record by token
  const { data: record, error } = await supabase
    .from("payroll_records")
    .select("*")
    .eq("payslip_token", token)
    .single();

  if (error || !record) return NextResponse.json({ error: "Payslip not found" }, { status: 404 });

  // Get employee details
  const { data: emp } = await supabase
    .from("employees")
    .select("full_name, position, nrc_number, tpin, social_security_number, mobile_money_number, phone, date_started")
    .eq("id", record.employee_id)
    .single();

  // Get branch name
  const { data: branch } = await supabase
    .from("branches")
    .select("name")
    .eq("id", record.branch_id)
    .single();

  // Get period
  const { data: period } = await supabase
    .from("payroll_periods")
    .select("period_name, start_date, end_date")
    .eq("id", record.payroll_period_id)
    .single();

  return NextResponse.json({
    employee_name: emp?.full_name || "Unknown",
    position: emp?.position || "unknown",
    branch_name: branch?.name || "Unknown",
    period_name: period?.period_name || "",
    period_start: period?.start_date || "",
    period_end: record.generated_at ? record.generated_at.split("T")[0] : (period?.end_date || ""),
    nrc_number: emp?.nrc_number || "",
    tpin: emp?.tpin || "",
    ssn: emp?.social_security_number || "",
    mobile_number: emp?.mobile_money_number || emp?.phone || "",
    date_started: emp?.date_started || "",
    basic_pay: +(record.basic_pay || 0),
    housing_allowance: +(record.housing_allowance || 0),
    transport_allowance: +(record.transport_allowance || 0),
    lunch_allowance: +(record.lunch_allowance || 0),
    gross_salary: +(record.gross_salary || 0),
    extra_shifts_count: +(record.extra_shifts_count || 0),
    extra_shift_total: +(record.extra_shift_total || 0),
    bonus: +(record.bonus || 0),
    napsa_employee: +(record.napsa_employee || 0),
    napsa_employer: +(record.napsa_employer || 0),
    nhima_employee: +(record.nhima_employee || 0),
    nhima_employer: +(record.nhima_employer || 0),
    paye_tax: +(record.paye_tax || 0),
    shortage_amount: +(record.shortage_amount || 0),
    advances: +(record.advances || 0),
    fines: +(record.fines || 0),
    absent_days: +(record.absent_days || 0),
    absence_deduction: +(record.absence_deduction || 0),
    other_deductions: +(record.other_deductions || 0),
    net_salary_due: +(record.net_salary_due || 0),
  });
}
