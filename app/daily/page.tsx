"use client";

import { Suspense } from "react";
import DailyLogForm from "./DailyLogForm";

export default function DailyLogPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-20"><div className="text-3xl animate-pulse">📝</div></div>}>
      <DailyLogForm />
    </Suspense>
  );
}
