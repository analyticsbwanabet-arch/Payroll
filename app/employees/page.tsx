import { getPayrollData } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import EmployeeTable from "./EmployeeTable";

export const revalidate = 60;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { branch?: string };
}) {
  const { role } = await getCurrentUser();
  const branchFilter = role?.is_super_admin ? null : role?.branch_ids || [];
  const records = await getPayrollData("January 2026", branchFilter);

  const branchNames = Object.entries(
    records.reduce<Record<string, number>>((acc, r) => {
      acc[r.branch_name] = (acc[r.branch_name] || 0) + 1;
      return acc;
    }, {})
  )
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <EmployeeTable
      records={records}
      branchNames={branchNames}
      initialBranch={searchParams.branch || null}
    />
  );
}
