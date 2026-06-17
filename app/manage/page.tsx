"use client";

import { useState, useEffect } from "react";
import { supabase, useAuth } from "@/lib/auth-context";

interface Branch { id: string; name: string; }
interface Employee { id: string; full_name: string; branch_id: string; branch_name: string; position: string; }

const POSITIONS = [
  { value: "manager", label: "Manager", pay: "3500" },
  { value: "assistant_manager", label: "Assistant Manager", pay: "3000" },
  { value: "cashier", label: "Cashier", pay: "2500" },
  { value: "waitress", label: "Waitress", pay: "2500" },
  { value: "it_technician", label: "IT Technician", pay: "4000" },
  { value: "security", label: "Security", pay: "2500" },
  { value: "cleaner", label: "Cleaner", pay: "2500" },
  { value: "biker", label: "Biker", pay: "2500" },
  { value: "call_center_agent", label: "Call Center Agent", pay: "2500" },
];

const PAY_MAP: Record<string, { basic: number; housing: number; shifts: number }> = {
  "manager": { basic: 2400, housing: 720, shifts: 20 },
  "assistant_manager": { basic: 2000, housing: 600, shifts: 20 },
  "cashier": { basic: 1630.77, housing: 489.23, shifts: 16 },
  "waitress": { basic: 1630.77, housing: 489.23, shifts: 16 },
  "it_technician": { basic: 2784.62, housing: 835.38, shifts: 20 },
  "security": { basic: 1630.77, housing: 489.23, shifts: 16 },
  "cleaner": { basic: 1630.77, housing: 489.23, shifts: 16 },
  "biker": { basic: 1630.77, housing: 489.23, shifts: 16 },
  "call_center_agent": { basic: 1630.77, housing: 489.23, shifts: 16 },
};

