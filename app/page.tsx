import { getPayrollData } from "@/lib/data";
import { buildBranchSummary, sumTotals, fmt } from "@/lib/helpers";
import { getCurrentUser } from "@/lib/auth";
import StatCard from "@/components/StatCard";
import { NetPayChart, DistributionChart, DeductionsChart } from "@/components/Charts";

export const revalidate = 60;

export default async function OverviewPage() {
  const { role } = await getCurrentUser();
  const branchFilter = role?.is_super_admin ? null : role?.branch_ids || [];
  const records = await getPayrollData("January 2026", branchFilter);
  const branches = buildBranchSummary(records);
  const totals = sumTotals(branches);

  return (
    <div className="flex flex-col gap-5">
      {!role?.is_super_admin && (
        <div className="px-4 py-2 rounded-lg text-[12px]" style={{ background: "#22c55e15", border: "1px solid #22c55e30", color: "#4ade80" }}>
          🏢 Viewing: {branches.map(b => b.branch).join(", ") || "your branches"}
        </div>
      )}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon="👥" label="Total Staff" value={totals.employees} sub={`${branches.length} branches`} color="#22c55e" />
        <StatCard icon="💰" label="Gross Payroll" value={fmt(totals.gross)} sub="Monthly total" color="#facc15" />
        <StatCard icon="✅" label="Net Payout" value={fmt(totals.net)} sub="After deductions" color="#4ade80" />
        <StatCard icon="🏛" label="NAPSA + NHIMA" value={fmt(totals.napsa + totals.nhima)} sub="Statutory" color="#fbbf24" />
        <StatCard icon="⚠️" label="Shortages" value={fmt(totals.shortages)} sub="Cash shortages" color="#f87171" />
        <StatCard icon="💳" label="Advances" value={fmt(totals.advances)} sub="Staff advances" color="#22d3ee" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NetPayChart data={branches} />
        <DistributionChart data={branches} />
      </div>
      <DeductionsChart data={branches} />
    </div>
  );
}
