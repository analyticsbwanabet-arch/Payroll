import Link from "next/link";
import { getPayrollData } from "@/lib/data";
import { buildBranchSummary, sumTotals, fmt } from "@/lib/helpers";

export const revalidate = 60;

const COLORS = ["#16a34a", "#eab308", "#22c55e", "#f59e0b", "#06b6d4", "#8b5cf6"];

export default async function BranchesPage() {
  const records = await getPayrollData();
  const branches = buildBranchSummary(records);
  const totals = sumTotals(branches);

  const headers = ["Branch", "Staff", "Gross Pay", "Extra Shifts", "NAPSA+NHIMA", "Shortages", "Advances", "Fines", "Net Pay"];

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#eab308" }}>Branch Payroll Summary</h1>
        <p className="text-[13px] mt-1" style={{ color: "#4a6e4a" }}>January 2026 — Click a row to view that branch&apos;s employees</p>
      </div>

      <div className="chart-card overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 3px" }}>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h} className="px-4 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b"
                  style={{ textAlign: h === "Branch" ? "left" : "right", color: "#4a6e4a", borderColor: "#1a2e1a" }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {branches.map((row, i) => (
              <tr key={i} className="row-hover cursor-pointer transition-colors">
                <td className="px-4 py-3.5 font-semibold" style={{ color: "#e8f5e8" }}>
                  <Link href={`/employees?branch=${encodeURIComponent(row.branch)}`} className="flex items-center gap-2.5">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                    {row.branch}
                  </Link>
                </td>
                <Cell value={row.employees} bold />
                <Cell value={fmt(row.gross)} />
                <Cell value={row.extraShifts > 0 ? fmt(row.extraShifts) : "—"} color={row.extraShifts > 0 ? "#06b6d4" : undefined} />
                <Cell value={fmt(row.napsa + row.nhima)} color="#eab308" />
                <Cell value={row.shortages > 0 ? fmt(row.shortages) : "—"} color={row.shortages > 0 ? "#ef4444" : undefined} />
                <Cell value={row.advances > 0 ? fmt(row.advances) : "—"} color={row.advances > 0 ? "#f59e0b" : undefined} />
                <Cell value={row.fines > 0 ? fmt(row.fines) : "—"} color={row.fines > 0 ? "#ef4444" : undefined} />
                <Cell value={fmt(row.net)} color="#16a34a" bold />
              </tr>
            ))}
            <tr style={{ borderTop: "2px solid #16a34a" }}>
              <td className="px-4 py-3.5 font-bold" style={{ color: "#16a34a" }}>TOTAL</td>
              <TotalCell value={totals.employees} />
              <TotalCell value={fmt(totals.gross)} />
              <TotalCell value={fmt(totals.extraShifts)} />
              <TotalCell value={fmt(totals.napsa + totals.nhima)} />
              <TotalCell value={fmt(totals.shortages)} />
              <TotalCell value={fmt(totals.advances)} />
              <TotalCell value={fmt(totals.fines)} />
              <TotalCell value={fmt(totals.net)} />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Cell({ value, color, bold }: { value: string | number; color?: string; bold?: boolean }) {
  return (
    <td className="px-4 py-3.5 text-right font-mono text-[12px]"
      style={{ color: color || (value === "—" ? "#4a6e4a" : "#e8f5e8"), fontWeight: bold ? 700 : 400 }}>
      {value}
    </td>
  );
}

function TotalCell({ value }: { value: string | number }) {
  return (
    <td className="px-4 py-3.5 text-right font-mono text-[12px] font-bold" style={{ color: "#16a34a" }}>{value}</td>
  );
}
