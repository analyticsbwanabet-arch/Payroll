"use client";

import { useState } from "react";
import type { PayrollRecord } from "@/lib/helpers";
import { fmt, posLabel, shortBranch } from "@/lib/helpers";

const PIE_COLORS = ["#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#06b6d4", "#ef4444"];

function badge(position: string) {
  const cls =
    position === "manager" || position === "assistant_manager"
      ? "badge-manager"
      : position === "it_technician"
      ? "badge-it"
      : position === "security"
      ? "badge-security"
      : "badge-default";
  return <span className={`badge ${cls}`}>{posLabel[position] || position}</span>;
}

const columns = [
  { key: "full_name", label: "Employee", align: "left" as const },
  { key: "branch_name", label: "Branch", align: "left" as const },
  { key: "position", label: "Role", align: "left" as const },
  { key: "gross_salary", label: "Gross", align: "right" as const },
  { key: "napsa_employee", label: "NAPSA", align: "right" as const },
  { key: "nhima_employee", label: "NHIMA", align: "right" as const },
  { key: "extra_shifts_count", label: "Shifts+", align: "right" as const },
  { key: "shortage_amount", label: "Short.", align: "right" as const },
  { key: "advances", label: "Adv.", align: "right" as const },
  { key: "net_salary_due", label: "Net Pay", align: "right" as const },
];

export default function EmployeeTable({
  records,
  branchNames,
  initialBranch,
}: {
  records: PayrollRecord[];
  branchNames: { name: string; count: number }[];
  initialBranch: string | null;
}) {
  const [branch, setBranch] = useState<string | null>(initialBranch);
  const [search, setSearch] = useState("");
  const [sortCol, setSortCol] = useState("full_name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
  };

  const filtered = records
    .filter((e) => !branch || e.branch_name === branch)
    .filter(
      (e) =>
        !search ||
        e.full_name.toLowerCase().includes(search.toLowerCase()) ||
        e.position.toLowerCase().includes(search.toLowerCase())
    )
    .sort((a: any, b: any) => {
      const av = a[sortCol], bv = b[sortCol];
      const cmp = typeof av === "string" ? (av || "").localeCompare(bv || "") : (+av || 0) - (+bv || 0);
      return sortDir === "asc" ? cmp : -cmp;
    });

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex justify-between items-start flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold">
            {branch ? branch : "All Employees"} — {filtered.length} staff
          </h1>
          <p className="text-[13px] text-[--text-muted] mt-1">
            January 2026 payroll • Click headers to sort
          </p>
        </div>
        <div className="flex gap-2 items-center">
          <input
            type="text"
            placeholder="Search name or role..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="px-3.5 py-2 border border-[--border] rounded-lg bg-[--card] text-[--text] text-[13px] w-52 outline-none focus:border-[--accent] transition-colors"
          />
          {branch && (
            <button onClick={() => setBranch(null)} className="chip">
              ✕ Clear
            </button>
          )}
        </div>
      </div>

      {/* Branch filter chips */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setBranch(null)}
          className={`chip ${!branch ? "chip-active" : ""}`}
        >
          All ({records.length})
        </button>
        {branchNames.map((b, i) => (
          <button
            key={b.name}
            onClick={() => setBranch(b.name)}
            className="chip"
            style={
              branch === b.name
                ? {
                    borderColor: PIE_COLORS[i % PIE_COLORS.length],
                    background: PIE_COLORS[i % PIE_COLORS.length] + "22",
                    color: PIE_COLORS[i % PIE_COLORS.length],
                  }
                : undefined
            }
          >
            {shortBranch(b.name)} ({b.count})
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="chart-card overflow-x-auto">
        <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
          <thead>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold border-b border-[--border] cursor-pointer select-none whitespace-nowrap"
                  style={{
                    textAlign: col.align,
                    color: sortCol === col.key ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  {col.label}
                  {sortCol === col.key ? (sortDir === "asc" ? " ↑" : " ↓") : ""}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.map((emp, i) => (
              <tr key={i} className="row-hover transition-colors">
                <td className="px-3 py-3 font-semibold text-[13px] whitespace-nowrap text-[--text]">
                  {emp.full_name}
                </td>
                <td className="px-3 py-3 text-[12px] text-[--text-dim]">
                  {shortBranch(emp.branch_name)}
                </td>
                <td className="px-3 py-3">{badge(emp.position)}</td>
                <td className="px-3 py-3 text-right font-mono text-[12px] text-[--text]">
                  {fmt(emp.gross_salary)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-[12px] text-[--text-dim]">
                  {fmt(emp.napsa_employee)}
                </td>
                <td className="px-3 py-3 text-right font-mono text-[12px] text-[--text-dim]">
                  {fmt(emp.nhima_employee)}
                </td>
                <td
                  className="px-3 py-3 text-right text-[12px]"
                  style={{ color: emp.extra_shifts_count > 0 ? "var(--cyan)" : "var(--text-muted)" }}
                >
                  {emp.extra_shifts_count > 0 ? emp.extra_shifts_count : "—"}
                </td>
                <td
                  className="px-3 py-3 text-right font-mono text-[12px]"
                  style={{ color: emp.shortage_amount > 0 ? "var(--red)" : "var(--text-muted)" }}
                >
                  {emp.shortage_amount > 0 ? fmt(emp.shortage_amount) : "—"}
                </td>
                <td
                  className="px-3 py-3 text-right font-mono text-[12px]"
                  style={{ color: emp.advances > 0 ? "var(--accent)" : "var(--text-muted)" }}
                >
                  {emp.advances > 0 ? fmt(emp.advances) : "—"}
                </td>
                <td className="px-3 py-3 text-right font-mono text-[12px] font-bold text-[--green]">
                  {fmt(emp.net_salary_due)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-10 text-[--text-muted]">No employees match your filters</div>
        )}
      </div>
    </div>
  );
}
