import React from "react";
import { fetchInitialCashflowData } from "../actions";
import { CashflowDashboardClient } from "@/modules/finance/components/cashflow-dashboard-client";

export const dynamic = "force-dynamic";

export default async function FinanceiroPage() {
  const initialData = await fetchInitialCashflowData();
  return <CashflowDashboardClient initialData={initialData} />;
}
