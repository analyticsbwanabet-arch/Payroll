export default function StatCard({
  icon, label, value, sub, color = "var(--accent)",
}: {
  icon: string; label: string; value: string | number; sub?: string; color?: string;
}) {
  return (
    <div className="stat-card">
      <div className="glow" style={{ background: color }} />
      <div className="text-xs text-[--text-dim] mb-1.5 uppercase tracking-wider font-medium">
        {icon} {label}
      </div>
      <div className="text-2xl font-bold font-mono text-[--text]">{value}</div>
      {sub && <div className="text-[11px] text-[--text-muted] mt-1">{sub}</div>}
    </div>
  );
}
