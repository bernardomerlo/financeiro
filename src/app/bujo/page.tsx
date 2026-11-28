import React from "react";
import { redirect } from "next/navigation";
import { fetchInitialCashflowData } from "@/app/actions";
import { getBujoDayViewData } from "@/modules/bujo/queries";
import { isValidIsoDate } from "@/modules/bujo/bujo-utils";
import { BujoShell } from "@/modules/bujo/components/bujo-shell";
import { BujoDayView } from "@/modules/bujo/components/bujo-day-view";

export const dynamic = "force-dynamic";

export default async function BujoTodayPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const cashflowData = await fetchInitialCashflowData();
  const todayIso = cashflowData.settings.referenceToday;

  if (sp.date && isValidIsoDate(sp.date) && sp.date !== todayIso) {
    redirect(`/bujo/${sp.date}`);
  }

  const dayData = await getBujoDayViewData(todayIso);

  return (
    <BujoShell initialCashflowData={cashflowData} activeDate={todayIso}>
      <BujoDayView data={dayData} todayIso={todayIso} />
    </BujoShell>
  );
}
