import { getPayrollData } from "@/lib/data";
import { buildBranchSummary, sumTotals, fmt } from "@/lib/helpers";
import StatCard from "@/components/StatCard";
import { NetPayChart, DistributionChart, DeductionsChart } from "@/components/Charts";

export const revalidate = 60; // refresh data every 60 seconds

export default async function OverviewPage() {
  const records = await getPayrollData();
  const branches = buildBranchSummary(records);
  const totals = sumTotals(branches);

  return (
    <div className="flex flex-col gap-5">
      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon="👥" label="Total Staff" value={totals.employees} sub={`${branches.length} branches`} color="var(--blue)" />
        <StatCard icon="💰" label="Gross Payroll" value={fmt(totals.gross)} sub="Monthly total" color="var(--accent)" />
        <StatCard icon="✅" label="Net Payout" value={fmt(totals.net)} sub="After deductions" color="var(--green)" />
        <StatCard icon="🏛" label="NAPSA + NHIMA" value={fmt(totals.napsa + totals.nhima)} sub="Statutory" color="var(--purple)" />
        <StatCard icon="⚠️" label="Shortages" value={fmt(totals.shortages)} sub="Cash shortages" color="var(--red)" />
        <StatCard icon="💳" label="Advances" value={fmt(totals.advances)} sub="Staff advances" color="var(--cyan)" />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NetPayChart data={branches} />
        <DistributionChart data={branches} />
      </div>

      {/* Deductions Chart */}
      <DeductionsChart data={branches} />
    </div>
  );
}
