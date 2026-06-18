"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase, useAuth } from "@/lib/auth-context";
import StatCard from "@/components/StatCard";
import { NetPayChart, DistributionChart, DeductionsChart } from "@/components/Charts";

function fmt(n: number) { return "K" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

interface Period { id: string; period_name: string; }
interface BranchSummary {
  branch: string; employees: number; gross: number; net: number;
  napsa: number; nhima: number; paye: number; shortages: number; advances: number; fines: number; extraShifts: number;
}

export default function OverviewPage() {
  const { isSuperAdmin, allowedBranchIds, loading: authLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !isSuperAdmin) {
      router.replace("/employees");
    }
  }, [authLoading, isSuperAdmin, router]);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState("");
  const [allBranches, setAllBranches] = useState<BranchSummary[]>([]);
  const [filterBranch, setFilterBranch] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadPeriods = async () => {
      const { data } = await supabase.from("payroll_periods").select("id, period_name").order("start_date", { ascending: false });
      const list = data || [];
      setPeriods(list);
      if (list.length > 0) setSelectedPeriod(list[0].id);
    };
    loadPeriods();
  }, []);

  const loadData = useCallback(async () => {
    if (!selectedPeriod || authLoading) return;
    setLoading(true);

    const { data: records } = await supabase
      .from("payroll_records")
      .select("employee_id, branch_id, gross_salary, net_salary_due, napsa_employee, nhima_employee, paye_tax, extra_shift_total, shortage_amount, advances, fines")
      .eq("payroll_period_id", selectedPeriod);

    if (!records || records.length === 0) { setAllBranches([]); setLoading(false); return; }

    const empIds = Array.from(new Set(records.map((r: any) => r.employee_id)));
    let employees: any[] = [];
    for (let i = 0; i < empIds.length; i += 40) {
      const { data } = await supabase.from("employees").select("id, employment_status, branch_id").in("id", empIds.slice(i, i + 40));
      if (data) employees = employees.concat(data);
    }
    const empMap: Record<string, any> = {};
    employees.forEach(e => empMap[e.id] = e);

    const { data: branchData } = await supabase.from("branches").select("id, name");
    const branchMap: Record<string, string> = {};
    (branchData || []).forEach((b: any) => branchMap[b.id] = b.name);

    const agg: Record<string, BranchSummary> = {};
    records.forEach((r: any) => {
      const emp = empMap[r.employee_id];
      if (!emp || emp.employment_status !== "active") return;
      const bid = emp.branch_id;
      if (!isSuperAdmin && allowedBranchIds && allowedBranchIds.length > 0) {
        if (!allowedBranchIds.includes(bid)) return;
      }
      const bn = branchMap[bid] || "Unknown";
      if (!agg[bn]) agg[bn] = { branch: bn, employees: 0, gross: 0, net: 0, napsa: 0, nhima: 0, paye: 0, shortages: 0, advances: 0, fines: 0, extraShifts: 0 };
      const s = agg[bn];
      s.employees++;
      s.gross += +(r.gross_salary || 0);
      s.net += +(r.net_salary_due || 0);
      s.napsa += +(r.napsa_employee || 0);
      s.nhima += +(r.nhima_employee || 0);
      s.paye += +(r.paye_tax || 0);
      s.shortages += +(r.shortage_amount || 0);
      s.advances += +(r.advances || 0);
      s.fines += +(r.fines || 0);
      s.extraShifts += +(r.extra_shift_total || 0);
    });

    setAllBranches(Object.values(agg).sort((a, b) => a.branch.localeCompare(b.branch)));
    setFilterBranch("all");
    setLoading(false);
  }, [selectedPeriod, authLoading, isSuperAdmin, allowedBranchIds]);

  useEffect(() => { loadData(); }, [loadData]);

  const branches = filterBranch === "all" ? allBranches : allBranches.filter(b => b.branch === filterBranch);

  const totals = branches.reduce((t, b) => ({
    employees: t.employees + b.employees, gross: t.gross + b.gross, net: t.net + b.net,
    napsa: t.napsa + b.napsa, nhima: t.nhima + b.nhima, paye: t.paye + b.paye,
    shortages: t.shortages + b.shortages, advances: t.advances + b.advances,
    fines: t.fines + b.fines, extraShifts: t.extraShifts + b.extraShifts,
  }), { employees: 0, gross: 0, net: 0, napsa: 0, nhima: 0, paye: 0, shortages: 0, advances: 0, fines: 0, extraShifts: 0 });

  const periodName = periods.find(p => p.id === selectedPeriod)?.period_name || "";

  if (authLoading) {
    return <div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">📊</div></div>;
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          {!isSuperAdmin && allBranches.length > 0 && (
            <div className="px-4 py-2 rounded-lg text-[12px] mb-3" style={{ background: "#22c55e15", border: "1px solid #22c55e30", color: "#4ade80" }}>
              🏢 Viewing: {allBranches.map(b => b.branch).join(", ")}
            </div>
          )}
        </div>
        <div className="flex gap-3 flex-wrap">
          {allBranches.length > 1 && (
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Branch</label>
              <select value={filterBranch} onChange={(e) => setFilterBranch(e.target.value)}
                className="px-4 py-2.5 rounded-lg text-[13px] min-w-[200px] outline-none"
                style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="all">All Branches ({allBranches.length})</option>
                {allBranches.map(b => <option key={b.branch} value={b.branch}>{b.branch}</option>)}
              </select>
            </div>
          )}
          <div>
            <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Payroll Period</label>
            <select value={selectedPeriod} onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2.5 rounded-lg text-[13px] min-w-[200px] outline-none"
              style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
              {periods.map(p => <option key={p.id} value={p.id}>{p.period_name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12"><div className="text-2xl animate-pulse">Loading...</div></div>
      ) : (
        <>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            <StatCard icon="👥" label="Active Staff" value={totals.employees} sub={filterBranch === "all" ? `${branches.length} branches` : filterBranch} color="#22c55e" />
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
        </>
      )}
    </div>
  );
}