export default function ManagePage() {
  const { isSuperAdmin, readOnly, loading: authLoading } = useAuth();
  const [tab, setTab] = useState<"add" | "transfer">("add");
  const [branches, setBranches] = useState<Branch[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  // Add Employee form
  const [newEmp, setNewEmp] = useState({
    full_name: "", phone: "", mobile_money_number: "", email: "", home_address: "",
    emergency_contact_name: "", emergency_contact_phone: "", nrc_number: "", tpin: "",
    social_security_number: "", branch_id: "", position: "cashier", date_started: new Date().toISOString().split("T")[0],
  });

  // Transfer form
  const [transferEmpId, setTransferEmpId] = useState("");
  const [transferBranchId, setTransferBranchId] = useState("");
  const [transferPosition, setTransferPosition] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const load = async () => {
      const { data: b } = await supabase.from("branches").select("id, name").order("name");
      setBranches(b || []);
      const { data: e } = await supabase
        .from("employees")
        .select("id, full_name, branch_id, position")
        .eq("employment_status", "active")
        .order("full_name");
      const branchMap: Record<string, string> = {};
      (b || []).forEach((br: any) => branchMap[br.id] = br.name);
      setEmployees((e || []).map((emp: any) => ({ ...emp, branch_name: branchMap[emp.branch_id] || "Unknown" })));
    };
    load();
  }, []);

  const handleAdd = async () => {
    if (!newEmp.full_name || !newEmp.branch_id || !newEmp.position) {
      setMsg({ type: "err", text: "Name, branch, and position are required" }); return;
    }
    setSaving(true); setMsg(null);

    const pay = PAY_MAP[newEmp.position] || PAY_MAP["cashier"];
    const role = newEmp.position === "manager" ? "branch_manager" : "employee";
    const dept = ["it_technician"].includes(newEmp.position) ? "IT"
      : ["security"].includes(newEmp.position) ? "Security"
      : ["cleaner"].includes(newEmp.position) ? "Cleaning"
      : ["biker"].includes(newEmp.position) ? "Logistics"
      : ["call_center_agent"].includes(newEmp.position) ? "Call Center"
      : "Operations";

    const { data: deptData } = await supabase.from("departments").select("id").eq("name", dept).single();

    const { error } = await supabase.from("employees").insert({
      full_name: newEmp.full_name,
      phone: newEmp.phone ? (newEmp.phone.startsWith("260") ? newEmp.phone : "260" + newEmp.phone) : null,
      mobile_money_number: newEmp.mobile_money_number ? (newEmp.mobile_money_number.startsWith("260") ? newEmp.mobile_money_number : "260" + newEmp.mobile_money_number) : null,
      email: newEmp.email || null,
      home_address: newEmp.home_address || null,
      emergency_contact_name: newEmp.emergency_contact_name || null,
      emergency_contact_phone: newEmp.emergency_contact_phone || null,
      nrc_number: newEmp.nrc_number || null,
      tpin: newEmp.tpin || null,
      social_security_number: newEmp.social_security_number || null,
      branch_id: newEmp.branch_id,
      department_id: deptData?.id || null,
      position: newEmp.position,
      role,
      employment_status: "active",
      date_started: newEmp.date_started,
      basic_pay: pay.basic,
      housing_allowance: pay.housing,
      transport_allowance: 200,
      lunch_allowance: 180,
      shifts_per_month: pay.shifts,
    });

    if (error) {
      setMsg({ type: "err", text: `Error: ${error.message}` });
    } else {
      setMsg({ type: "ok", text: `${newEmp.full_name} added successfully!` });
      setNewEmp({ full_name: "", phone: "", mobile_money_number: "", email: "", home_address: "",
        emergency_contact_name: "", emergency_contact_phone: "", nrc_number: "", tpin: "",
        social_security_number: "", branch_id: "", position: "cashier", date_started: new Date().toISOString().split("T")[0] });
      // Refresh employees
      const { data: e } = await supabase.from("employees").select("id, full_name, branch_id, position").eq("employment_status", "active").order("full_name");
      const branchMap: Record<string, string> = {};
      branches.forEach(br => branchMap[br.id] = br.name);
      setEmployees((e || []).map((emp: any) => ({ ...emp, branch_name: branchMap[emp.branch_id] || "Unknown" })));
    }
    setSaving(false);
  };

  const handleTransfer = async () => {
    if (!transferEmpId || !transferBranchId) {
      setMsg({ type: "err", text: "Select an employee and target branch" }); return;
    }
    setSaving(true); setMsg(null);

    const updates: any = { branch_id: transferBranchId };
    if (transferPosition) {
      updates.position = transferPosition;
      updates.role = transferPosition === "manager" ? "branch_manager" : "employee";
      const pay = PAY_MAP[transferPosition] || PAY_MAP["cashier"];
      updates.basic_pay = pay.basic;
      updates.housing_allowance = pay.housing;
      updates.shifts_per_month = pay.shifts;
    }

    const { error } = await supabase.from("employees").update(updates).eq("id", transferEmpId);

    if (error) {
      setMsg({ type: "err", text: `Error: ${error.message}` });
    } else {
      const emp = employees.find(e => e.id === transferEmpId);
      const branch = branches.find(b => b.id === transferBranchId);
      setMsg({ type: "ok", text: `${emp?.full_name} transferred to ${branch?.name}${transferPosition ? ` as ${transferPosition}` : ""}` });
      setTransferEmpId(""); setTransferBranchId(""); setTransferPosition("");
      // Refresh
      const { data: e } = await supabase.from("employees").select("id, full_name, branch_id, position").eq("employment_status", "active").order("full_name");
      const branchMap: Record<string, string> = {};
      branches.forEach(br => branchMap[br.id] = br.name);
      setEmployees((e || []).map((emp: any) => ({ ...emp, branch_name: branchMap[emp.branch_id] || "Unknown" })));
    }
    setSaving(false);
  };

  const filteredEmployees = searchQuery
    ? employees.filter(e => e.full_name.toLowerCase().includes(searchQuery.toLowerCase()) || e.branch_name.toLowerCase().includes(searchQuery.toLowerCase()))
    : employees;

  const selectedEmp = employees.find(e => e.id === transferEmpId);

  if (authLoading) return <div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">⚙️</div></div>;

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <div className="text-4xl">🔒</div>
        <h2 className="text-lg font-bold" style={{ color: "#f5f5f5" }}>Access Restricted</h2>
        <p className="text-[13px]" style={{ color: "#636363" }}>Employee Management is only accessible to Admins.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-bold" style={{ color: "#facc15" }}>Employee Management</h1>
        <p className="text-[13px] mt-1" style={{ color: "#636363" }}>Add new employees or transfer existing ones between stores</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        <button onClick={() => { setTab("add"); setMsg(null); }}
          className="px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all"
          style={{ background: tab === "add" ? "#22c55e" : "#1c1c1c", color: tab === "add" ? "#000" : "#636363", border: `1px solid ${tab === "add" ? "#22c55e" : "#2a2a2a"}` }}>
          ➕ Add Employee
        </button>
        <button onClick={() => { setTab("transfer"); setMsg(null); }}
          className="px-5 py-2.5 rounded-lg text-[13px] font-semibold transition-all"
          style={{ background: tab === "transfer" ? "#22d3ee" : "#1c1c1c", color: tab === "transfer" ? "#000" : "#636363", border: `1px solid ${tab === "transfer" ? "#22d3ee" : "#2a2a2a"}` }}>
          🔄 Transfer Employee
        </button>
      </div>

      {/* Message */}
      {msg && (
        <div className="px-4 py-3 rounded-lg text-[13px]"
          style={{ background: msg.type === "ok" ? "#22c55e15" : "#f8717115", border: `1px solid ${msg.type === "ok" ? "#22c55e30" : "#f8717130"}`, color: msg.type === "ok" ? "#4ade80" : "#f87171" }}>
          {msg.type === "ok" ? "✅" : "❌"} {msg.text}
        </div>
      )}

      {/* Add Employee Form */}
      {tab === "add" && (
        <div className="chart-card flex flex-col gap-4">
          <h3 className="text-[14px] font-bold" style={{ color: "#4ade80" }}>New Employee Details</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            <Field label="Full Name *" value={newEmp.full_name} onChange={v => setNewEmp({ ...newEmp, full_name: v })} placeholder="e.g. John Doe" />
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Branch *</label>
              <select value={newEmp.branch_id} onChange={e => setNewEmp({ ...newEmp, branch_id: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="">Select branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Position *</label>
              <select value={newEmp.position} onChange={e => setNewEmp({ ...newEmp, position: e.target.value })}
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label} (K{p.pay})</option>)}
              </select>
            </div>
            <Field label="Phone" value={newEmp.phone} onChange={v => setNewEmp({ ...newEmp, phone: v })} placeholder="260..." />
            <Field label="Mobile Money" value={newEmp.mobile_money_number} onChange={v => setNewEmp({ ...newEmp, mobile_money_number: v })} placeholder="260..." />
            <Field label="Email" value={newEmp.email} onChange={v => setNewEmp({ ...newEmp, email: v })} placeholder="email@example.com" />
            <Field label="Home Address" value={newEmp.home_address} onChange={v => setNewEmp({ ...newEmp, home_address: v })} placeholder="e.g. Kabanana" />
            <Field label="Emergency Contact Name" value={newEmp.emergency_contact_name} onChange={v => setNewEmp({ ...newEmp, emergency_contact_name: v })} placeholder="e.g. John (Father)" />
            <Field label="Emergency Contact Phone" value={newEmp.emergency_contact_phone} onChange={v => setNewEmp({ ...newEmp, emergency_contact_phone: v })} placeholder="260..." />
            <Field label="NRC Number" value={newEmp.nrc_number} onChange={v => setNewEmp({ ...newEmp, nrc_number: v })} placeholder="e.g. 123456/10/1" />
            <Field label="TPIN" value={newEmp.tpin} onChange={v => setNewEmp({ ...newEmp, tpin: v })} placeholder="e.g. 2001234567" />
            <Field label="NAPSA Number" value={newEmp.social_security_number} onChange={v => setNewEmp({ ...newEmp, social_security_number: v })} placeholder="e.g. 123456789" />
            <Field label="Date Started" value={newEmp.date_started} onChange={v => setNewEmp({ ...newEmp, date_started: v })} type="date" />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleAdd} disabled={saving || readOnly}
              className="px-6 py-2.5 rounded-lg font-semibold text-[13px] transition-all"
              style={{ background: "#22c55e", color: "#000", opacity: (saving || readOnly) ? 0.5 : 1 }}>
              {readOnly ? "🔒 View Only" : saving ? "Adding..." : "➕ Add Employee"}
            </button>
            <span className="text-[11px]" style={{ color: "#636363" }}>
              Gross: K{((PAY_MAP[newEmp.position]?.basic || 0) + (PAY_MAP[newEmp.position]?.housing || 0) + 380).toLocaleString()}
            </span>
          </div>
        </div>
      )}

      {/* Transfer Employee */}
      {tab === "transfer" && (
        <div className="chart-card flex flex-col gap-4">
          <h3 className="text-[14px] font-bold" style={{ color: "#22d3ee" }}>Transfer Employee</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Search Employee</label>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" placeholder="Type name or branch..."
                style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }} />
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Select Employee</label>
              <select value={transferEmpId} onChange={e => setTransferEmpId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="">Select employee...</option>
                {filteredEmployees.map(e => <option key={e.id} value={e.id}>{e.full_name} — {e.branch_name} ({e.position})</option>)}
              </select>
            </div>
          </div>

          {selectedEmp && (
            <div className="px-4 py-3 rounded-lg text-[12px]" style={{ background: "#22d3ee10", border: "1px solid #22d3ee20" }}>
              <span style={{ color: "#22d3ee" }}>Currently:</span> <span style={{ color: "#f5f5f5" }}>{selectedEmp.full_name}</span>
              <span style={{ color: "#636363" }}> at </span><span style={{ color: "#facc15" }}>{selectedEmp.branch_name}</span>
              <span style={{ color: "#636363" }}> as </span><span style={{ color: "#f5f5f5" }}>{selectedEmp.position}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Transfer To Branch *</label>
              <select value={transferBranchId} onChange={e => setTransferBranchId(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="">Select new branch...</option>
                {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>Change Position (optional)</label>
              <select value={transferPosition} onChange={e => setTransferPosition(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none" style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }}>
                <option value="">Keep current position</option>
                {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label} (K{p.pay})</option>)}
              </select>
            </div>
          </div>

          <div className="pt-2">
            <button onClick={handleTransfer} disabled={saving || readOnly || !transferEmpId || !transferBranchId}
              className="px-6 py-2.5 rounded-lg font-semibold text-[13px] transition-all"
              style={{ background: "#22d3ee", color: "#000", opacity: (saving || readOnly || !transferEmpId || !transferBranchId) ? 0.5 : 1 }}>
              {readOnly ? "🔒 View Only" : saving ? "Transferring..." : "🔄 Transfer Employee"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type = "text" }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <div>
      <label className="block text-[10px] uppercase tracking-wider font-medium mb-1" style={{ color: "#636363" }}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        className="w-full px-3 py-2.5 rounded-lg text-[13px] outline-none"
        style={{ border: "1px solid #2a2a2a", background: "#0a0a0a", color: "#f5f5f5" }} />
    </div>
  );
}
