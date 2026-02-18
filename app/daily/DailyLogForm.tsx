"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth, supabase } from "@/lib/auth-context";

interface Branch { id: string; name: string; }
interface Employee { id: string; full_name: string; position: string; }
interface ScheduleInfo { employee_id: string; is_scheduled: boolean; schedule_type: string; schedule_group: number; }
interface LogEntry {
  employee_id: string; attendance_status: string; arrival_time: string | null;
  leave_type: string | null; shortage_amount: number; advance_amount: number;
  fine_amount: number; extra_shifts_worked: number; comments: string; saved: boolean;
  last_modified_by: string | null; last_modified_at: string | null;
  logged_by: string | null; created_at: string | null;
}

const ATTENDANCE_OPTIONS = [
  { value: "present", label: "Present", color: "#10b981", icon: "✅" },
  { value: "late", label: "Late", color: "#f59e0b", icon: "⏰" },
  { value: "absent", label: "Absent", color: "#ef4444", icon: "❌" },
  { value: "leave", label: "On Leave", color: "#8b5cf6", icon: "🏖" },
  { value: "day_off", label: "Day Off", color: "#64748b", icon: "😴" },
  { value: "extra_shift", label: "Extra Shift", color: "#06b6d4", icon: "💪" },
];

const LEAVE_TYPES = [
  { value: "annual", label: "Annual" }, { value: "sick", label: "Sick" },
  { value: "maternity", label: "Maternity" }, { value: "paternity", label: "Paternity" },
  { value: "compassionate", label: "Compassionate" }, { value: "unpaid", label: "Unpaid" },
];

const posLabel: Record<string, string> = {
  manager: "Manager", assistant_manager: "Asst Mgr", cashier: "Cashier",
  it_technician: "IT Tech", security: "Security", cleaner: "Cleaner",
  biker: "Biker", call_center_agent: "Agent",
};

function today() { return new Date().toISOString().split("T")[0]; }

function fmtTime(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("en-ZM", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false });
}

function shortEmail(email: string | null) {
  if (!email) return "";
  const at = email.indexOf("@");
  return at > 0 ? email.substring(0, at) : email;
}

