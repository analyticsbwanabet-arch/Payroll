export const fmt = (n: number | string | null) =>
  `K${Number(n || 0).toLocaleString("en", { maximumFractionDigits: 0 })}`;

export const fmtDec = (n: number | string | null) =>
  `K${Number(n || 0).toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const posLabel: Record<string, string> = {
  manager: "Manager",
  assistant_manager: "Asst Manager",
  cashier: "Cashier",
  it_technician: "IT Tech",
  security: "Security",
  cleaner: "Cleaner",
  biker: "Biker",
  call_center_agent: "Agent",
};

export const shortBranch = (s: string) =>
  s.replace(" Shop", "").replace(" UB Market", "");

export interface PayrollRecord {
  full_name: string;
  branch_name: string;
  position: string;
  gross_salary: number;
  net_salary_due: number;
  napsa_employee: number;
  nhima_employee: number;
  paye_tax: number;
  extra_shifts_count: number;
  extra_shift_total: number;
  bonus: number;
  shortage_amount: number;
  advances: number;
  fines: number;
  absent_days: number;
  absence_deduction: number;
  comments: string | null;
}

export interface EmployeeContact {
  employee_id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  mobile_money_number: string | null;
  home_address: string | null;
  nrc_number: string | null;
  tpin: string | null;
  bank_name: string | null;
  bank_account_number: string | null;
  social_security_number: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  date_started: string | null;
}

export interface BranchSummary {
  branch: string;
  employees: number;
  gross: number;
  net: number;
  napsa: number;
  nhima: number;
  paye: number;
  shortages: number;
  advances: number;
  fines: number;
  extraShifts: number;
}

export function buildBranchSummary(records: PayrollRecord[]): BranchSummary[] {
  const map: Record<string, BranchSummary> = {};
  records.forEach((r) => {
    const bn = r.branch_name;
    if (!map[bn])
      map[bn] = { branch: bn, employees: 0, gross: 0, net: 0, napsa: 0, nhima: 0, paye: 0, shortages: 0, advances: 0, fines: 0, extraShifts: 0 };
    const s = map[bn];
    s.employees++;
    s.gross += +r.gross_salary;
    s.net += +r.net_salary_due;
    s.napsa += +r.napsa_employee;
    s.nhima += +r.nhima_employee;
    s.paye += +r.paye_tax;
    s.shortages += +r.shortage_amount;
    s.advances += +r.advances;
    s.fines += +r.fines;
    s.extraShifts += +r.extra_shift_total;
  });
  return Object.values(map).sort((a, b) => b.employees - a.employees);
}

export function sumTotals(branches: BranchSummary[]) {
  return branches.reduce(
    (a, b) => ({
      employees: a.employees + b.employees,
      gross: a.gross + b.gross,
      net: a.net + b.net,
      napsa: a.napsa + b.napsa,
      nhima: a.nhima + b.nhima,
      shortages: a.shortages + b.shortages,
      advances: a.advances + b.advances,
      fines: a.fines + b.fines,
      extraShifts: a.extraShifts + b.extraShifts,
    }),
    { employees: 0, gross: 0, net: 0, napsa: 0, nhima: 0, shortages: 0, advances: 0, fines: 0, extraShifts: 0 }
  );
}
