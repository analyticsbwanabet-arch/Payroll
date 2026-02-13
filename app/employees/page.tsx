import { getPayrollData } from "@/lib/data";
import { buildBranchSummary } from "@/lib/helpers";
import EmployeeTable from "./EmployeeTable";

export const revalidate = 60;

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: { branch?: string };
}) {
  const records = await getPayrollData();
  const branches = buildBranchSummary(records);
  const branchNames = branches.map((b) => ({ name: b.branch, count: b.employees }));

  return (
    <EmployeeTable
      records={records}
      branchNames={branchNames}
      initialBranch={searchParams.branch || null}
    />
  );
}
