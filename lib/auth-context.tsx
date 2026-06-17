"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";

// Re-export supabase for client components that need it
const supabaseClient = createClient();
export const supabase = supabaseClient;

interface AuthState {
  allowedBranchIds: string[] | null; // null = super admin (all branches)
  isSuperAdmin: boolean;
  isOwner: boolean;
  readOnly: boolean;
  displayName: string;
  logName: string;
  email: string;
  loading: boolean;
}

const AuthContext = createContext<AuthState>({
  allowedBranchIds: null,
  isSuperAdmin: false,
  isOwner: false,
  readOnly: false,
  displayName: "",
  logName: "",
  email: "",
  loading: true,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children, initialRole }: {
  children: ReactNode;
  initialRole?: {
    email: string;
    display_name: string;
    role: string;
    branch_ids: string[];
    is_super_admin: boolean;
    is_owner: boolean;
    read_only: boolean;
    log_name: string;
  } | null;
}) {
  const [authState, setAuthState] = useState<AuthState>({
    allowedBranchIds: initialRole?.is_super_admin ? null : (initialRole?.branch_ids || []),
    isSuperAdmin: initialRole?.is_super_admin || false,
    isOwner: initialRole?.is_owner || false,
    readOnly: initialRole?.read_only || false,
    displayName: initialRole?.display_name || "",
    logName: initialRole?.log_name || initialRole?.display_name || "",
    email: initialRole?.email || "",
    loading: !initialRole,
  });

  useEffect(() => {
    // If we already have the role from the server, no need to fetch
    if (initialRole) return;

    async function fetchRole() {
      const { data: { user } } = await supabaseClient.auth.getUser();
      if (!user?.email) {
        setAuthState(prev => ({ ...prev, loading: false }));
        return;
      }

      const { data: roleData } = await supabaseClient
        .from("user_roles")
        .select("*")
        .eq("email", user.email)
        .eq("is_active", true)
        .single();

      if (roleData) {
        setAuthState({
          allowedBranchIds: roleData.role === "super_admin" ? null : (roleData.branch_ids || []),
          isSuperAdmin: roleData.role === "super_admin",
          isOwner: roleData.is_owner || false,
          readOnly: roleData.read_only || false,
          displayName: roleData.display_name,
          logName: roleData.log_name || roleData.display_name,
          email: roleData.email,
          loading: false,
        });
      } else {
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    }

    fetchRole();
  }, [initialRole]);

  return (
    <AuthContext.Provider value={authState}>
      {children}
    </AuthContext.Provider>
  );
}
