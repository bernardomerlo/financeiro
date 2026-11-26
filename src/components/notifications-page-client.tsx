"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  addMonthsToYearMonth,
  calculateCashflowProjection,
  type CashflowSettings,
  type DailyOverrideRecord,
  type RecurringOccurrenceRecord,
  type RecurringRuleRecord,
  type TransactionRecord,
} from "@/lib/cashflow-engine";
import { TopNavbar } from "./top-navbar";
import { LaunchModal } from "./launch-modal";
import { DayDetailDrawer } from "./day-detail-drawer";
import { SettingsAndRecurringModals } from "./settings-and-recurring-modals";
import { SimulationFloatingBar } from "./simulation-floating-bar";
import { NotificationsValidator } from "./notifications-validator";
import type { MobileNotificationRecord } from "@/app/actions";

interface NotificationsPageClientProps {
  initialData: {
    settings: CashflowSettings;
    transactions: TransactionRecord[];
    dailyOverrides: DailyOverrideRecord[];
    recurringRules: RecurringRuleRecord[];
    recurringOccurrences: RecurringOccurrenceRecord[];
  };
  initialNotifications: MobileNotificationRecord[];
}

export function NotificationsPageClient({
  initialData,
  initialNotifications,
}: NotificationsPageClientProps) {
  const {
    isHydrated,
    hydrateFromServer,
    settings,
    centerYearMonth,
    dbTransactions,
    dbDailyOverrides,
    recurringRules,
    recurringOccurrences,
    stagedTransactions,
    stagedOverrides,
    stagedDeletedTxIds,
    includeSimulations,
    selectedDayForDetail,
    setSelectedDayForDetail,
  } = useCashflowStore();

  useEffect(() => {
    hydrateFromServer(initialData);
  }, [initialData, hydrateFromServer]);

  const activeSettings = isHydrated ? settings : initialData.settings;
  const activeCenterYM = isHydrated
    ? centerYearMonth
    : initialData.settings.referenceToday.slice(0, 7);

  const visibleYearMonths: [string, string, string] = useMemo(
    () => [
      addMonthsToYearMonth(activeCenterYM, -1),
      activeCenterYM,
      addMonthsToYearMonth(activeCenterYM, 1),
    ],
    [activeCenterYM]
  );

  const mergedTransactions = useMemo(() => {
    const base = isHydrated ? dbTransactions : initialData.transactions;
    const deletedSet = new Set(stagedDeletedTxIds);
    return [
      ...base.filter((t) => !deletedSet.has(t.id)),
      ...stagedTransactions,
    ];
  }, [
    isHydrated,
    dbTransactions,
    initialData.transactions,
    stagedDeletedTxIds,
    stagedTransactions,
  ]);

  const mergedOverrides = useMemo(() => {
    const base = isHydrated ? dbDailyOverrides : initialData.dailyOverrides;
    const map = new Map<string, DailyOverrideRecord>();
    for (const o of base) map.set(o.date, o);
    if (includeSimulations) {
      for (const st of stagedOverrides) map.set(st.date, st);
    }
    return Array.from(map.values());
  }, [
    isHydrated,
    dbDailyOverrides,
    initialData.dailyOverrides,
    stagedOverrides,
    includeSimulations,
  ]);

  const projection = useMemo(
    () =>
      calculateCashflowProjection({
        settings: activeSettings,
        visibleYearMonths,
        transactions: mergedTransactions,
        dailyOverrides: mergedOverrides,
        recurringRules: isHydrated
          ? recurringRules
          : initialData.recurringRules,
        recurringOccurrences: isHydrated
          ? recurringOccurrences
          : initialData.recurringOccurrences,
        includeSimulations,
      }),
    [
      activeSettings,
      visibleYearMonths,
      mergedTransactions,
      mergedOverrides,
      isHydrated,
      recurringRules,
      initialData.recurringRules,
      recurringOccurrences,
      initialData.recurringOccurrences,
      includeSimulations,
    ]
  );

  const currentBalance =
    projection.todayRow?.projectedBalance ?? activeSettings.initialBalance;

  const centerMonthCol = projection.months[1];
  const endOfCenterMonthRow =
    centerMonthCol.days[centerMonthCol.days.length - 1] ?? null;
  const projectedEndOfMonth =
    endOfCenterMonthRow?.projectedBalance ?? currentBalance;

  const selectedDayRow = selectedDayForDetail
    ? projection.allDaysMap[selectedDayForDetail] || null
    : null;

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f6f4] text-[#141f17]">
      <TopNavbar
        currentBalance={currentBalance}
        projectedEndOfMonth={projectedEndOfMonth}
        projectedQuarterEnd={projection.quarterEndRow?.projectedBalance}
        simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
      />

      <main className="flex-1 max-w-4xl w-full mx-auto px-3 py-4 pb-16 space-y-3">
        <div className="flex items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#2d6a3e] hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para a Planilha / Fluxo</span>
          </Link>
        </div>

        <NotificationsValidator
          initialNotifications={initialNotifications}
          allDaysMap={projection.allDaysMap}
          dailyOverrides={mergedOverrides}
          settings={activeSettings}
        />
      </main>

      <LaunchModal currentEndOfMonthBalance={projectedEndOfMonth} />
      <DayDetailDrawer
        dayRow={selectedDayRow}
        onClose={() => setSelectedDayForDetail(null)}
      />
      <SettingsAndRecurringModals />
      <SimulationFloatingBar
        simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
      />
    </div>
  );
}
