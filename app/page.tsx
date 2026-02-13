import { getPayrollData } from "@/lib/data";
import { buildBranchSummary, sumTotals, fmt } from "@/lib/helpers";
import StatCard from "@/components/StatCard";
import { NetPayChart, DistributionChart, DeductionsChart } from "@/components/Charts";

export const revalidate = 60;

export default async function OverviewPage() {
  const records = await getPayrollData();
  const branches = buildBranchSummary(records);
  const totals = sumTotals(branches);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon="👥" label="Total Staff" value={totals.employees} sub={`${branches.length} branches`} color="#16a34a" />
        <StatCard icon="💰" label="Gross Payroll" value={fmt(totals.gross)} sub="Monthly total" color="#eab308" />
        <StatCard icon="✅" label="Net Payout" value={fmt(totals.net)} sub="After deductions" color="#22c55e" />
        <StatCard icon="🏛" label="NAPSA + NHIMA" value={fmt(totals.napsa + totals.nhima)} sub="Statutory" color="#f59e0b" />
        <StatCard icon="⚠️" label="Shortages" value={fmt(totals.shortages)} sub="Cash shortages" color="#ef4444" />
        <StatCard icon="💳" label="Advances" value={fmt(totals.advances)} sub="Staff advances" color="#06b6d4" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NetPayChart data={branches} />
        <DistributionChart data={branches} />
      </div>

      <DeductionsChart data={branches} />
    </div>
  );
}
