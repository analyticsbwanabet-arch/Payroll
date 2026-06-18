"use client";

import { useState, useEffect } from "react";
import { supabase, useAuth } from "@/lib/auth-context";
import PayrollGenerator from "./PayrollGenerator";

interface Period {
  id: string;
  period_name: string;
  start_date: string;
  end_date: string;
  is_finalized: boolean;
}

export default function PayrollPage() {
  const { isSuperAdmin, loading: authLoading } = useAuth();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    const fetchPeriods = async () => {
      const { data } = await supabase
        .from("payroll_periods")
        .select("id, period_name, start_date, end_date, is_finalized")
        .order("start_date", { ascending: false });
      setPeriods(data || []);
      setLoading(false);
    };
    fetchPeriods();
  }, [authLoading]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-3xl animate-pulse">💰</div>
      </div>
    );
  }

  return <PayrollGenerator periods={periods} reviewOnly={!isSuperAdmin} />;
}
