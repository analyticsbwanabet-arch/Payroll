import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

export async function POST(req: NextRequest) {
  try {
    const { token, signature_data, signed_name } = await req.json();
    if (!token || !signature_data || !signed_name) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    const { data: contract } = await supabase.from("contracts").select("id, status").eq("token", token).single();
    if (!contract) return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    if (contract.status === "signed") return NextResponse.json({ error: "Contract already signed" }, { status: 400 });

    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";

    const { error } = await supabase.from("contracts").update({
      status: "signed",
      signed_at: new Date().toISOString(),
      signature_data,
      signed_name,
      signed_ip: ip,
    }).eq("id", contract.id);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
