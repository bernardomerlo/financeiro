import React from "react";
import { fetchInitialCashflowData } from "./actions";
import { CashflowDashboardClient } from "@/components/cashflow-dashboard-client";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const initialData = await fetchInitialCashflowData();
  return <CashflowDashboardClient initialData={initialData} />;
}
