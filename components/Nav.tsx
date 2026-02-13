"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/", label: "Overview", icon: "📊" },
  { href: "/branches", label: "Branches", icon: "🏢" },
  { href: "/employees", label: "Employees", icon: "👥" },
  { href: "/daily", label: "Daily Log", icon: "📝" },
  { href: "/payroll", label: "Payroll", icon: "💰" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <header
      className="border-b px-4 sm:px-7 py-3 flex justify-between items-center flex-wrap gap-3"
      style={{ background: "#0f0f0f", borderColor: "#2a2a2a" }}
    >
      <div className="flex items-center gap-3">
        <Image src="/logo.png" alt="BwanaBet" width={44} height={44}
          className="rounded-xl" style={{ border: "2px solid #facc15" }} />
        <div>
          <div className="text-[17px] font-bold tracking-tight" style={{ color: "#facc15" }}>BwanaBet</div>
          <div className="text-[11px]" style={{ color: "#636363" }}>Payroll System • Zambia</div>
        </div>
      </div>

      <nav className="flex gap-1 rounded-[10px] p-1" style={{ background: "#0a0a0a", border: "1px solid #2a2a2a" }}>
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className="px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all"
              style={{ background: active ? "#22c55e" : "transparent", color: active ? "#000" : "#a3a3a3" }}>
              {item.icon} {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
