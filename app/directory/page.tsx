import { getEmployeeContacts } from "@/lib/data";
import { getCurrentUser } from "@/lib/auth";
import { supabase } from "@/lib/supabase";
import { redirect } from "next/navigation";
import StaffDirectory from "./StaffDirectory";

export const revalidate = 60;

export default async function DirectoryPage() {
  const { role } = await getCurrentUser();

  if (!role) {
    redirect("/login");
  }

  const contacts = await getEmployeeContacts(null);

  // Get branch names
  const { data: branches } = await supabase.from("branches").select("id, name");
  const branchMap: Record<string, string> = {};
  (branches || []).forEach((b: any) => { branchMap[b.id] = b.name; });

  // Get employee branch assignments
  const { data: employees } = await supabase
    .from("employees")
    .select("id, branch_id, position, employment_status")
    .eq("employment_status", "active");

  const empBranchMap: Record<string, string> = {};
  const empPosMap: Record<string, string> = {};
  (employees || []).forEach((e: any) => {
    empBranchMap[e.id] = branchMap[e.branch_id] || "Unknown";
    empPosMap[e.id] = e.position || "unknown";
  });

  // Attach branch name and position to contacts
  let enriched = contacts.map((c) => ({
    ...c,
    branch_name: empBranchMap[c.employee_id] || "Unknown",
    position: empPosMap[c.employee_id] || "unknown",
  }));

  // Filter by branch for non-super-admins
  if (!role.is_super_admin && role.branch_ids && role.branch_ids.length > 0) {
    const allowedBranchNames = role.branch_ids.map((id: string) => branchMap[id]).filter(Boolean);
    enriched = enriched.filter((c) => allowedBranchNames.includes(c.branch_name));
  }

  // Get unique branch names for filtering
  const branchNames = Array.from(new Set(enriched.map((c) => c.branch_name))).sort();

  return (
    <StaffDirectory contacts={enriched} branchNames={branchNames} />
  );
}
