import { getEmployeeContacts } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import StaffDirectory from "./StaffDirectory";

export const revalidate = 60;

export default async function DirectoryPage() {
  const { role } = await getCurrentUser();
  const branchFilter = role?.is_super_admin ? null : role?.branch_ids || [];

  const contacts = await getEmployeeContacts(branchFilter);

  // Get branch names
  const { data: branches } = await supabase.from("branches").select("id, name");
  const branchMap: Record<string, string> = {};
  (branches || []).forEach((b: any) => { branchMap[b.id] = b.name; });

  // Get employee branch assignments
  let empQuery = supabase
    .from("employees")
    .select("id, branch_id, position, employment_status")
    .eq("employment_status", "active");

  if (branchFilter && branchFilter.length > 0) {
    empQuery = empQuery.in("branch_id", branchFilter);
  }

  const { data: employees } = await empQuery;
  const empBranchMap: Record<string, string> = {};
  const empPosMap: Record<string, string> = {};
  (employees || []).forEach((e: any) => {
    empBranchMap[e.id] = branchMap[e.branch_id] || "Unknown";
    empPosMap[e.id] = e.position || "unknown";
  });

  // Attach branch name and position to contacts
  const enriched = contacts.map((c) => ({
    ...c,
    branch_name: empBranchMap[c.employee_id] || "Unknown",
    position: empPosMap[c.employee_id] || "unknown",
  }));

  // Get unique branch names for filtering
  const branchNames = Array.from(new Set(enriched.map((c) => c.branch_name))).sort();

  return (
    <StaffDirectory contacts={enriched} branchNames={branchNames} />
  );
}
