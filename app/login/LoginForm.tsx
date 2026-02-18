"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={handleLogin} className="flex flex-col gap-4">
      <div className="rounded-xl p-6" style={{ background: "#141414", border: "1px solid #2a2a2a" }}>
        <div className="text-sm font-semibold mb-4" style={{ color: "#a3a3a3" }}>Sign in to your account</div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "#636363" }}>Email</label>
            <input
              type="email" value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com" required autoFocus
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
            />
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "#636363" }}>Password</label>
            <input
              type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••" required
              className="w-full px-4 py-2.5 rounded-lg text-sm outline-none transition-colors"
              style={{ background: "#0a0a0a", border: "1px solid #2a2a2a", color: "#f5f5f5" }}
            />
          </div>
        </div>

        {error && (
          <div className="mt-3 px-3 py-2 rounded-lg text-xs" style={{ background: "#f8717115", color: "#f87171", border: "1px solid #f8717130" }}>
            {error}
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full mt-4 py-2.5 rounded-lg font-semibold text-sm transition-all"
          style={{ background: loading ? "#2a2a2a" : "#22c55e", color: loading ? "#636363" : "#000" }}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>

      <p className="text-center text-xs" style={{ color: "#636363" }}>
        BwanaBet Zambia • Payroll System
      </p>
    </form>
  );
}
