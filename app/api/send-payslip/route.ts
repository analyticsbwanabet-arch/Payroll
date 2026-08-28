import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendEmail } from "@/lib/email";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

interface PayslipSendRequest {
  employee_id: string;
  employee_name: string;
  email: string;
  period_name: string;
  payroll_period_id: string;
}

export async function POST(req: NextRequest) {
  try {
    const { payslips } = (await req.json()) as { payslips: PayslipSendRequest[] };

    if (!process.env.GMAIL_APP_PASSWORD) {
      return NextResponse.json({ error: "GMAIL_APP_PASSWORD not configured" }, { status: 500 });
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || req.headers.get("origin") || "https://payroll-seven-gamma.vercel.app";
    const results: { name: string; email: string; status: "sent" | "failed"; error?: string }[] = [];

    for (const payslip of payslips) {
      if (!payslip.email) {
        results.push({ name: payslip.employee_name, email: "", status: "failed", error: "No email" });
        continue;
      }

      try {
        const token = crypto.randomUUID();

        const { error: dbErr } = await supabase
          .from("payroll_records")
          .update({ payslip_token: token })
          .eq("employee_id", payslip.employee_id)
          .eq("payroll_period_id", payslip.payroll_period_id);

        if (dbErr) {
          results.push({ name: payslip.employee_name, email: payslip.email, status: "failed", error: "Token generation failed" });
          continue;
        }

        const payslipUrl = `${baseUrl}/payslip/${token}`;

        const { success, error } = await sendEmail({
          to: payslip.email,
          subject: `BwanaBet Payslip - ${payslip.period_name}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:500px;margin:0 auto;padding:20px">
              <div style="text-align:center;margin-bottom:24px">
                <h2 style="margin:0;font-size:20px;color:#1a1a1a">BwanaBet</h2>
                <p style="margin:4px 0 0;color:#888;font-size:12px">Silverspring Entertainment Ltd</p>
              </div>
              <p style="font-size:14px;color:#333">Dear ${payslip.employee_name},</p>
              <p style="font-size:14px;color:#333">Your payslip for <strong>${payslip.period_name}</strong> is now available. Click the button below to view and download it.</p>
              <div style="text-align:center;margin:28px 0">
                <a href="${payslipUrl}" style="background:#1a1a1a;color:#fff;padding:12px 28px;text-decoration:none;border-radius:4px;font-size:14px;font-weight:bold;display:inline-block">View Payslip</a>
              </div>
              <p style="font-size:12px;color:#888;text-align:center">If the button doesn't work, copy and paste this link:<br/><a href="${payslipUrl}" style="color:#666;word-break:break-all">${payslipUrl}</a></p>
              <hr style="border:none;border-top:1px solid #eee;margin:24px 0"/>
              <p style="font-size:10px;color:#aaa;text-align:center">This is a confidential document intended for the named recipient only.<br/>Silverspring Entertainment Ltd | BwanaBet Payroll System</p>
            </div>`,
        });

        if (success) {
          results.push({ name: payslip.employee_name, email: payslip.email, status: "sent" });
        } else {
          results.push({ name: payslip.employee_name, email: payslip.email, status: "failed", error: error || "Send failed" });
        }
      } catch (err: any) {
        results.push({ name: payslip.employee_name, email: payslip.email, status: "failed", error: err.message });
      }
    }

    const sent = results.filter(r => r.status === "sent").length;
    const failed = results.filter(r => r.status === "failed").length;
    return NextResponse.json({ sent, failed, total: results.length, results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
