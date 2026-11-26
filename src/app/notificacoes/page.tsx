import React from "react";
import {
  fetchInitialCashflowData,
  fetchMobileNotificationsAction,
} from "../actions";
import { NotificationsPageClient } from "@/components/notifications-page-client";

export const dynamic = "force-dynamic";

export default async function NotificacoesPage() {
  const [initialData, initialNotifications] = await Promise.all([
    fetchInitialCashflowData(),
    fetchMobileNotificationsAction(),
  ]);

  return (
    <NotificationsPageClient
      initialData={initialData}
      initialNotifications={initialNotifications}
    />
  );
}
