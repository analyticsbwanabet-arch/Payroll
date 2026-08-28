import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.json({ error: "Missing token" }, { status: 400 });

  const { data: contract, error } = await supabase.from("contracts").select("*").eq("token", token).single();
  if (error || !contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });

  const { data: emp } = await supabase.from("employees").select("full_name, nrc_number, social_security_number, home_address, position").eq("id", contract.employee_id).single();

  // Mark as viewed
  if (contract.status === 'sent' || contract.status === 'pending') {
    await supabase.from("contracts").update({ status: "viewed", viewed_at: new Date().toISOString() }).eq("id", contract.id);
  }

  return NextResponse.json({
    id: contract.id,
    employee_name: emp?.full_name || "",
    nrc_number: emp?.nrc_number || "",
    ssn: emp?.social_security_number || "",
    home_address: emp?.home_address || "",
    position: contract.position || emp?.position || "",
    branch_name: contract.branch_name || "",
    effective_date: contract.effective_date,
    end_date: contract.end_date,
    basic_pay: contract.basic_pay,
    housing_allowance: contract.housing_allowance,
    other_allowances: contract.other_allowances,
    gross_salary: contract.gross_salary,
    status: contract.status,
    signed_at: contract.signed_at,
    signature_data: contract.signature_data,
    signed_name: contract.signed_name,
  });
}
