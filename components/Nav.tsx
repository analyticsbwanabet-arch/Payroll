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
      style={{
        background: "linear-gradient(135deg, #050a05 0%, #0a1a0a 50%, #0d1f0d 100%)",
        borderColor: "#1a3a1a",
      }}
    >
      <div className="flex items-center gap-3">
        <Image
          src="/logo.png"
          alt="BwanaBet"
          width={44}
          height={44}
          className="rounded-xl"
          style={{ border: "2px solid #eab308" }}
        />
        <div>
          <div className="text-[17px] font-bold tracking-tight" style={{ color: "#eab308" }}>
            BwanaBet
          </div>
          <div className="text-[11px]" style={{ color: "#4a6e4a" }}>
            Payroll System • Zambia
          </div>
        </div>
      </div>

      <nav
        className="flex gap-1 rounded-[10px] p-1"
        style={{ background: "#0a1a0a", border: "1px solid #1a2e1a" }}
      >
        {navItems.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="px-3.5 py-2 rounded-lg text-[13px] font-medium transition-all"
              style={{
                background: active ? "#16a34a" : "transparent",
                color: active ? "#ffffff" : "#86a886",
              }}
            >
              {item.icon} {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
