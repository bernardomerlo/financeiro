import React from "react";
import { redirect } from "next/navigation";
import { fetchInitialCashflowData } from "@/app/actions";
import { getBujoMonthViewData } from "@/modules/bujo/queries";
import { isValidYearMonth } from "@/modules/bujo/bujo-utils";
import { BujoShell } from "@/modules/bujo/components/bujo-shell";
import { BujoMonthView } from "@/modules/bujo/components/bujo-month-view";

export const dynamic = "force-dynamic";

export default async function BujoSpecificMonthPage({
  params,
}: {
  params: Promise<{ yearMonth: string }>;
}) {
  const { yearMonth } = await params;
  if (!isValidYearMonth(yearMonth)) {
    redirect("/bujo/mes");
  }

  const [cashflowData, monthData] = await Promise.all([
    fetchInitialCashflowData(),
    getBujoMonthViewData(yearMonth),
  ]);

  return (
    <BujoShell initialCashflowData={cashflowData} activeYearMonth={yearMonth}>
      <BujoMonthView
        data={monthData}
        todayIso={cashflowData.settings.referenceToday}
      />
    </BujoShell>
  );
}
