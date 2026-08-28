import jsPDF from "jspdf";
import "jspdf-autotable";

export interface LeaveBalance {
  annual_accrued: number; annual_used: number; annual_balance: number;
  sick_entitled: number; sick_used: number; sick_balance: number;
  comp_entitled: number; comp_used: number; comp_balance: number;
}

export interface PayslipData {
  employee_name: string; employee_id: string; position: string; branch_name: string;
  period_name: string; period_start: string; period_end: string;
  nrc_number: string; tpin: string; ssn: string;
  mobile_number: string; date_started: string;
  basic_pay: number; housing_allowance: number; transport_allowance: number; lunch_allowance: number;
  basic_salary: number; extra_shifts_count: number; extra_shift_total: number; bonus: number;
  gross_salary: number; napsa_employee: number; napsa_employer: number;
  nhima_employee: number; nhima_employer: number; paye_tax: number;
  shortage_amount: number; advances: number; fines: number;
  absent_days: number; absence_deduction: number; other_deductions: number;
  net_salary_due: number; comments: string | null; leave?: LeaveBalance;
  // Legacy fields kept for compatibility
  bank_name?: string; bank_account_number?: string;
}

const fmt = (n: number) =>
  "K" + n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function formatPosition(p: string) {
  if (p === "SUPERVISOR") return "SUPERVISOR";
  return p.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatDate(d: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

async function loadLogo(): Promise<string | null> {
  try {
    const res = await fetch("/logo.png");
    const blob = await res.blob();
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(blob);
    });
  } catch { return null; }
}

