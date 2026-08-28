import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { employee_id, effective_date, end_date, basic_pay, housing_allowance, other_allowances, gross_salary, position, branch_name, sent_by } = await req.json();

    const { data: emp } = await supabase.from("employees").select("full_name, email").eq("id", employee_id).single();
    if (!emp || !emp.email) return NextResponse.json({ error: "Employee has no email" }, { status: 400 });

    const { data: contract, error: dbErr } = await supabase.from("contracts").insert({
      employee_id, effective_date, end_date, basic_pay, housing_allowance, other_allowances, gross_salary, position, branch_name,
      status: "sent", sent_at: new Date().toISOString(), sent_by,
    }).select("token").single();

    if (dbErr || !contract) return NextResponse.json({ error: dbErr?.message || "Failed to create contract" }, { status: 500 });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "https://payroll-seven-gamma.vercel.app";
    const contractUrl = `${baseUrl}/contract/${contract.token}`;

    await sendEmail({
      to: emp.email,
      subject: "BwanaBet - Employment Contract for Your Review and Signature",
      html: `
        <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
          <div style="text-align:center;margin-bottom:24px">
            <h2 style="margin:0;font-size:20px;color:#1a1a1a">BwanaBet</h2>
            <p style="margin:4px 0 0;color:#888;font-size:12px">Silverspring Entertainment Ltd</p>
          </div>
          <p style="font-size:14px;color:#333">Dear ${emp.full_name},</p>
          <p style="font-size:14px;color:#333">Your employment contract is ready for your review and signature. Please click the button below to read the contract and sign it electronically.</p>
          <div style="text-align:center;margin:28px 0">
            <a href="${contractUrl}" style="background:#1a1a1a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;font-size:14px;font-weight:bold;display:inline-block">Review & Sign Contract</a>
          </div>
          <p style="font-size:12px;color:#888;text-align:center">If the button doesn't work, copy and paste this link:<br/><a href="${contractUrl}" style="color:#666;word-break:break-all">${contractUrl}</a></p>
          <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
          <p style="font-size:10px;color:#aaa;text-align:center">This is a confidential document intended for the named recipient only.<br/>Silverspring Entertainment Ltd | BwanaBet</p>
        </div>`,
    });

    return NextResponse.json({ success: true, token: contract.token, email: emp.email });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
