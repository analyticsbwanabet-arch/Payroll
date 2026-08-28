"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";

interface PayslipViewData {
  employee_name: string; position: string; branch_name: string;
  period_name: string; period_start: string; period_end: string;
  nrc_number: string; tpin: string; ssn: string; mobile_number: string; date_started: string;
  basic_pay: number; housing_allowance: number; transport_allowance: number; lunch_allowance: number;
  gross_salary: number; extra_shifts_count: number; extra_shift_total: number; bonus: number;
  napsa_employee: number; napsa_employer: number; nhima_employee: number; nhima_employer: number; paye_tax: number;
  shortage_amount: number; advances: number; fines: number;
  absent_days: number; absence_deduction: number; other_deductions: number; net_salary_due: number;
}

function fmt(n: number) { return "K" + n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function formatPosition(p: string) { return p === "SUPERVISOR" ? "SUPERVISOR" : p.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }
function formatDate(d: string) { if (!d) return ""; const dt = new Date(d + "T00:00:00"); return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" }); }

export default function PayslipViewPage() {
  const params = useParams();
  const token = params.token as string;
  const [data, setData] = useState<PayslipViewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch(`/api/payslip-view?token=${token}`);
        if (!res.ok) { setError("Payslip not found or link has expired."); setLoading(false); return; }
        const d = await res.json();
        setData(d);
      } catch { setError("Failed to load payslip."); }
      setLoading(false);
    };
    if (token) load();
  }, [token]);

  const downloadPDF = async () => {
    if (!data) return;
    const { generatePayslipPDF } = await import("@/lib/payslip");
    const doc = await generatePayslipPDF({ ...data, employee_id: "", basic_salary: data.basic_pay, comments: null, bank_name: "", bank_account_number: "" });
    const safeName = data.employee_name.replace(/[^a-zA-Z0-9]/g, "_");
    const safePeriod = data.period_name.replace(/\s+/g, "_");
    doc.save(`Payslip_${safeName}_${safePeriod}.pdf`);
  };

  if (loading) return (
    <>
      <style>{`
        nav, footer, body > main { display: none !important; }
        body { background: #f5f5f5 !important; color: #000 !important; }
      `}</style>
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#f5f5f5", fontFamily: "Arial, sans-serif", zIndex: 9999 }}>
        <div style={{ fontSize: "18px", color: "#636363" }}>Loading payslip...</div>
      </div>
    </>
  );

  if (error || !data) return (
    <>
      <style>{`
        nav, footer, body > main { display: none !important; }
        body { background: #f5f5f5 !important; color: #000 !important; }
      `}</style>
      <div style={{ position: "fixed", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#f5f5f5", fontFamily: "Arial, sans-serif", gap: "12px", zIndex: 9999 }}>
        <div style={{ fontSize: "48px" }}>🔒</div>
        <div style={{ fontSize: "18px", fontWeight: "bold", color: "#333" }}>Payslip Not Found</div>
        <div style={{ fontSize: "14px", color: "#636363" }}>{error || "This link may have expired or is invalid."}</div>
      </div>
    </>
  );

  const totalEarnings = data.gross_salary + data.extra_shift_total + data.bonus;
  const totalDeductions = data.napsa_employee + data.nhima_employee + data.paye_tax +
    data.shortage_amount + data.advances + data.fines + data.absence_deduction + data.other_deductions;
  const totalContrib = data.napsa_employer + data.nhima_employer;

  return (
    <>
      <style>{`
        nav, footer, body > main { display: none !important; }
        body { background: #f5f5f5 !important; color: #000 !important; }
      `}</style>
      <div style={{ position: "fixed", inset: 0, overflow: "auto", background: "#f5f5f5", fontFamily: "Arial, sans-serif", padding: "20px", zIndex: 9999 }}>
      <div style={{ maxWidth: "700px", margin: "0 auto", background: "#fff", border: "1px solid #e0e0e0", borderRadius: "4px", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "20px 24px", borderBottom: "2px solid #000", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            
            <div>
              <div style={{ fontSize: "20px", fontWeight: "bold" }}>BwanaBet</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Silverspring Entertainment Ltd</div>
              <div style={{ fontSize: "12px", color: "#666" }}>Lusaka, Zambia</div>
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "16px", fontWeight: "bold" }}>PAYSLIP</div>
            <div style={{ fontSize: "13px" }}>{data.period_name}</div>
            <div style={{ fontSize: "11px", color: "#666" }}>{formatDate(data.period_start)} - {formatDate(data.period_end)}</div>
          </div>
        </div>

        {/* Employee Details */}
        <div style={{ padding: "16px 24px", borderBottom: "1px solid #e0e0e0" }}>
          <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "8px", textTransform: "uppercase", color: "#333" }}>Employee Details</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 24px", fontSize: "12px" }}>
            <div><span style={{ color: "#888" }}>Employee Name: </span><strong>{data.employee_name}</strong></div>
            <div><span style={{ color: "#888" }}>Position: </span><strong>{formatPosition(data.position)}</strong></div>
            <div><span style={{ color: "#888" }}>Branch: </span><strong>{data.branch_name}</strong></div>
            <div><span style={{ color: "#888" }}>Date Started: </span><strong>{formatDate(data.date_started)}</strong></div>
            <div><span style={{ color: "#888" }}>NRC Number: </span><strong>{data.nrc_number || "—"}</strong></div>
            <div><span style={{ color: "#888" }}>TPIN: </span><strong>{data.tpin || "—"}</strong></div>
            <div><span style={{ color: "#888" }}>NAPSA No.: </span><strong>{data.ssn || "—"}</strong></div>
            <div><span style={{ color: "#888" }}>Mobile Number: </span><strong>{data.mobile_number || "—"}</strong></div>
          </div>
        </div>

        {/* Earnings & Deductions side by side */}
        <div style={{ padding: "16px 24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "6px", textTransform: "uppercase" }}>Earnings</div>
            <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f0f0f0" }}><th style={{ padding: "5px 8px", textAlign: "left", border: "1px solid #ddd" }}>Description</th><th style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #ddd" }}>Amount</th></tr></thead>
              <tbody>
                <Row label="Basic Pay" amount={data.basic_pay} />
                <Row label="Housing Allowance" amount={data.housing_allowance} />
                <Row label="Transport Allowance" amount={data.transport_allowance} />
                <Row label="Lunch Allowance" amount={data.lunch_allowance} />
                {data.extra_shift_total > 0 && <Row label={`Extra Shifts (${data.extra_shifts_count})`} amount={data.extra_shift_total} />}
                {data.bonus > 0 && <Row label="Bonus" amount={data.bonus} />}
                <tr style={{ fontWeight: "bold" }}><td style={{ padding: "5px 8px", border: "1px solid #ddd" }}>Total Earnings</td><td style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #ddd" }}>{fmt(totalEarnings)}</td></tr>
              </tbody>
            </table>
          </div>
          <div>
            <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "6px", textTransform: "uppercase" }}>Deductions</div>
            <table style={{ width: "100%", fontSize: "12px", borderCollapse: "collapse" }}>
              <thead><tr style={{ background: "#f0f0f0" }}><th style={{ padding: "5px 8px", textAlign: "left", border: "1px solid #ddd" }}>Description</th><th style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #ddd" }}>Amount</th></tr></thead>
              <tbody>
                <Row label="NAPSA Employee (5%)" amount={data.napsa_employee} />
                <Row label="NHIMA Employee (1%)" amount={data.nhima_employee} />
                {data.paye_tax > 0 && <Row label="Pay As You Earn (PAYE)" amount={data.paye_tax} />}
                {data.shortage_amount > 0 && <Row label="Cash Shortages" amount={data.shortage_amount} />}
                {data.advances > 0 && <Row label="Salary Advances" amount={data.advances} />}
                {data.fines > 0 && <Row label="Fines" amount={data.fines} />}
                {data.absence_deduction > 0 && <Row label={`Absence (${data.absent_days} days)`} amount={data.absence_deduction} />}
                <tr style={{ fontWeight: "bold" }}><td style={{ padding: "5px 8px", border: "1px solid #ddd" }}>Total Deductions</td><td style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #ddd" }}>{fmt(totalDeductions)}</td></tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Company Contributions */}
        <div style={{ padding: "0 24px 16px" }}>
          <div style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "6px", textTransform: "uppercase" }}>Company Contributions</div>
          <table style={{ width: "50%", fontSize: "12px", borderCollapse: "collapse" }}>
            <thead><tr style={{ background: "#f0f0f0" }}><th style={{ padding: "5px 8px", textAlign: "left", border: "1px solid #ddd" }}>Description</th><th style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #ddd" }}>Amount</th></tr></thead>
            <tbody>
              <Row label="NAPSA Employer (5%)" amount={data.napsa_employer} />
              <Row label="NHIMA Employer (1%)" amount={data.nhima_employer} />
              <tr style={{ fontWeight: "bold" }}><td style={{ padding: "5px 8px", border: "1px solid #ddd" }}>Total</td><td style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #ddd" }}>{fmt(totalContrib)}</td></tr>
            </tbody>
          </table>
        </div>

        {/* NET PAY */}
        <div style={{ margin: "0 24px 16px", border: "2px solid #000", padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ fontSize: "14px", fontWeight: "bold" }}>NET PAY</div>
          <div style={{ fontSize: "24px", fontWeight: "bold" }}>{fmt(data.net_salary_due)}</div>
        </div>

        {/* Notes */}
        <div style={{ padding: "0 24px 12px", fontSize: "11px", color: "#888" }}>Generated from daily logs</div>

        {/* Download button */}
        <div style={{ padding: "0 24px 16px" }}>
          <button onClick={downloadPDF} style={{ background: "#1a1a1a", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "4px", fontSize: "13px", fontWeight: "bold", cursor: "pointer" }}>
            📄 Download PDF
          </button>
        </div>

        {/* Footer */}
        <div style={{ padding: "12px 24px", borderTop: "1px solid #e0e0e0", textAlign: "center", fontSize: "10px", color: "#aaa" }}>
          <div>This is a computer-generated payslip and does not require a signature.</div>
          <div style={{ marginTop: "3px" }}>Silverspring Entertainment Ltd | BwanaBet Payroll System</div>
          <div style={{ marginTop: "3px" }}>Confidential - For intended recipient only</div>
        </div>
      </div>
    </div>
    </>
  );
}

function Row({ label, amount }: { label: string; amount: number }) {
  return (
    <tr>
      <td style={{ padding: "5px 8px", border: "1px solid #ddd" }}>{label}</td>
      <td style={{ padding: "5px 8px", textAlign: "right", border: "1px solid #ddd" }}>{fmt(amount)}</td>
    </tr>
  );
}
