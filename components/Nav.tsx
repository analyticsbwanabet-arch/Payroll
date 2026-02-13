"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview", icon: "📊" },
  { href: "/branches", label: "Branches", icon: "🏢" },
  { href: "/employees", label: "Employees", icon: "👥" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header
      className="border-b border-[--border] px-4 sm:px-7 py-4 flex justify-between items-center flex-wrap gap-3"
      style={{ background: "linear-gradient(135deg, #111827 0%, #0f172a 50%, #1a1a2e 100%)" }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-[10px] flex items-center justify-center text-lg font-extrabold text-black"
          style={{ background: "linear-gradient(135deg, #f59e0b, #d97706)" }}
        >
          B
        </div>
        <div>
          <div className="text-[17px] font-bold tracking-tight">BwanaBet Payroll</div>
          <div className="text-[11px] text-[--text-muted]">January 2026 • Zambia</div>
        </div>
      </div>

      <nav className="flex gap-1 bg-[--card] rounded-[10px] p-1 border border-[--border]">
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`px-4 py-2 rounded-lg text-[13px] font-medium transition-all ${
                active
                  ? "bg-[--accent] text-black"
                  : "text-[--text-dim] hover:text-[--text]"
              }`}
            >
              {item.icon} {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
