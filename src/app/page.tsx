import React from "react";
import {
  fetchInitialCashflowData,
  fetchMobileNotificationsAction,
} from "./actions";
import { fetchHealthDashboardDataAction } from "@/modules/health/actions";
import { getBujoDayViewData } from "@/modules/bujo/queries";
import { HubOverviewClient } from "@/core/hub/hub-overview-client";

export const dynamic = "force-dynamic";

export default async function HubHomePage() {
  const cashflowData = await fetchInitialCashflowData();
  const todayIso = cashflowData.settings.referenceToday;

  const [notifications, healthData, todayBujo] = await Promise.all([
    fetchMobileNotificationsAction(),
    fetchHealthDashboardDataAction(),
    getBujoDayViewData(todayIso),
  ]);

  return (
    <HubOverviewClient
      initialCashflowData={cashflowData}
      initialNotifications={notifications}
      initialHealthData={healthData}
      initialTodayBujo={todayBujo}
    />
  );
}