export default function DailyLogForm() {
  const { allowedBranchIds, isSuperAdmin, email: userEmail, displayName } = useAuth();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchId, setBranchId] = useState("");
  const [logDate, setLogDate] = useState(today());
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [schedule, setSchedule] = useState<Record<string, ScheduleInfo>>({});
  const [entries, setEntries] = useState<Record<string, LogEntry>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  // Edit lock logic: managers can only edit today and yesterday's logs
  const isLocked = useCallback(() => {
    if (isSuperAdmin) return false;
    const logD = new Date(logDate + "T00:00:00");
    const todayD = new Date(today() + "T00:00:00");
    const diffDays = Math.floor((todayD.getTime() - logD.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 1; // locked if log_date is more than 1 day ago
  }, [logDate, isSuperAdmin]);

  const locked = isLocked();

  const loadData = useCallback(async () => {
    if (!branchId || !logDate) return;
    setLoading(true); setSaveMsg(null);

    const [{ data: emps }, { data: logs }, { data: sched }] = await Promise.all([
      supabase.from("employees").select("id, full_name, position")
        .eq("branch_id", branchId).eq("employment_status", "active").order("full_name"),
      supabase.from("daily_logs").select("*").eq("branch_id", branchId).eq("log_date", logDate),
      supabase.rpc("get_branch_schedule", { p_branch_id: branchId, p_date: logDate }),
    ]);

    setEmployees(emps || []);

    const schedMap: Record<string, ScheduleInfo> = {};
    (sched || []).forEach((s: any) => {
      schedMap[s.employee_id] = { employee_id: s.employee_id, is_scheduled: s.is_scheduled, schedule_type: s.schedule_type, schedule_group: s.schedule_group };
    });
    setSchedule(schedMap);

    const logMap: Record<string, any> = {};
    (logs || []).forEach((l: any) => (logMap[l.employee_id] = l));

    const newEntries: Record<string, LogEntry> = {};
    (emps || []).forEach((e) => {
      const existing = logMap[e.id];
      const isScheduled = schedMap[e.id]?.is_scheduled ?? true;
      newEntries[e.id] = {
        employee_id: e.id,
        attendance_status: existing?.attendance_status || (isScheduled ? "present" : "day_off"),
        arrival_time: existing?.arrival_time || null,
        leave_type: existing?.leave_type || null,
        shortage_amount: existing ? +existing.shortage_amount : 0,
        advance_amount: existing ? +existing.advance_amount : 0,
        fine_amount: existing ? +existing.fine_amount : 0,
        extra_shifts_worked: existing ? +existing.extra_shifts_worked : 0,
        comments: existing?.comments || "",
        saved: !!existing,
        last_modified_by: existing?.last_modified_by || existing?.logged_by || null,
        last_modified_at: existing?.last_modified_at || existing?.updated_at || existing?.created_at || null,
        logged_by: existing?.logged_by || null,
        created_at: existing?.created_at || null,
      };
    });

    setEntries(newEntries); setHasChanges(false); setLoading(false);
  }, [branchId, logDate]);

  useEffect(() => {
    const loadBranches = async () => {
      let query = supabase.from("branches").select("id, name").order("name");
      if (!isSuperAdmin && allowedBranchIds && allowedBranchIds.length > 0) {
        query = query.in("id", allowedBranchIds);
      }
      const { data } = await query;
      const list = data || [];
      setBranches(list);
      if (list.length === 1) setBranchId(list[0].id);
    };
    loadBranches();
  }, [allowedBranchIds, isSuperAdmin]);

  useEffect(() => { loadData(); }, [loadData]);

  const updateEntry = (empId: string, field: string, value: any) => {
    if (locked) return;
    setEntries((prev) => ({ ...prev, [empId]: { ...prev[empId], [field]: value, saved: false } }));
    setHasChanges(true); setSaveMsg(null);
  };

  const applySchedule = () => {
    if (locked) return;
    setEntries((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => {
        const isOn = schedule[id]?.is_scheduled ?? true;
        updated[id] = { ...updated[id], attendance_status: isOn ? "present" : "day_off", saved: false };
      });
      return updated;
    });
    setHasChanges(true);
  };

  const markAllPresent = () => {
    if (locked) return;
    setEntries((prev) => {
      const updated = { ...prev };
      Object.keys(updated).forEach((id) => { updated[id] = { ...updated[id], attendance_status: "present", saved: false }; });
      return updated;
    });
    setHasChanges(true);
  };

  const saveAll = async () => {
    if (locked) return;
    setSaving(true); setSaveMsg(null);

    const modifierName = displayName || userEmail || "unknown";
    const rows = Object.values(entries).map((e) => ({
      employee_id: e.employee_id, branch_id: branchId, log_date: logDate,
      attendance_status: e.attendance_status, arrival_time: e.arrival_time || null,
      leave_type: e.attendance_status === "leave" ? e.leave_type : null,
      shortage_amount: e.shortage_amount || 0, advance_amount: e.advance_amount || 0,
      fine_amount: e.fine_amount || 0,
      extra_shifts_worked: e.attendance_status === "extra_shift" ? (e.extra_shifts_worked || 1) : e.extra_shifts_worked || 0,
      comments: e.comments || null,
      logged_by: e.logged_by || modifierName,
      last_modified_by: modifierName,
      last_modified_at: new Date().toISOString(),
    }));

    const { error } = await supabase.from("daily_logs").upsert(rows, { onConflict: "employee_id,log_date" });

    if (error) {
      setSaveMsg({ type: "err", text: `Error: ${error.message}` });
    } else {
      const now = new Date().toISOString();
      setSaveMsg({ type: "ok", text: `Saved ${rows.length} entries for ${logDate}` });
      setEntries((prev) => {
        const updated = { ...prev };
        Object.keys(updated).forEach((id) => {
          updated[id] = { ...updated[id], saved: true, last_modified_by: modifierName, last_modified_at: now };
        });
        return updated;
      });
      setHasChanges(false);
    }
    setSaving(false);
  };

  const branchName = branches.find((b) => b.id === branchId)?.name || "";
  const counts = Object.values(entries).reduce((acc, e) => { acc[e.attendance_status] = (acc[e.attendance_status] || 0) + 1; return acc; }, {} as Record<string, number>);
  const schedOn = Object.values(schedule).filter((s) => s.is_scheduled).length;
  const schedOff = Object.values(schedule).filter((s) => !s.is_scheduled).length;

  const sortedEmployees = [...employees].sort((a, b) => {
    const aOn = schedule[a.id]?.is_scheduled ?? true;
    const bOn = schedule[b.id]?.is_scheduled ?? true;
    if (aOn !== bOn) return aOn ? -1 : 1;
    return a.full_name.localeCompare(b.full_name);
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold">Daily Employee Log</h1>
        <p className="text-[13px] text-[--text-muted] mt-1">Record attendance, shortages, advances, fines, and extra shifts</p>
      </div>

      {/* Lock banner */}
      {locked && (
        <div className="px-4 py-3 rounded-lg text-[13px] font-medium flex items-center gap-2"
          style={{ background: "#ef444418", border: "1px solid #ef444435", color: "#f87171" }}>
          🔒 This log is locked. Managers can only edit logs for today and yesterday.
          {!isSuperAdmin && <span style={{ color: "#636363" }}> Contact Super Admin for changes.</span>}
        </div>
      )}

      <div className="flex gap-3 flex-wrap items-end">
        <div>
          <label className="block text-[11px] text-[--text-muted] uppercase tracking-wider mb-1.5 font-medium">Branch</label>
          <select value={branchId} onChange={(e) => setBranchId(e.target.value)}
            className="px-4 py-2.5 rounded-lg border border-[--border] bg-[--card] text-[--text] text-[13px] min-w-[200px] outline-none focus:border-[--accent]">
            <option value="">Select branch...</option>
            {branches.map((b) => (<option key={b.id} value={b.id}>{b.name}</option>))}
          </select>
        </div>

        <div>
          <label className="block text-[11px] text-[--text-muted] uppercase tracking-wider mb-1.5 font-medium">Date</label>
          <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} max={today()}
            className="px-4 py-2.5 rounded-lg border border-[--border] bg-[--card] text-[--text] text-[13px] outline-none focus:border-[--accent]" />
        </div>

        {employees.length > 0 && !locked && (
          <>
            <button onClick={applySchedule}
              className="px-4 py-2.5 rounded-lg border text-[13px] font-medium transition-colors"
              style={{ borderColor: "#60a5fa40", color: "#60a5fa", background: "#60a5fa10" }}
              title="Set scheduled employees to Present, off-duty to Day Off">
              📅 Apply Schedule
            </button>
            <button onClick={markAllPresent}
              className="px-4 py-2.5 rounded-lg border border-[--border] text-[--text-dim] text-[13px] hover:border-[--green] hover:text-[--green] transition-colors">
              ✅ Mark All Present
            </button>
          </>
        )}

        {hasChanges && employees.length > 0 && !locked && (
          <button onClick={saveAll} disabled={saving}
            className="px-6 py-2.5 rounded-lg font-semibold text-[13px] transition-all ml-auto"
            style={{ background: saving ? "var(--border)" : "var(--accent)", color: saving ? "var(--text-muted)" : "#000" }}>
            {saving ? "Saving..." : `💾 Save All (${employees.length})`}
          </button>
        )}
      </div>

      {saveMsg && (
        <div className="px-4 py-3 rounded-lg text-[13px] font-medium"
          style={{ background: saveMsg.type === "ok" ? "#10b98120" : "#ef444420", color: saveMsg.type === "ok" ? "var(--green)" : "var(--red)", border: `1px solid ${saveMsg.type === "ok" ? "#10b98140" : "#ef444440"}` }}>
          {saveMsg.type === "ok" ? "✅ " : "⚠️ "}{saveMsg.text}
        </div>
      )}

      {employees.length > 0 && (
        <div className="flex gap-4 flex-wrap">
          <div className="flex gap-2 items-center px-3 py-2 rounded-lg" style={{ background: "#60a5fa10", border: "1px solid #60a5fa25" }}>
            <span className="text-[11px] font-semibold" style={{ color: "#60a5fa" }}>📅 SCHEDULE</span>
            <span className="text-[12px] font-medium" style={{ color: "#4ade80" }}>🟢 On: {schedOn}</span>
            <span className="text-[12px] font-medium" style={{ color: "#64748b" }}>⚫ Off: {schedOff}</span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {ATTENDANCE_OPTIONS.map((opt) => {
              const count = counts[opt.value] || 0;
              return (
                <div key={opt.value} className="px-3 py-1.5 rounded-full text-[11px] font-medium"
                  style={{ background: count > 0 ? opt.color + "20" : "transparent", color: count > 0 ? opt.color : "var(--text-muted)", border: `1px solid ${count > 0 ? opt.color + "40" : "var(--border)"}` }}>
                  {opt.icon} {opt.label}: {count}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {!branchId && (
        <div className="chart-card text-center py-16">
          <div className="text-4xl mb-3">🏢</div>
          <div className="text-[--text-dim] text-[15px]">Select a branch to start logging</div>
        </div>
      )}

      {loading && branchId && (
        <div className="chart-card text-center py-16">
          <div className="text-[--text-dim]">Loading employees...</div>
        </div>
      )}

      {!loading && branchId && employees.length > 0 && (
        <div className="chart-card overflow-x-auto">
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: "0 2px" }}>
            <thead>
              <tr>
                {["", "Employee", "Schedule", "Role", "Attendance", "Leave Type", "Extra Shifts", "Shortage", "Advance", "Fine", "Comments", "Last Modified"].map((h) => (
                  <th key={h} className="px-3 py-2.5 text-[10px] uppercase tracking-wider font-semibold text-[--text-muted] border-b border-[--border] text-left whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedEmployees.map((emp) => {
                const entry = entries[emp.id];
                if (!entry) return null;
                const attOpt = ATTENDANCE_OPTIONS.find((a) => a.value === entry.attendance_status);
                const sched = schedule[emp.id];
                const isOn = sched?.is_scheduled ?? true;
                const schedLabel = sched?.schedule_type === "3on2off" ? "3/2" : "2/2";

                return (
                  <tr key={emp.id} className="transition-colors"
                    style={{ background: entry.saved ? "transparent" : "#f59e0b08", opacity: !isOn && entry.attendance_status === "day_off" ? 0.55 : 1 }}
                    onMouseOver={(e) => { e.currentTarget.style.background = "var(--card-hover)"; e.currentTarget.style.opacity = "1"; }}
                    onMouseOut={(e) => { e.currentTarget.style.background = entry.saved ? "transparent" : "#f59e0b08"; e.currentTarget.style.opacity = (!isOn && entry.attendance_status === "day_off") ? "0.55" : "1"; }}>

                    <td className="px-1 py-2.5 text-center w-8">
                      {entry.saved ? <span title="Saved" className="text-[--green] text-[11px]">●</span> : <span title="Unsaved" className="text-[--accent] text-[11px]">○</span>}
                    </td>

                    <td className="px-3 py-2.5 font-semibold text-[13px] text-[--text] whitespace-nowrap">{emp.full_name}</td>

                    <td className="px-3 py-2.5">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold"
                        style={{ background: isOn ? "#22c55e20" : "#64748b20", color: isOn ? "#4ade80" : "#64748b", border: `1px solid ${isOn ? "#22c55e40" : "#64748b30"}` }}>
                        {isOn ? "🟢 ON" : "⚫ OFF"}
                        <span style={{ color: "#636363", fontWeight: 400 }}>{schedLabel}</span>
                      </span>
                    </td>

                    <td className="px-3 py-2.5 text-[11px] text-[--text-dim]">{posLabel[emp.position] || emp.position}</td>

                    <td className="px-3 py-2.5">
                      <select value={entry.attendance_status} onChange={(e) => updateEntry(emp.id, "attendance_status", e.target.value)}
                        disabled={locked}
                        className="px-2.5 py-1.5 rounded-md border text-[12px] font-medium outline-none w-[130px]"
                        style={{ background: (attOpt?.color || "#64748b") + "15", borderColor: (attOpt?.color || "#64748b") + "40", color: attOpt?.color || "var(--text-dim)", opacity: locked ? 0.6 : 1, cursor: locked ? "not-allowed" : "pointer" }}>
                        {ATTENDANCE_OPTIONS.map((opt) => (<option key={opt.value} value={opt.value}>{opt.icon} {opt.label}</option>))}
                      </select>
                    </td>

                    <td className="px-3 py-2.5">
                      {entry.attendance_status === "leave" ? (
                        <select value={entry.leave_type || ""} onChange={(e) => updateEntry(emp.id, "leave_type", e.target.value || null)}
                          disabled={locked}
                          className="px-2.5 py-1.5 rounded-md border border-[--border] bg-[--card] text-[--text] text-[12px] outline-none w-[120px]"
                          style={{ opacity: locked ? 0.6 : 1, cursor: locked ? "not-allowed" : "pointer" }}>
                          <option value="">Select...</option>
                          {LEAVE_TYPES.map((lt) => (<option key={lt.value} value={lt.value}>{lt.label}</option>))}
                        </select>
                      ) : <span className="text-[--text-muted] text-[11px]">—</span>}
                    </td>

                    <td className="px-3 py-2.5">
                      <input type="number" min="0" max="3" step="0.5" value={entry.extra_shifts_worked || ""} onChange={(e) => updateEntry(emp.id, "extra_shifts_worked", parseFloat(e.target.value) || 0)} placeholder="0" disabled={locked}
                        className="w-[60px] px-2 py-1.5 rounded-md border border-[--border] bg-[--card] text-[--text] text-[12px] text-center outline-none focus:border-[--cyan]"
                        style={{ opacity: locked ? 0.6 : 1, cursor: locked ? "not-allowed" : "text" }} />
                    </td>

                    <td className="px-3 py-2.5">
                      <input type="number" min="0" step="1" value={entry.shortage_amount || ""} onChange={(e) => updateEntry(emp.id, "shortage_amount", parseFloat(e.target.value) || 0)} placeholder="0" disabled={locked}
                        className="w-[80px] px-2 py-1.5 rounded-md border border-[--border] bg-[--card] text-[12px] text-right outline-none focus:border-[--red]"
                        style={{ color: entry.shortage_amount > 0 ? "var(--red)" : "var(--text)", opacity: locked ? 0.6 : 1, cursor: locked ? "not-allowed" : "text" }} />
                    </td>

                    <td className="px-3 py-2.5">
                      <input type="number" min="0" step="1" value={entry.advance_amount || ""} onChange={(e) => updateEntry(emp.id, "advance_amount", parseFloat(e.target.value) || 0)} placeholder="0" disabled={locked}
                        className="w-[80px] px-2 py-1.5 rounded-md border border-[--border] bg-[--card] text-[12px] text-right outline-none focus:border-[--accent]"
                        style={{ color: entry.advance_amount > 0 ? "var(--accent)" : "var(--text)", opacity: locked ? 0.6 : 1, cursor: locked ? "not-allowed" : "text" }} />
                    </td>

                    <td className="px-3 py-2.5">
                      <input type="number" min="0" step="1" value={entry.fine_amount || ""} onChange={(e) => updateEntry(emp.id, "fine_amount", parseFloat(e.target.value) || 0)} placeholder="0" disabled={locked}
                        className="w-[80px] px-2 py-1.5 rounded-md border border-[--border] bg-[--card] text-[12px] text-right outline-none focus:border-[--red]"
                        style={{ color: entry.fine_amount > 0 ? "var(--red)" : "var(--text)", opacity: locked ? 0.6 : 1, cursor: locked ? "not-allowed" : "text" }} />
                    </td>

                    <td className="px-3 py-2.5">
                      <input type="text" value={entry.comments} onChange={(e) => updateEntry(emp.id, "comments", e.target.value)} placeholder="Notes..." disabled={locked}
                        className="w-[140px] px-2.5 py-1.5 rounded-md border border-[--border] bg-[--card] text-[--text] text-[12px] outline-none focus:border-[--accent]"
                        style={{ opacity: locked ? 0.6 : 1, cursor: locked ? "not-allowed" : "text" }} />
                    </td>

                    {/* Last Modified column */}
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {entry.last_modified_by ? (
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] font-semibold" style={{ color: "#a78bfa" }}>{shortEmail(entry.last_modified_by)}</span>
                          <span className="text-[9px]" style={{ color: "#636363" }}>{fmtTime(entry.last_modified_at)}</span>
                        </div>
                      ) : (
                        <span className="text-[10px]" style={{ color: "#3a3a3a" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {hasChanges && employees.length > 0 && !locked && (
        <div className="fixed bottom-0 left-0 right-0 px-7 py-3.5 flex justify-between items-center z-50"
          style={{ background: "linear-gradient(180deg, transparent 0%, #0a0f1a 20%)", borderTop: "1px solid var(--border)" }}>
          <div className="text-[13px] text-[--text-dim]">
            {branchName} • {logDate} • {employees.length} employees •{" "}
            <span className="text-[--accent]">{Object.values(entries).filter((e) => !e.saved).length} unsaved</span>
          </div>
          <button onClick={saveAll} disabled={saving} className="px-8 py-2.5 rounded-lg font-bold text-[14px] transition-all"
            style={{ background: saving ? "var(--border)" : "var(--accent)", color: saving ? "var(--text-muted)" : "#000" }}>
            {saving ? "Saving..." : "💾 Save All Changes"}
          </button>
        </div>
      )}

      {!loading && branchId && employees.length === 0 && (
        <div className="chart-card text-center py-16">
          <div className="text-[--text-muted]">No active employees found for this branch</div>
        </div>
      )}
    </div>
  );
}