export async function generatePayslipPDF(data: PayslipData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentW = w - margin * 2;
  let y = 15;

  // === COMPANY HEADER ===
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("BwanaBet", margin, y + 5);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Silverspring Entertainment Ltd", margin, y + 10);
  doc.text("Lusaka, Zambia", margin, y + 14);

  // Payslip title - right aligned
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("PAYSLIP", w - margin, y + 5, { align: "right" });
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(data.period_name, w - margin, y + 11, { align: "right" });
  doc.setFontSize(7);
  doc.setTextColor(100, 100, 100);
  doc.text(`${formatDate(data.period_start)} - ${formatDate(data.period_end)}`, w - margin, y + 15, { align: "right" });

  y += 22;

  // === DIVIDER ===
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, w - margin, y);
  y += 5;

  // === EMPLOYEE DETAILS ===
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(0, 0, 0);
  doc.text("EMPLOYEE DETAILS", margin, y);
  y += 4;

  const col1 = margin;
  const col2 = margin + 35;
  const col3 = w / 2 + 5;
  const col4 = w / 2 + 35;
  const lh = 4.5;

  const details = [
    ["Employee Name:", data.employee_name, "Position:", formatPosition(data.position)],
    ["Branch:", data.branch_name, "Date Started:", formatDate(data.date_started)],
    ["NRC Number:", data.nrc_number || "\u2014", "TPIN:", data.tpin || "\u2014"],
    ["NAPSA No.:", data.ssn || "\u2014", "Mobile Number:", data.mobile_number || "\u2014"],
  ];

  doc.setFontSize(7.5);
  details.forEach((row) => {
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 100, 100);
    doc.text(row[0], col1, y);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(0, 0, 0);
    doc.text(row[1], col2, y);
    if (row[2]) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 100, 100);
      doc.text(row[2], col3, y);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(0, 0, 0);
      doc.text(row[3], col4, y);
    }
    y += lh;
  });

  y += 2;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, w - margin, y);
  y += 5;

  // === SIDE BY SIDE: EARNINGS & DEDUCTIONS ===
  const halfW = (contentW - 4) / 2;

  const earningsData: any[] = [
    ["Basic Pay", fmt(data.basic_pay)],
    ["Housing Allowance", fmt(data.housing_allowance)],
    ["Transport Allowance", fmt(data.transport_allowance)],
    ["Lunch Allowance", fmt(data.lunch_allowance)],
  ];
  if (data.extra_shift_total > 0) earningsData.push(["Extra Shifts (" + data.extra_shifts_count + ")", fmt(data.extra_shift_total)]);
  if (data.bonus > 0) earningsData.push(["Bonus", fmt(data.bonus)]);
  const totalEarnings = data.gross_salary + data.extra_shift_total + data.bonus;
  earningsData.push([{ content: "Total Earnings", styles: { fontStyle: "bold" } }, { content: fmt(totalEarnings), styles: { fontStyle: "bold" } }]);

  const deductionsData: any[] = [
    ["NAPSA Employee (5%)", fmt(data.napsa_employee)],
    ["NHIMA Employee (1%)", fmt(data.nhima_employee)],
  ];
  if (data.paye_tax > 0) deductionsData.push(["Pay As You Earn (PAYE)", fmt(data.paye_tax)]);
  if (data.shortage_amount > 0) deductionsData.push(["Cash Shortages", fmt(data.shortage_amount)]);
  if (data.advances > 0) deductionsData.push(["Salary Advances", fmt(data.advances)]);
  if (data.fines > 0) deductionsData.push(["Fines", fmt(data.fines)]);
  if (data.absence_deduction > 0) deductionsData.push(["Absence Deduction (" + data.absent_days + " days)", fmt(data.absence_deduction)]);
  const totalDeductions = data.napsa_employee + data.nhima_employee + data.paye_tax +
    data.shortage_amount + data.advances + data.fines + data.absence_deduction + data.other_deductions;
  deductionsData.push([{ content: "Total Deductions", styles: { fontStyle: "bold" } }, { content: fmt(totalDeductions), styles: { fontStyle: "bold" } }]);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("EARNINGS", margin, y);
  doc.text("DEDUCTIONS", margin + halfW + 4, y);
  y += 1;

  const tableStyles = {
    styles: { fontSize: 7.5, cellPadding: 1.8, textColor: [0, 0, 0] as [number, number, number], lineColor: [200, 200, 200] as [number, number, number], lineWidth: 0.1 },
    headStyles: { fillColor: [240, 240, 240] as [number, number, number], textColor: [0, 0, 0] as [number, number, number], fontStyle: "bold" as const, fontSize: 7 },
    theme: "grid" as const,
  };

  (doc as any).autoTable({
    startY: y, margin: { left: margin }, tableWidth: halfW,
    head: [["Description", "Amount"]], body: earningsData,
    ...tableStyles,
    columnStyles: { 0: { cellWidth: halfW * 0.65 }, 1: { cellWidth: halfW * 0.35, halign: "right" } },
  });

  const earningsEndY = (doc as any).lastAutoTable.finalY;

  (doc as any).autoTable({
    startY: y, margin: { left: margin + halfW + 4 }, tableWidth: halfW,
    head: [["Description", "Amount"]], body: deductionsData,
    ...tableStyles,
    columnStyles: { 0: { cellWidth: halfW * 0.65 }, 1: { cellWidth: halfW * 0.35, halign: "right" } },
  });

  const deductionsEndY = (doc as any).lastAutoTable.finalY;
  y = Math.max(earningsEndY, deductionsEndY) + 8;

  // === COMPANY CONTRIBUTIONS ===
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("COMPANY CONTRIBUTIONS", margin, y);
  y += 1;

  const totalContrib = data.napsa_employer + data.nhima_employer;

  (doc as any).autoTable({
    startY: y, margin: { left: margin }, tableWidth: halfW,
    head: [["Description", "Amount"]],
    body: [
      ["NAPSA Employer (5%)", fmt(data.napsa_employer)],
      ["NHIMA Employer (1%)", fmt(data.nhima_employer)],
      [{ content: "Total Company Contributions", styles: { fontStyle: "bold" } }, { content: fmt(totalContrib), styles: { fontStyle: "bold" } }],
    ],
    ...tableStyles,
    columnStyles: { 0: { cellWidth: halfW * 0.65 }, 1: { cellWidth: halfW * 0.35, halign: "right" } },
  });

  y = (doc as any).lastAutoTable.finalY + 6;

  // === NET PAY BOX ===
  doc.setDrawColor(0, 0, 0);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentW, 14);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("NET PAY", margin + 4, y + 9);
  doc.setFontSize(14);
  doc.text(fmt(data.net_salary_due), w - margin - 4, y + 9.5, { align: "right" });
  y += 20;

  // === NOTES ===
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Generated from daily logs", margin, y);
  y += 6;

  // === FOOTER ===
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, y, w - margin, y);
  y += 4;
  doc.setFontSize(6.5);
  doc.setFont("helvetica", "italic");
  doc.setTextColor(150, 150, 150);
  doc.text("This is a computer-generated payslip and does not require a signature.", w / 2, y, { align: "center" });
  doc.text("Silverspring Entertainment Ltd | BwanaBet Payroll System", w / 2, y + 3.5, { align: "center" });
  doc.text("Confidential - For intended recipient only", w / 2, y + 7, { align: "center" });

  return doc;
}

export async function downloadPayslip(data: PayslipData) {
  const doc = await generatePayslipPDF(data);
  const safeName = data.employee_name.replace(/[^a-zA-Z0-9]/g, "_");
  const safePeriod = data.period_name.replace(/\s+/g, "_");
  doc.save(`Payslip_${safeName}_${safePeriod}.pdf`);
}

export async function downloadAllPayslips(payslips: PayslipData[]) {
  for (const data of payslips) {
    const doc = await generatePayslipPDF(data);
    const safeName = data.employee_name.replace(/[^a-zA-Z0-9]/g, "_");
    const safePeriod = data.period_name.replace(/\s+/g, "_");
    doc.save(`Payslip_${safeName}_${safePeriod}.pdf`);
    await new Promise((r) => setTimeout(r, 200)); // Small delay between downloads
  }
}
