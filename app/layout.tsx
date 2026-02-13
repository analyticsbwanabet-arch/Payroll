import type { Metadata } from "next";
import "./globals.css";
import Nav from "@/components/Nav";

export const metadata: Metadata = {
  title: "BwanaBet Payroll",
  description: "Payroll management system for BwanaBet Zambia",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <Nav />
        <main className="max-w-[1360px] mx-auto px-4 sm:px-7 py-6">{children}</main>
        <footer className="max-w-[1360px] mx-auto px-7 pb-8 pt-4 flex justify-between flex-wrap gap-2 text-[11px]"
          style={{ borderTop: "1px solid #2a2a2a", color: "#636363" }}>
          <span>BwanaBet Payroll System • Connected to Supabase</span>
          <span>NAPSA 5% • NHIMA 1% • PAYE 2025 Brackets • ZMW</span>
        </footer>
      </body>
    </html>
  );
}
