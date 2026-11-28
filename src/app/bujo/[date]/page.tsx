import React from "react";
import { redirect } from "next/navigation";
import { fetchInitialCashflowData } from "@/app/actions";
import { getBujoDayViewData } from "@/modules/bujo/queries";
import { isValidIsoDate } from "@/modules/bujo/bujo-utils";
import { BujoShell } from "@/modules/bujo/components/bujo-shell";
import { BujoDayView } from "@/modules/bujo/components/bujo-day-view";

export const dynamic = "force-dynamic";

export default async function BujoSpecificDayPage({
  params,
}: {
  params: Promise<{ date: string }>;
}) {
  const { date } = await params;
  if (!isValidIsoDate(date)) {
    redirect("/bujo");
  }

  const [cashflowData, dayData] = await Promise.all([
    fetchInitialCashflowData(),
    getBujoDayViewData(date),
  ]);

  return (
    <BujoShell initialCashflowData={cashflowData} activeDate={date}>
      <BujoDayView
        data={dayData}
        todayIso={cashflowData.settings.referenceToday}
      />
    </BujoShell>
  );
}
