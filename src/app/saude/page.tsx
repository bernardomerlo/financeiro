import React from "react";
import { fetchInitialCashflowData } from "../actions";
import { fetchHealthDashboardDataAction } from "@/modules/health/actions";
import { HealthDashboardClient } from "@/modules/health/components/health-dashboard-client";

export const dynamic = "force-dynamic";

export default async function SaudePage() {
  const [cashflowData, healthData] = await Promise.all([
    fetchInitialCashflowData(),
    fetchHealthDashboardDataAction(),
  ]);

  return (
    <HealthDashboardClient
      initialCashflowData={cashflowData}
      initialHealthData={healthData}
    />
  );
}
