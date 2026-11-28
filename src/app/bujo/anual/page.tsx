import React from "react";
import { fetchInitialCashflowData } from "@/app/actions";
import { getBujoAnnualViewData } from "@/modules/bujo/queries";
import { BujoShell } from "@/modules/bujo/components/bujo-shell";
import { BujoAnnualView } from "@/modules/bujo/components/bujo-annual-view";

export const dynamic = "force-dynamic";

export default async function BujoCurrentAnnualPage() {
  const cashflowData = await fetchInitialCashflowData();
  const todayIso = cashflowData.settings.referenceToday;
  const currentYear = Number(todayIso.slice(0, 4));
  const annualData = await getBujoAnnualViewData(currentYear);

  return (
    <BujoShell initialCashflowData={cashflowData} activeYear={currentYear}>
      <BujoAnnualView data={annualData} todayIso={todayIso} />
    </BujoShell>
  );
}
