import jsPDF from "jspdf";
import "jspdf-autotable";

export interface LeaveBalance {
  annual_accrued: number;
  annual_used: number;
  annual_balance: number;
  sick_entitled: number;
  sick_used: number;
  sick_balance: number;
  comp_entitled: number;
  comp_used: number;
  comp_balance: number;
}

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
  leave?: LeaveBalance;
}

const fmt = (n: number) =>
  "K" + n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function generatePayslipPDF(data: PayslipData): jsPDF {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  buildPayslipPage(doc, data);
  return doc;
}

export function downloadPayslip(data: PayslipData) {
  const doc = generatePayslipPDF(data);
  doc.save("Payslip_" + data.employee_name.replace(/\s+/g, "_") + "_" + data.period_name.replace(/\s+/g, "_") + ".pdf");
}

export function downloadAllPayslips(employees: PayslipData[]) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  let first = true;
  for (const emp of employees) {
    if (!first) doc.addPage();
    first = false;
    buildPayslipPage(doc, emp);
  }
  doc.save("All_Payslips_" + (employees[0]?.period_name || "Payroll").replace(/\s+/g, "_") + ".pdf");
}

function buildPayslipPage(doc: jsPDF, data: PayslipData) {
  const w = doc.internal.pageSize.getWidth();
  let y = 15;

  // === HEADER ===
  doc.setFillColor(10, 10, 10);
  doc.rect(0, 0, w, 44, "F");
  doc.setFillColor(250, 204, 21);
  doc.rect(0, 44, w, 2.5, "F");
  doc.setFillColor(34, 197, 94);
  doc.rect(0, 0, 4, 44, "F");

  doc.setTextColor(250, 204, 21);
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("BwanaBet", 15, y + 8);

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("Zambia • Payroll System", 15, y + 15);

  doc.setTextColor(245, 245, 245);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("PAYSLIP", w - 15, y + 5, { align: "right" });

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(data.period_name, w - 15, y + 13, { align: "right" });
  doc.text(data.period_start + "  to  " + data.period_end, w - 15, y + 20, { align: "right" });

  y = 55;

  // === EMPLOYEE BOX ===
  doc.setFillColor(245, 245, 245);
  doc.roundedRect(15, y, w - 30, 28, 3, 3, "F");

  const col1 = 20;
  const col2 = w / 2 + 5;

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("EMPLOYEE NAME", col1, y + 7);
  doc.text("POSITION", col1, y + 19);
  doc.text("BRANCH", col2, y + 7);
  doc.text("EMPLOYEE ID", col2, y + 19);

  doc.setTextColor(10, 10, 10);
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(data.employee_name, col1, y + 12.5);
  doc.text(data.branch_name, col2, y + 12.5);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(formatPosition(data.position), col1, y + 24);
  doc.setFontSize(8);
  doc.text(data.employee_id.substring(0, 8).toUpperCase(), col2, y + 24);

  y += 36;

  // === EARNINGS ===
  doc.setTextColor(34, 197, 94);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("EARNINGS", 15, y);
  y += 2;

  const earningsRows: any[] = [["Basic Salary", fmt(data.basic_salary)]];
  if (data.extra_shift_total > 0) earningsRows.push(["Extra Shifts (" + data.extra_shifts_count + ")", fmt(data.extra_shift_total)]);
  if (data.bonus > 0) earningsRows.push(["Bonus", fmt(data.bonus)]);
  earningsRows.push([
    { content: "GROSS SALARY", styles: { fontStyle: "bold" } },
    { content: fmt(data.gross_salary), styles: { fontStyle: "bold" } },
  ]);

  (doc as any).autoTable({
    startY: y, head: [["Description", "Amount (ZMW)"]], body: earningsRows, theme: "plain",
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30] },
    headStyles: { fillColor: [220, 252, 231], textColor: [22, 101, 52], fontSize: 8, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 45, halign: "right" } },
    alternateRowStyles: { fillColor: [250, 250, 250] },
  });
  y = (doc as any).lastAutoTable.finalY + 7;

  // === STATUTORY ===
  doc.setTextColor(202, 138, 4);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("STATUTORY DEDUCTIONS", 15, y);
  y += 2;

  const statRows: any[] = [["NAPSA (5%)", fmt(data.napsa_employee)], ["NHIMA (1%)", fmt(data.nhima_employee)]];
  if (data.paye_tax > 0) statRows.push(["PAYE Tax", fmt(data.paye_tax)]);
  statRows.push([
    { content: "TOTAL STATUTORY", styles: { fontStyle: "bold" } },
    { content: fmt(data.napsa_employee + data.nhima_employee + data.paye_tax), styles: { fontStyle: "bold" } },
  ]);

  (doc as any).autoTable({
    startY: y, head: [["Description", "Amount (ZMW)"]], body: statRows, theme: "plain",
    margin: { left: 15, right: 15 },
    styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30] },
    headStyles: { fillColor: [254, 249, 195], textColor: [133, 77, 14], fontSize: 8, fontStyle: "bold" },
    columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 45, halign: "right" } },
    alternateRowStyles: { fillColor: [255, 253, 245] },
  });
  y = (doc as any).lastAutoTable.finalY + 7;

  // === OTHER DEDUCTIONS ===
  const hasOther = data.shortage_amount > 0 || data.advances > 0 || data.fines > 0 || data.absence_deduction > 0;
  if (hasOther) {
    doc.setTextColor(220, 38, 38);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("OTHER DEDUCTIONS", 15, y);
    y += 2;

    const otherRows: any[] = [];
    if (data.absence_deduction > 0) otherRows.push(["Absence (" + data.absent_days + " days)", fmt(data.absence_deduction)]);
    if (data.shortage_amount > 0) otherRows.push(["Cash Shortage", fmt(data.shortage_amount)]);
    if (data.advances > 0) otherRows.push(["Salary Advance", fmt(data.advances)]);
    if (data.fines > 0) otherRows.push(["Fines / Penalties", fmt(data.fines)]);
    const otherTotal = data.shortage_amount + data.advances + data.fines + data.absence_deduction + data.other_deductions;
    otherRows.push([
      { content: "TOTAL OTHER DEDUCTIONS", styles: { fontStyle: "bold" } },
      { content: fmt(otherTotal), styles: { fontStyle: "bold" } },
    ]);

    (doc as any).autoTable({
      startY: y, head: [["Description", "Amount (ZMW)"]], body: otherRows, theme: "plain",
      margin: { left: 15, right: 15 },
      styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30] },
      headStyles: { fillColor: [254, 226, 226], textColor: [185, 28, 28], fontSize: 8, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: "auto" }, 1: { cellWidth: 45, halign: "right" } },
      alternateRowStyles: { fillColor: [255, 248, 248] },
    });
    y = (doc as any).lastAutoTable.finalY + 8;
  }

  // === NET PAY BOX ===
  doc.setFillColor(10, 10, 10);
  doc.roundedRect(15, y, w - 30, 24, 3, 3, "F");
  doc.setFillColor(34, 197, 94);
  doc.roundedRect(15, y, 5, 24, 2, 0, "F");
  doc.rect(18, y, 2, 24, "F");

  doc.setTextColor(160, 160, 160);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("NET SALARY DUE", 27, y + 10);

  doc.setTextColor(74, 222, 128);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text(fmt(data.net_salary_due), w - 20, y + 15.5, { align: "right" });

  y += 32;

  // === LEAVE BALANCES ===
  if (data.leave) {
    doc.setTextColor(96, 165, 250);
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.text("LEAVE BALANCES", 15, y);
    y += 2;

    const lv = data.leave;
    const leaveRows = [
      ["Annual Leave", String(lv.annual_accrued) + " days", String(lv.annual_used) + " days", String(lv.annual_balance) + " days"],
      ["Sick Leave", String(lv.sick_entitled) + " days", String(lv.sick_used) + " days", String(lv.sick_balance) + " days"],
      ["Compassionate", String(lv.comp_entitled) + " days", String(lv.comp_used) + " days", String(lv.comp_balance) + " days"],
    ];

    (doc as any).autoTable({
      startY: y,
      head: [["Leave Type", "Entitled / Accrued", "Used", "Balance"]],
      body: leaveRows,
      theme: "plain",
      margin: { left: 15, right: 15 },
      styles: { fontSize: 9, cellPadding: 3, textColor: [30, 30, 30] },
      headStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontSize: 8, fontStyle: "bold" },
      columnStyles: {
        0: { cellWidth: "auto" },
        1: { cellWidth: 40, halign: "center" },
        2: { cellWidth: 30, halign: "center" },
        3: { cellWidth: 30, halign: "center", fontStyle: "bold" },
      },
      alternateRowStyles: { fillColor: [248, 250, 255] },
      didParseCell: function(hookData: any) {
        // Color the balance column based on value
        if (hookData.section === "body" && hookData.column.index === 3) {
          const val = parseFloat(hookData.cell.text[0]);
          if (val <= 0) hookData.cell.styles.textColor = [220, 38, 38];
          else if (val <= 3) hookData.cell.styles.textColor = [202, 138, 4];
          else hookData.cell.styles.textColor = [22, 101, 52];
        }
      },
    });
    y = (doc as any).lastAutoTable.finalY + 6;
  }

  // === COMMENTS ===
  if (data.comments && data.comments !== "Generated from daily logs" && data.comments !== "No daily logs recorded") {
    doc.setTextColor(120, 120, 120);
    doc.setFontSize(8);
    doc.setFont("helvetica", "bold");
    doc.text("COMMENTS", 15, y);
    doc.setFont("helvetica", "normal");
    doc.text(data.comments, 15, y + 5);
  }

  // === FOOTER ===
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setDrawColor(250, 204, 21);
  doc.setLineWidth(0.3);
  doc.line(15, footerY, w - 15, footerY);

  doc.setTextColor(140, 140, 140);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("This is a computer-generated payslip and does not require a signature.", 15, footerY + 5);
  doc.text("BwanaBet Zambia  •  NAPSA 5%  •  NHIMA 1%  •  PAYE 2025 Brackets  •  Leave: 2 days/month annual, 10 sick, 5 compassionate", 15, footerY + 9);
  doc.text("Generated: " + new Date().toLocaleDateString("en-ZM", { year: "numeric", month: "long", day: "numeric" }), w - 15, footerY + 5, { align: "right" });
}

function formatPosition(pos: string): string {
  const map: Record<string, string> = {
    manager: "Manager", assistant_manager: "Assistant Manager", cashier: "Cashier",
    it_technician: "IT Technician", security: "Security", cleaner: "Cleaner",
    biker: "Biker", call_center_agent: "Call Center Agent",
  };
  return map[pos] || pos;
}
