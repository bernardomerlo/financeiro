import React from "react";
import { fetchInitialCashflowData } from "../../actions";
import { InsightsClient } from "@/modules/finance/components/insights-client";

export const dynamic = "force-dynamic";

export default async function FinanceiroInsightsPage() {
  const initialData = await fetchInitialCashflowData();
  return <InsightsClient initialData={initialData} />;
}
