import { supabase } from "@/lib/supabase";
import PayrollGenerator from "./PayrollGenerator";

export const revalidate = 0;

export default async function PayrollPage() {
  const { data: periods } = await supabase
    .from("payroll_periods")
    .select("id, period_name, start_date, end_date, is_finalized")
    .order("start_date", { ascending: false });

  return <PayrollGenerator periods={periods || []} />;
}
