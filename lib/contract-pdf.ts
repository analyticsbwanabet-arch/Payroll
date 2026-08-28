import jsPDF from "jspdf";
import "jspdf-autotable";

interface ContractPDFData {
  employee_name: string; nrc_number: string; ssn: string; home_address: string;
  position: string; branch_name: string; effective_date: string; end_date: string;
  basic_pay: number; housing_allowance: number; other_allowances: number; gross_salary: number;
  signed_name: string; signature_data: string; signed_at: string;
}

function fmt(n: number) { return n.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
function fmtDate(d: string) { if (!d) return "_______________"; return new Date(d + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }); }
function fmtPos(p: string) { return p === "SUPERVISOR" ? "Supervisor" : (p || "").replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()); }

export async function generateContractPDF(data: ContractPDFData): Promise<jsPDF> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const m = 18;
  const cw = w - m * 2;
  let y = 20;

  const normal = (size = 9) => { doc.setFont("times", "normal"); doc.setFontSize(size); doc.setTextColor(0, 0, 0); };
  const bold = (size = 9) => { doc.setFont("times", "bold"); doc.setFontSize(size); doc.setTextColor(0, 0, 0); };
  const italic = (size = 9) => { doc.setFont("times", "italic"); doc.setFontSize(size); doc.setTextColor(0, 0, 0); };

  const checkPage = (need: number) => {
    if (y + need > h - 20) { doc.addPage(); y = 20; }
  };

  const writeText = (text: string, opts?: { bold?: boolean; italic?: boolean; size?: number; align?: "left" | "center" | "justify"; indent?: number; spacing?: number }) => {
    const size = opts?.size || 9;
    const align = opts?.align || "justify";
    const indent = opts?.indent || 0;
    const spacing = opts?.spacing || 4.5;
    if (opts?.bold) bold(size); else if (opts?.italic) italic(size); else normal(size);
    const maxW = cw - indent;
    const lines = doc.splitTextToSize(text, maxW);
    for (const line of lines) {
      checkPage(spacing);
      if (align === "center") doc.text(line, w / 2, y, { align: "center" });
      else doc.text(line, m + indent, y);
      y += spacing;
    }
    y += 1;
  };

  const heading = (text: string) => { checkPage(8); writeText(text, { bold: true, size: 10, spacing: 5 }); };

  // === TITLE ===
  writeText("FIXED TERM EMPLOYMENT CONTRACT", { bold: true, size: 14, align: "center", spacing: 7 });
  y += 2;
  writeText("BETWEEN", { align: "center" });
  writeText("SILVERSPRING ENTERTAINMENT LIMITED – TRADING AS \"BWANA BET\"", { bold: true, align: "center" });
  writeText("AND", { align: "center" });
  writeText(data.employee_name.toUpperCase(), { bold: true, align: "center" });
  y += 3;

  doc.setDrawColor(0); doc.setLineWidth(0.3); doc.line(m, y, w - m, y); y += 6;

  writeText("FIXED TERM EMPLOYMENT CONTRACT", { bold: true, size: 12, align: "center", spacing: 7 });
  y += 2;

  // Preamble
  writeText(`THIS FIXED TERM EMPLOYMENT CONTRACT ("Contract") dated ${fmtDate(data.effective_date)} (the "Effective Date") is made between SILVERSPRING ENTERTAINMENT LIMITED, TRADING AS "BWANA BET" with an office at Plot 14/5B Twin Palm Road. Kabulonga, Lusaka, Zambia, (hereinafter referred to as the "Company"),`);
  y += 1;
  writeText("AND");
  y += 1;

  normal(9);
  checkPage(20);
  doc.text("Name:", m, y); bold(9); doc.text(data.employee_name, m + 45, y); y += 5;
  normal(9); doc.text("NRC Number:", m, y); bold(9); doc.text(data.nrc_number || "_______________", m + 45, y); y += 5;
  normal(9); doc.text("Social Security Number:", m, y); bold(9); doc.text(data.ssn || "_______________", m + 45, y); y += 5;
  normal(9); doc.text("Residing at the address:", m, y); bold(9); doc.text(data.home_address || "_______________", m + 45, y); y += 7;

  writeText(`(hereinafter referred to as the "Employee"), for the purpose of setting forth the exclusive terms and conditions of employment.`);
  writeText("In consideration of the mutual obligations specified in this Agreement, the parties, intending to be legally bound hereby, agree to the following:");
  y += 2;

  // Sections
  heading("1. AGREEMENT");
  writeText(`The company shall on and from ${fmtDate(data.effective_date)} enter onto employment of the Employee on a contract of employment of the duration of ONE (01) year, ending on ${fmtDate(data.end_date)} and shall be employed in the position of ${fmtPos(data.position)} at ${data.branch_name}.`);

  heading("2. JOB TITLE");
  writeText('Duties and responsibilities. The duties and responsibilities of the position shall be described by the immediate supervisor or in a separate document titled "Job Description".');
  writeText("Employee performance appraisal. The employee performance shall be reviewed after the Probation Period, which shall run for Three (03) Months from the starting date. The employer shall conduct a performance evaluation of the Employee, at least once per calendar year, or at any time it may be deemed necessary.");

  heading("3. FIXED-TERM CONTRACT");
  writeText("On the completion of the contract, the employment will be deemed to have been fulfilled with no continuing liability whatsoever from either party. Therefore service under this Contract shall not be deemed continuous. This Contract shall be deemed expired at the end of the fixed-term stated above, unless it is renewed by mutual agreement between the Parties.");

  heading("4. PROBATIONARY PERIOD");
  writeText("Probationary period shall be for the period of THREE (03) MONTHS during which time employment may be terminated by 24 hours' notice be either party, or a day's pay in lieu of notice. If the Employee successfully completes the Probationary Period, the Employer shall confirm the appointment in writing.");

  heading("5. TERMINATION OF CONTRACT");
  writeText("After successfully completing the Probationary Period, either Party may terminate this contract by giving notice of ONE (01) MONTH, or in the case of the Company, pay in lieu of notice, with a valid reason in accordance with Section 5(a) and (b) of the Labour Act No. 15 of 2015, and any other prevailing legislation, except in case of summary dismissal, which shall have the immediate effect of terminating the Contract without any additional liability on the part of the employer except the following Termination benefits:");
  writeText("Normal Contract Termination:", { bold: true });
  writeText("(a) Pay worked for up to date of termination;"); writeText("(b) One (1) month's salary in lieu of notice, if either party does not agree to work notice period;"); writeText("(c) Accrued leave days' pay (if any);"); writeText("(d) Less Debt/Owings to the company (if any)"); writeText("(e) Accrued gratuity prorated"); writeText("(f) Reference of service");
  writeText("Summary Dismissal:", { bold: true });
  writeText("(a) Pay worked for up to date of termination;"); writeText("(b) Accrued leave days' pay (if any);"); writeText("(c) Less Debt/Owings to the company (if any)"); writeText("(d) Accrued gratuity prorated"); writeText("(e) Reference of service");

  heading("6. REMUNERATION");
  writeText("(a) In exchange for the full, prompt, and satisfactory performance of all Services rendered to the Company (as determined by the Company), Company shall provide Employee, monthly remuneration but calculated on days worked as hereunder to be paid on a date set by the Company each month.");
  checkPage(30);
  (doc as any).autoTable({
    startY: y, margin: { left: m }, tableWidth: cw * 0.6,
    body: [
      ["basic monthly salary", `ZMW ${fmt(data.basic_pay)} per month`],
      ["housing allowance (30% basic salary)", `ZMW ${fmt(data.housing_allowance)} per month`],
      ["other work allowances", `ZMW ${fmt(data.other_allowances)} per month`],
      [{ content: "Total gross salary", styles: { fontStyle: "bold" } }, { content: `ZMW ${fmt(data.gross_salary)} per month`, styles: { fontStyle: "bold" } }],
    ],
    styles: { fontSize: 8, cellPadding: 2, textColor: [0, 0, 0], lineColor: [180, 180, 180], lineWidth: 0.1, font: "times" },
    columnStyles: { 1: { halign: "right" } },
    theme: "grid",
  });
  y = (doc as any).lastAutoTable.finalY + 4;
  writeText("Including Annual Gratuity @25% of accrued basic pay to be paid after completion of the last month of the contract.");
  writeText("(b) As required by law, the Company shall withhold all sums and/or payments due by the employee for social security, tax liabilities and mandatory contributions, namely: PAYE, NAPSA and NHIMA.");
  writeText("(c) The Company reserves the right to adjust the monthly salary based on DAYS WORKED by Employee.");

  heading("7. DETERMINATION OF RATE OF SALARY");
  writeText("The rate of Basic Pay is determined solely by the Employer with due regard to the nature of work to be performed and the Employer assessment of the ability of the Employee to perform the Job as well as Company' ability to pay. Furthermore, the basic salary may be adjusted upward at any point during the contract at the sole discretion of the Company.");

  heading("8. HOURS OF WORK");
  writeText("Normal hours of work shall be 50 hours per week, however due to the nature of our industry the Employee will be require to work non-standard hours ranging between 48 and 54 hours and Management will work with the Employee to determine a time-table to suit operational demands and requirements. The Employee understands and accepts that the Employee may be required to attend to work issues during off days, leave days, and off-work hours, which shall be compensated either by a commensurate substitution of work hours or by paid overtime.");

  heading("9. OVERTIME");
  writeText('Overtime must be duly authorised by Management for specific needs and which is worked after your normal daily working schedule, shall be paid at the Company\'s approved standard rate. Employee acknowledges that our operational days include Sundays and Public Holidays and are considered normal working days and shall NOT be observed as "overtime".');

  heading("10. LEAVE");
  writeText("(a) ANNUAL LEAVE", { bold: true });
  writeText("Employee shall be entitled to accumulated leave days, calculated as: TWO (02) working days leave per each month worked. Such leave may be taken only after notification and approval by the employer. Notice and application for leave must be given at least 7 days before. The employee shall qualify for leave after working for six months continuous service.");
  writeText("(b) PAID SICK LEAVE", { bold: true });
  writeText("Any absence from duty on grounds of sickness shall be notified to the company within 24 hours and shall be supported by company approved registered Doctor's Certificate or medical diagnosis on letter headed paper, signed by a named and licensed medical practitioner, or from a company designated medical practitioner or institution which shall state explicitly the nature of illness. It is up to Manager's discretion to accept the Doctor's Certificate or request additional proof where there it is reasonable. If additional proof cannot be provided it is up to Manager's Discretion to review Paid Sick Leave entitlement.");
  writeText("An employee may choose to take an unlimited amount of UNPAID Sick Leave as the situation demands it by notifying management.");
  writeText("(c) PROLONGED SICK LEAVE", { bold: true });
  writeText("Sick leave may be considered and granted with basic salary paid for a maximum of 90 days and at half of the basic salary for a further period of 90 consecutive days based on the recommendation of a Medical Professional recognised by the Company as being competent and certified to issue such a recommendation. The final decision to approve the Prolonged Sick Leave, or not, rests solely with Company Management. Any instances of fraud shall be prosecuted to the full extent of the law.");

  heading("11. MEDICAL DISCHARGE");
  writeText("Subject to the recommendation of a Company approved registered Medical Practioner and if the Company is of the opinion that the employee will be unable to perform his/her duties to an acceptable standard (as determined by the Company) by reason of disability through continued sickness, the employee will be medically discharged and shall be paid not less that TWO (02) months basic salary for each completed year of service to the company pro-rata of the running contract.");

  heading("12. MATERNITY LEAVE");
  writeText("Female employees, who have served the company for a period of TWO (02) YEAR employment contract with the company, shall be granted ONE HUNDRED AND TWENTY (120) days maternity leave with basic pay. Further entitlement will be after a further period of TWO (02) years starting from the date of return to full duties.");

  heading("13. FEMALE LEAVE");
  writeText("Further to Section 47 of the Employment Code No 3, 2019, every female employee shall be entitled to a ONE (01) day absence from work each month without the requirement to produce a valid medical certificate.");

  heading("14. PATERNITY LEAVE");
  writeText("Male employees shall be entitled to FIVE (05) days paid Paternity leave on production of a birth certificate or record of birth of the employee's biological child. Paternity Leave entitlement shall only apply to legally married couples and the employer must be shown details and copies of documentation relating to the Spouse. Paternity leave shall be in addition to any other leave which the employee may be entitled to.");

  heading("15. FAMILY RESPONSIBILITY LEAVE");
  writeText("All employees shall be entitled to Seven (07) days paid leave in a prorated year worked to enable nursing of sick spouses, children or dependents and an additional Three (03) days paid leave per prorated year worked to cover responsibilities related to care, health or education of their children, spouses or dependents.");

  heading("16. FUNERAL ASSISTANCE");
  writeText("In the event of the death of an employee, Spouse and or/ biological child below 18 years of age, the employer shall provide the following:");
  writeText("a standard coffin, or an amount equivalent to purchase one.");
  writeText("a Funeral grant of ZMW 1,500.00 to cover funeral expenses and requirements.");
  writeText("The Employee shall provide reasonable proof of death from a recognised government institution or medical professional. Entitlement to Funeral Assistance shall only apply to legally married couples and biological children of the employee, and the employer must be shown details and proof of marriage/relation.");

  heading("17. COMPASSIONATE LEAVE");
  writeText("In the event of the death of the registered spouse or biological child below 18 years of age, of an employee, Twelve (12) calendar days compassionate leave shall be granted. Any extra days of compassionate leave shall be granted at management's discretion.");

  heading("18. TAXATION OF EMOLUMENTS");
  writeText("All emoluments under this contract, including pay, commuted leave pay or benefits in kind, will be subject to income tax and any other statutory deductions in accordance with prevailing legislation.");

  heading("19. EMPLOYEE OBLIGATIONS");
  writeText("The employee shall serve the employer honestly, faithfully and diligently and shall comply with all the rules and regulations of the employer. The Employee will at all times obey all reasonable orders and instructions given by management, and shall duly, honestly and faithfully account for and safeguard their tools, personal possessions and property of the company, at the place of work or during transfer from one location to another.");
  writeText("Furthermore:");
  writeText("The employee shall act respectfully and attentively in all interactions with customers and clients of the company. Abuse or use of disrespectful language towards customers shall be cause for Disciplinary Action or Summary Dismissal.");
  writeText("The employee shall act professionally and be attentive to all duties, at all times during working hours, which includes breaks and lunch times.");
  writeText("The employee shall faithfully observe all the rules and regulations laid down from time to time in order to uphold good conduct and discipline for the purpose of effective operations of the company.");
  writeText("The employee shall not use or operate a mobile telephone or smartphone while on duty, except in the case of being under the instruction or for communication with management.");
  writeText("The employee shall not provide any credit or free services to customers, except under explicit instruction from management. In case the employee provides credit or unpaid service to customers, he/she shall be held responsible for the full amount of the cost of the service and shall be given a written warning.");
  writeText("The employee shall always arrive and depart on time, as per their scheduled times of work, Failure to do so, shall lead to THREE (03) written warnings, followed by Summary Dismissal if the employee fails to comply..");
  writeText("The employee shall act with absolute honesty and integrity towards customers, fellow employees and management.");
  writeText("The employee shall not misuse, misdirect or misappropriate company property, equipment, resources or intellectual property for personal gain.");
  writeText("The employee may represent the company for contracting of goods and services or provide customer service only during the course of scheduled normal duties.");
  writeText("The employee shall not commence legal proceedings in any courts against the employer, or any of its agents, whilst in the employment of the Company.");
  writeText("The employee is obliged to provide periodic reports for management information.");
  writeText('The employee shall furnish true and factual information about themselves to the Employer. In the event it is discovered that the employee has withheld or misrepresented any material information, or made false or incorrect statements thereof, the contract shall be declared invalid and the company has the right to terminate the contract of employment at any time without notice.');
  writeText("The employee shall not issue any press statements or disclose matters of the company except with express consent of the Directors.");
  writeText("The employee shall not remove, or cause the removal or destruction, of any records, papers or documentation of the Company, which may relate to the Company's business, without the explicit written permission of the Company's directors.");
  writeText("The employee shall not, at any time, be under the influence of alcohol, narcotics or any other prohibited substance, while on duty or on the Company premises.");

  heading("20. OTHER EMPLOYMENT");
  writeText("Whilst in the company's employ the employee may NOT be employed by any other employer and may not engage in any other business without obtaining written permission from the Company. The employee may not consult, advise or provide any assistance to any competitor company working in the same or similar industry as the Company. The employee may not disclose or provide information or data of the Company operations to any competitor company, including financial or marketing data. Breach of this clause may lead to prosecution and legal action taken against the Employee.");

  heading("21. DEDUCTIONS");
  writeText("The employee hereby consents to the deduction and any other off-set against any other monies owed to the employer, or the value estimated of any goods or property of the employer, for which the employee shall be held accountable to the employer and for which he/she may have failed to account for.");

  heading("22. SUBSISTENCE ALLOWANCE");
  writeText("Where an employee spends a night away from home to attend to the business of the employer, the employee shall be paid a subsistence allowance of ZMW 200 (TWO HUNDRED) per night to cover expenses.");

  heading("23. ACCIDENT");
  writeText("All accidents must be reported to management immediately by the employee and any failure to do so by an employee will be regarded as gross indiscipline. Appropriate disciplinary action shall be taken.");

  heading("24. COMPENSATION FOR INJURY WHILE ON DUTY");
  writeText("If any employee sustains injury and suffers partial or permanent disability through an industrial accident, while on duty at the Company premises, the employee shall be compensated under the provisions of the Workers Compensation Fund. Employees and not entitled to compensation and such compensation does NOT apply if the employee was intoxicated, willfully or negligently not following basic safety procedures, or was performing criminal or illegal activity, or was involved in a fight or physical altercation with staff, clients, police or any other member of the public.");

  heading("25. MISCONDUCT OR BREACH OF CONTRACT");
  writeText("If the Employee commitS any breach of the provisions of this agreement, or shall be guilty of misconduct of any kind, during or outside the business hours, the Employer shall have the right to terminate this agreement and employment of the employee summarily, at any time thereafter. Upon such termination, the Terminal Benefits shall be calculated as Actual pay for Days Worked, up to the date of termination and any accrued paid leave days. The Employee shall be entitled to receive and be paid only the remuneration due up to the date of such termination.");

  heading("26. CHANGE OF PERSONAL DATA");
  writeText("The Employee shall inform the employer in writing of any change to personal circumstance within ONE (01) month. Failure to do so, shall mean that the information on record at that time shall be utilised and any amendments or adjustments shall be effected after one calendar month following notification.");

  heading("27. NONDISCLOSURE");
  writeText('(a) Employee understands that, in connection with its engagement with Company, it may receive, produce, or otherwise be exposed to Company\'s trade secrets, business, proprietary and/or technical information, including, without limitation, information concerning customer lists, customer support strategies, employees, research and development, financial information (including sales, costs, profits, and pricing methods), manufacturing, marketing, proprietary software, hardware, firmware, and related documentation, inventions (whether patentable or not), know-how, show-how, and other information considered to be confidential by Company, and all derivatives, improvements and enhancements to any of the above (including those derivatives, improvements and enhancements that were created or developed by Employee under this Agreement), in addition to all information Company receives from others under an obligation of confidentiality (individually and collectively "Confidential Information").');
  writeText("(b) Employee acknowledges that the Confidential Information is the Company's sole, exclusive and extremely valuable property. Accordingly, Employee agrees to segregate all Confidential Information from information of other companies and agrees not to reproduce any Confidential Information without Company's prior written consent, not to use the Confidential Information except in the performance of this Agreement, and not to divulge all or any part of the Confidential Information in any form to any third party, either during or after the term of this Agreement, except to Company employees who need to know such Confidential Information in order to perform their Services. Upon termination or expiration of this Agreement for any reason, Employee agrees to cease using and to return to Company all whole and partial copies and derivatives of the Confidential Information, whether in Employee's possession or under Employee's direct or indirect control, including any computer access nodes and/or codes, and to arrange for the return of such materials by all Employees.");

  heading("28. DELIVERY OF CORRESPONDENCE");
  writeText("The Employee shall deliver by hand all correspondence under this agreement to management and the employer shall deliver by hand to the employee within his/her department. Failure to deliver due to absence or any other reason, the correspondence will be posted by courier and/or sent via email and by electronic communication to the employee's last known residential address, email address and telephone numbers by electronic communication.");

  heading("29. DEATH BENEFITS");
  writeText("In case of death of the employee, whilst in the service of the Company, the employer shall pay accrued benefits to the beneficiary, as per letters of administration issued by the courts.");

  heading("30. REDUNDANCY/TERMINATION");
  writeText("Where an employee's contract of service is terminated by reason of redundancy or other reasons, the employee shall be entitled to at least one month's notice and redundancy benefits of ONE (01) months pay..");

  heading("31. RIGHT TO SECURITY SCREENINGS");
  writeText("The Employee agrees to the Company having the right search the employee or his/her property, if there is reasonable cause to do so, including viewing of personal correspondence on mobile phones, on entering, leaving and within the Company premises. If an employee is found to be in breach of Company rules, or local laws, as a result of the search, the Company has the right to retain any items or devices which may be used as evidence against the employee, and/or said items may be given over to the Police.");

  heading("32. LEGAL ACTION");
  writeText("If at any time an employee should instigate legal action, for any reason, against the employer, the employee shall immediately resign. Failure to do so will give the employer the right to terminate the agreement.");

  heading("33. VALIDATION OF CONTRACT");
  writeText("The contract shall only be deemed as valid and binding, when signed by both Parties.");

  heading("34. DISCIPLINARY ACTION");
  writeText("The Company may at any time commence disciplinary action against the Employee, if the Employee does not carry out their obligations or due to gross misconduct, and may set any appropriate punishment as deemed necessary, including verbal and written warnings, fines, unpaid suspension from work and demotion to any position that the Company considers suitable, notwithstanding the terms of their position as outlined in this contract.");
  writeText("In case the employee is demotion to another position, the current contract shall terminate and a new contract shall be signed between the Parties. The Employee has a right to appeal within 15 days of the decision.");
  writeText("Gross misconduct includes, but is not limited to, the following offences:");
  const offences = ["a. Willfully refusing to carry out an instruction given by management, local manager, supervisor, or an appointed representative of company management.","b. Refusing to follow company guidelines.","c. Physically or verbally abusing, acting in a threatening manner towards any member of staff or management. This includes using insulting or threatening language, making fun of a fellow member of staff for any reasons race, religion, tribe, or sex.","d. Theft, fraud or lying to management about performance, financial figures or any other issues.","e. Frequent (more than 3) absence without authorisation from appointed working location or station.","f. Making bets on the Company system or playing games, whether paid for or unpaid, including via 3rd parties, persons, or systems.","g. Repeated financial shortages or unauthorised removal of money from the cash desk.","h. Being under the influence of alcohol, drugs or illegal substances during working hours.","i. Using personal phones or devices without authorisation from management during working times (except during break times).","j. Conducting work for other businesses (either personal or for a 2nd job) during working hours.","k. Working or communicating in any way with competitor betting or casino companies, including providing information regarding company activities or financial data."];
  offences.forEach(o => writeText(o));

  heading("35. ACCEPTANCE OF THE TERMS AND CONDITIONS OF SERVICE");
  writeText("These terms and conditions of employment supersede any earlier agreements made between the Parties, either in oral or written form. If these terms and conditions are acceptable to you, please sign in the spaces provided below to signify your unconditional acceptance.");
  y += 3;
  writeText("IN WITNESS WHEREOF, the parties hereto have executed this Agreement.", { bold: true, align: "center" });

  // === SIGNATURE SECTION ===
  checkPage(60);
  y += 5;
  doc.setDrawColor(0); doc.setLineWidth(0.5); doc.line(m, y, w - m, y); y += 8;

  const colL = m;
  const colR = w / 2 + 5;

  bold(9); doc.text("COMPANY:", colL, y); doc.text("EMPLOYEE:", colR, y); y += 8;

  // Company side
  normal(9);
  doc.text("Silverspring Entertainment Limited", colL, y);
  doc.text('Trading as "Bwana Bet"', colL, y + 5);

  // Employee side - signature
  if (data.signature_data) {
    try { doc.addImage(data.signature_data, "PNG", colR, y - 5, 50, 20); } catch {}
  }
  y += 18;

  normal(8);
  doc.text("SIGNED: ____________________________", colL, y);
  bold(8); doc.text(`SIGNED: ${data.signed_name || data.employee_name}`, colR, y); y += 6;
  normal(8); doc.text("(On behalf of the Employer)", colL, y); doc.text("(Employee)", colR, y); y += 8;
  doc.text("NAME: ____________________________", colL, y); bold(8); doc.text(`NAME: ${data.signed_name || data.employee_name}`, colR, y); y += 6;
  normal(8); doc.text("TITLE: _____________________________", colL, y); doc.text(`TITLE: ${fmtPos(data.position)}`, colR, y); y += 6;
  doc.text("DATE: _____________________________", colL, y);
  doc.text(`DATE: ${data.signed_at ? new Date(data.signed_at).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }) : "_______________"}`, colR, y);

  return doc;
}
