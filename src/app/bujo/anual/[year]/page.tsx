import React from "react";
import { redirect } from "next/navigation";
import { fetchInitialCashflowData } from "@/app/actions";
import { getBujoAnnualViewData } from "@/modules/bujo/queries";
import { BujoShell } from "@/modules/bujo/components/bujo-shell";
import { BujoAnnualView } from "@/modules/bujo/components/bujo-annual-view";

export const dynamic = "force-dynamic";

export default async function BujoSpecificAnnualPage({
  params,
}: {
  params: Promise<{ year: string }>;
}) {
  const { year } = await params;
  const yearNum = Number(year);
  if (!/^\d{4}$/.test(year) || !Number.isFinite(yearNum) || yearNum < 2000 || yearNum > 2100) {
    redirect("/bujo/anual");
  }

  const [cashflowData, annualData] = await Promise.all([
    fetchInitialCashflowData(),
    getBujoAnnualViewData(yearNum),
  ]);

  return (
    <BujoShell initialCashflowData={cashflowData} activeYear={yearNum}>
      <BujoAnnualView
        data={annualData}
        todayIso={cashflowData.settings.referenceToday}
      />
    </BujoShell>
  );
}
