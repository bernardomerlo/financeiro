import React from "react";
import {
  fetchHealthDashboardDataAction,
  fetchInitialCashflowData,
} from "../actions";
import { HealthDashboardClient } from "@/components/health-dashboard-client";

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
