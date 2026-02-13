import jsPDF from "jspdf";
import "jspdf-autotable";

export interface PayslipData {
  employee_name: string;
  employee_id: string;
  position: string;
  branch_name: string;
  period_name: string;
  period_start: string;
  period_end: string;
  basic_salary: number;
  extra_shifts_count: number;
  extra_shift_total: number;
  bonus: number;
  gross_salary: number;
  napsa_employee: number;
  nhima_employee: number;
  paye_tax: number;
  shortage_amount: number;
  advances: number;
  fines: number;
  absent_days: number;
  absence_deduction: number;
  other_deductions: number;
  net_salary_due: number;
  comments: string | null;
}

const fmt = (n: number) =>
  `K${n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Brand colors
const GREEN = [22, 163, 74];     // #16a34a
const GOLD = [234, 179, 8];      // #eab308
const DARK = [5, 10, 5];         // #050a05
const CARD = [10, 26, 10];       // #0a1a0a
const TEXT = [232, 245, 232];     // #e8f5e8
const DIM = [74, 110, 74];       // #4a6e4a

export function generatePayslipPDF(data: PayslipData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  buildPayslipPage(doc, data);
  return doc;
}

export function downloadPayslip(data: PayslipData) {
  const doc = generatePayslipPDF(data);
  const filename = `Payslip_${data.employee_name.replace(/\s+/g, "_")}_${data.period_name.replace(/\s+/g, "_")}.pdf`;
  doc.save(filename);
}

export function downloadAllPayslips(employees: PayslipData[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let first = true;
  for (const emp of employees) {
    if (!first) doc.addPage();
    first = false;
    buildPayslipPage(doc, emp);
  }
  const periodName = employees[0]?.period_name || "Payroll";
  doc.save(`All_Payslips_${periodName.replace(/\s+/g, "_")}.pdf`);
}

function buildPayslipPage(doc: jsPDF, data: PayslipData) {
  const w = doc.internal.pageSize.getWidth();
  let y = 15;

  // === HEADER - Dark green band ===
  doc.setFillColor(5, 15, 5);
  doc.rect(0, 0, w, 44, "F");

  // Gold accent line
  doc.setFillColor(...GOLD);
  doc.rect(0, 44, w, 2.5, "F");

  // Green accent left edge
  doc.setFillColor(...GREEN);
  doc.rect(0, 0, 4, 44, "F");

  // Company name in gold
  doc.setTextColor(...GOLD);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("BwanaBet", 15, y + 8);

  doc.setTextColor(...DIM);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Zambia • Payroll System", 15, y + 15);

  // Payslip label
  doc.setTextColor(...TEXT);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PAYSLIP", w - 15, y + 5, { align: "right" });

  doc.setTextColor(...DIM);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.period_name, w - 15, y + 13, { align: "right" });
  doc.text(`${data.period_start}  to  ${data.period_end}`, w - 15, y + 20, { align: "right" });

  y = 55;

  // === EMPLOYEE DETAILS ===
  doc.setFillColor(15, 30, 15);
  doc.roundedRect(15, y, w - 30, 28, 3, 3, "F");
  doc.setDrawColor(...GREEN);
  doc.setLineWidth(0.5);
  doc.roundedRect(15, y, w - 30, 28, 3, 3, "S");

  const col1 = 20, col2 = w / 2 + 5;

  doc.setTextColor(...DIM);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("EMPLOYEE NAME", col1, y + 7);
  doc.text("POSITION", col1, y + 19);
  doc.text("BRANCH", col2, y + 7);
  doc.text("EMPLOYEE ID", col2, y + 19);

  doc.setTextColor(...GOLD);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.employee_name, col1, y + 12.5);

  doc.setTextColor(...TEXT);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(formatPosition(data.position), col1, y + 24);

  doc.setTextColor(...GOLD);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.branch_name, col2, y + 12.5);

  doc.setTextColor(...TEXT);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text(data.employee_id.substring(0, 8).toUpperCase(), col2, y + 24);

  y += 36;

  // === EARNINGS ===
  doc.setTextColor(...GREEN);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("EARNINGS", 15, y);
  y += 2;

  const earningsRows: any[] = [["Basic Salary", fmt(data.basic_salary)]];
  if (data.extra_shift_total > 0) earningsRows.push([`Extra Shifts (${data.extra_shifts_count})`, fmt(data.extra_shift_total)]);
  if (data.bonus > 0) earningsRows.push(["Bonus", fmt(data.bonus)]);
  earningsRows.push([
    { content: "GROSS SALARY", styles: { fontStyle: "bold" } },
    { content: fmt(data.gross_salary), styles: { fontStyle: "bold" } },
  ]);

  (doc as any).autoTable({
    startY: y,
    head: [["Description", "Amount (ZMW)"]],
    body: earningsRows,
    theme: "plain",
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
    headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontSize: 8, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 45, halign: "right" } },
    alternateRowStyles: { fillColor: [245, 250, 245] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // === STATUTORY DEDUCTIONS ===
  doc.setTextColor(...GOLD);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("STATUTORY DEDUCTIONS", 15, y);
  y += 2;

  const statRows: any[] = [["NAPSA (5%)", fmt(data.napsa_employee)], ["NHIMA (1%)", fmt(data.nhima_employee)]];
  if (data.paye_tax > 0) statRows.push(["PAYE Tax", fmt(data.paye_tax)]);
  const statTotal = data.napsa_employee + data.nhima_employee + data.paye_tax;
  statRows.push([
    { content: "TOTAL STATUTORY", styles: { fontStyle: "bold" } },
    { content: fmt(statTotal), styles: { fontStyle: "bold" } },
  ]);

  (doc as any).autoTable({
    startY: y,
    head: [["Description", "Amount (ZMW)"]],
    body: statRows,
    theme: "plain",
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
    headStyles: { fillColor: [254, 249, 195], textColor: [113, 63, 18], fontSize: 8, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 45, halign: "right" } },
    alternateRowStyles: { fillColor: [255, 253, 245] },
  });

  y = (doc as any).lastAutoTable.finalY + 8;

  // === OTHER DEDUCTIONS ===
  const hasOther = data.shortage_amount > 0 || data.advances > 0 || data.fines > 0 || data.absence_deduction > 0;
  if (hasOther) {
    doc.setTextColor(239, 68, 68);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("OTHER DEDUCTIONS", 15, y);
    y += 2;

    const otherRows: any[] = [];
    if (data.absence_deduction > 0) otherRows.push([`Absence Deduction (${data.absent_days} days)`, fmt(data.absence_deduction)]);
    if (data.shortage_amount > 0) otherRows.push(["Cash Shortage", fmt(data.shortage_amount)]);
    if (data.advances > 0) otherRows.push(["Salary Advance", fmt(data.advances)]);
    if (data.fines > 0) otherRows.push(["Fines / Penalties", fmt(data.fines)]);
    const otherTotal = data.shortage_amount + data.advances + data.fines + data.absence_deduction + data.other_deductions;
    otherRows.push([
      { content: "TOTAL OTHER DEDUCTIONS", styles: { fontStyle: "bold" } },
      { content: fmt(otherTotal), styles: { fontStyle: "bold" } },
    ]);

    (doc as any).autoTable({
      startY: y,
      head: [["Description", "Amount (ZMW)"]],
      body: otherRows,
      theme: "plain",
      margin: { left: 15, right: 15 },
      styles: { fontSize: 9, cellPadding: 3, textColor: [50, 50, 50] },
      headStyles: { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontSize: 8, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 45, halign: "right" } },
      alternateRowStyles: { fillColor: [255, 248, 248] },
    });

    y = (doc as any).lastAutoTable.finalY + 10;
  }

  // === NET PAY BOX ===
  doc.setFillColor(5, 15, 5);
  doc.roundedRect(15, y, w - 30, 24, 3, 3, "F");
  doc.setFillColor(...GREEN);
  doc.roundedRect(15, y, 5, 24, 2, 0, "F");
  doc.rect(18, y, 2, 24, "F");

  doc.setTextColor(...DIM);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("NET SALARY DUE", 27, y + 10);

  doc.setTextColor(...GREEN);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(fmt(data.net_salary_due), w - 20, y + 15.5, { align: "right" });

  y += 32;

  // Comments
  if (data.comments) {
    doc.setTextColor(...DIM);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("COMMENTS", 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.comments, 15, y + 5);
  }

  // === FOOTER ===
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(0.3);
  doc.line(15, footerY, w - 15, footerY);

  doc.setTextColor(...DIM);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("This is a computer-generated payslip and does not require a signature.", 15, footerY + 5);
  doc.text("BwanaBet Zambia • NAPSA 5% • NHIMA 1% • PAYE 2025 Brackets", 15, footerY + 9);
  doc.text(`Generated: ${new Date().toLocaleDateString("en-ZM", { year: "numeric", month: "long", day: "numeric" })}`, w - 15, footerY + 5, { align: "right" });
}

function formatPosition(pos: string): string {
  const map: Record<string, string> = {
    manager: "Manager", assistant_manager: "Assistant Manager", cashier: "Cashier",
    it_technician: "IT Technician", security: "Security", cleaner: "Cleaner",
    biker: "Biker", call_center_agent: "Call Center Agent",
  };
  return map[pos] || pos;
}
