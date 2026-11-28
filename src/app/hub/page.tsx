import React from "react";
import {
  fetchHealthDashboardDataAction,
  fetchInitialCashflowData,
  fetchMobileNotificationsAction,
} from "../actions";
import { HubOverviewClient } from "@/components/hub-overview-client";

export const dynamic = "force-dynamic";

export default async function HubPage() {
  const [cashflowData, notifications, healthData] = await Promise.all([
    fetchInitialCashflowData(),
    fetchMobileNotificationsAction(),
    fetchHealthDashboardDataAction(),
  ]);

  return (
    <HubOverviewClient
      initialCashflowData={cashflowData}
      initialNotifications={notifications}
      initialHealthData={healthData}
    />
  );
}
