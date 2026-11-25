import React from "react";
import { fetchInitialCashflowData } from "../actions";
import { InsightsClient } from "@/components/insights-client";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const initialData = await fetchInitialCashflowData();
  return <InsightsClient initialData={initialData} />;
}
