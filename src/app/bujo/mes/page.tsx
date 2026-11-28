import React from "react";
import { fetchInitialCashflowData } from "@/app/actions";
import { getBujoMonthViewData } from "@/modules/bujo/queries";
import { BujoShell } from "@/modules/bujo/components/bujo-shell";
import { BujoMonthView } from "@/modules/bujo/components/bujo-month-view";

export const dynamic = "force-dynamic";

export default async function BujoCurrentMonthPage() {
  const cashflowData = await fetchInitialCashflowData();
  const todayIso = cashflowData.settings.referenceToday;
  const currentYM = todayIso.slice(0, 7);
  const monthData = await getBujoMonthViewData(currentYM);

  return (
    <BujoShell initialCashflowData={cashflowData} activeYearMonth={currentYM}>
      <BujoMonthView data={monthData} todayIso={todayIso} />
    </BujoShell>
  );
}
