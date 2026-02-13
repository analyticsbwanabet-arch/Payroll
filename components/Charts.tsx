"use client";

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import type { BranchSummary } from "@/lib/helpers";
import { shortBranch, fmt } from "@/lib/helpers";

const PIE_COLORS = ["#16a34a", "#eab308", "#22c55e", "#f59e0b", "#06b6d4", "#8b5cf6"];
const tooltipStyle = {
  background: "#0a1a0a", border: "1px solid #1a2e1a", borderRadius: 8, fontSize: 12, color: "#e8f5e8",
};

export function NetPayChart({ data }: { data: BranchSummary[] }) {
  const chartData = data.map((b) => ({ name: shortBranch(b.branch), net: Math.round(b.net) }));
  return (
    <div className="chart-card">
      <div className="text-[13px] font-semibold mb-4" style={{ color: "#86a886" }}>Net Pay by Branch</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2e1a" />
          <XAxis dataKey="name" tick={{ fill: "#4a6e4a", fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
          <YAxis tick={{ fill: "#4a6e4a", fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmt(v)} />
          <Bar dataKey="net" fill="#16a34a" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DistributionChart({ data }: { data: BranchSummary[] }) {
  const pieData = data.map((b) => ({ name: shortBranch(b.branch), value: Math.round(b.net) }));
  return (
    <div className="chart-card">
      <div className="text-[13px] font-semibold mb-4" style={{ color: "#86a886" }}>Payroll Distribution</div>
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={45} paddingAngle={2}>
            {pieData.map((_, i) => (<Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />))}
          </Pie>
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmt(v)} />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap gap-3 justify-center mt-2">
        {pieData.map((d, i) => (
          <div key={i} className="flex items-center gap-1.5 text-[10px]" style={{ color: "#86a886" }}>
            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
            {d.name}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DeductionsChart({ data }: { data: BranchSummary[] }) {
  const chartData = data.map((b) => ({ name: shortBranch(b.branch), NAPSA: Math.round(b.napsa), NHIMA: Math.round(b.nhima) }));
  return (
    <div className="chart-card">
      <div className="text-[13px] font-semibold mb-4" style={{ color: "#86a886" }}>Statutory Deductions by Branch</div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1a2e1a" />
          <XAxis dataKey="name" tick={{ fill: "#4a6e4a", fontSize: 10 }} />
          <YAxis tick={{ fill: "#4a6e4a", fontSize: 10 }} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: any) => fmt(v)} />
          <Bar dataKey="NAPSA" stackId="a" fill="#eab308" />
          <Bar dataKey="NHIMA" stackId="a" fill="#f59e0b" radius={[4, 4, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
