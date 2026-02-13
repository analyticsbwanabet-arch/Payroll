import { supabase } from "@/lib/supabase";
import DailyLogForm from "./DailyLogForm";

export const revalidate = 0; // always fresh

export default async function DailyPage() {
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name")
    .eq("is_active", true)
    .order("name");

  return <DailyLogForm branches={branches || []} />;
}
