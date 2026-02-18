import { createClient } from "@/lib/supabase/server";

export interface UserRole {
  email: string;
  display_name: string;
  role: "super_admin" | "branch_manager";
  branch_ids: string[];
  is_super_admin: boolean;
}

export async function getCurrentUser(): Promise<{ user: any; role: UserRole | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) return { user: null, role: null };

  // Look up role by email
  const { data: roleData } = await supabase
    .from("user_roles")
    .select("*")
    .eq("email", user.email)
    .eq("is_active", true)
    .single();

  if (!roleData) return { user, role: null };

  return {
    user,
    role: {
      email: roleData.email,
      display_name: roleData.display_name,
      role: roleData.role,
      branch_ids: roleData.branch_ids || [],
      is_super_admin: roleData.role === "super_admin",
    },
  };
}
