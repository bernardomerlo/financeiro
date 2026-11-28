"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpenCheck,
  CalendarDays,
  CalendarRange,
  Sparkles,
} from "lucide-react";
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
import { TopNavbar } from "@/core/components/top-navbar";

interface BujoShellProps {
  initialCashflowData: {
    settings: CashflowSettings;
    transactions: TransactionRecord[];
    dailyOverrides: DailyOverrideRecord[];
    recurringRules: RecurringRuleRecord[];
    recurringOccurrences: RecurringOccurrenceRecord[];
  };
  activeDate?: string;
  activeYearMonth?: string;
  activeYear?: number;
  children: React.ReactNode;
}

export function BujoShell({
  initialCashflowData,
  activeDate,
  activeYearMonth,
  activeYear,
  children,
}: BujoShellProps) {
  const pathname = usePathname();
  const router = useRouter();

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
  } = useCashflowStore();

  useEffect(() => {
    hydrateFromServer(initialCashflowData);
  }, [initialCashflowData, hydrateFromServer]);

  const activeSettings = isHydrated ? settings : initialCashflowData.settings;
  const activeCenterYM = isHydrated
    ? centerYearMonth
    : initialCashflowData.settings.referenceToday.slice(0, 7);

  const visibleYearMonths: [string, string, string] = useMemo(
    () => [
      addMonthsToYearMonth(activeCenterYM, -1),
      activeCenterYM,
      addMonthsToYearMonth(activeCenterYM, 1),
    ],
    [activeCenterYM]
  );

  const mergedTransactions = useMemo(() => {
    const base = isHydrated
      ? dbTransactions
      : initialCashflowData.transactions;
    const deletedSet = new Set(stagedDeletedTxIds);
    return [
      ...base.filter((t) => !deletedSet.has(t.id)),
      ...stagedTransactions,
    ];
  }, [
    isHydrated,
    dbTransactions,
    initialCashflowData.transactions,
    stagedDeletedTxIds,
    stagedTransactions,
  ]);

  const mergedOverrides = useMemo(() => {
    const base = isHydrated
      ? dbDailyOverrides
      : initialCashflowData.dailyOverrides;
    const map = new Map<string, DailyOverrideRecord>();
    for (const o of base) map.set(o.date, o);
    if (includeSimulations) {
      for (const st of stagedOverrides) map.set(st.date, st);
    }
    return Array.from(map.values());
  }, [
    isHydrated,
    dbDailyOverrides,
    initialCashflowData.dailyOverrides,
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
          : initialCashflowData.recurringRules,
        recurringOccurrences: isHydrated
          ? recurringOccurrences
          : initialCashflowData.recurringOccurrences,
        includeSimulations,
      }),
    [
      activeSettings,
      visibleYearMonths,
      mergedTransactions,
      mergedOverrides,
      isHydrated,
      recurringRules,
      initialCashflowData.recurringRules,
      recurringOccurrences,
      initialCashflowData.recurringOccurrences,
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

  const refDate = activeDate || activeSettings.referenceToday;
  const refYearMonth = activeYearMonth || refDate.slice(0, 7);
  const refYear = activeYear || Number(refYearMonth.slice(0, 4));

  const isMonthTab = pathname.startsWith("/bujo/mes");
  const isAnnualTab = pathname.startsWith("/bujo/anual");
  const isDayTab = !isMonthTab && !isAnnualTab;

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f6f4] text-[#141f17]">
      <TopNavbar
        currentBalance={currentBalance}
        projectedEndOfMonth={projectedEndOfMonth}
        projectedQuarterEnd={projection.quarterEndRow?.projectedBalance}
        simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 py-4 pb-16 space-y-3">
        {/* BuJo Module Sub-Navigation */}
        <div className="bg-white rounded-xl border border-[#cfd8d2] p-2.5 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2">
              <BookOpenCheck className="w-4 h-4 text-[#2d6a3e]" />
              <span className="text-xs font-extrabold text-[#141f17]">
                Bullet Journal
              </span>
            </div>

            <nav className="flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
              <Link
                href={`/bujo/${activeSettings.referenceToday}`}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isDayTab
                    ? "bg-white text-[#141f17] shadow-2xs"
                    : "text-[#4e6153] hover:text-[#141f17]"
                }`}
              >
                <CalendarDays className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Diário</span>
              </Link>

              <Link
                href={`/bujo/mes/${refYearMonth}`}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isMonthTab
                    ? "bg-white text-[#141f17] shadow-2xs"
                    : "text-[#4e6153] hover:text-[#141f17]"
                }`}
              >
                <CalendarRange className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Mensal</span>
              </Link>

              <Link
                href={`/bujo/anual/${refYear}`}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                  isAnnualTab
                    ? "bg-white text-[#141f17] shadow-2xs"
                    : "text-[#4e6153] hover:text-[#141f17]"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Log Anual</span>
              </Link>
            </nav>
          </div>

          <div className="flex items-center gap-1.5">
            {isDayTab && (
              <input
                type="date"
                value={refDate}
                onChange={(e) => {
                  if (e.target.value) {
                    router.push(`/bujo/${e.target.value}`);
                  }
                }}
                className="h-8 px-2 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] text-xs font-semibold text-[#141f17]"
                title="Ir para outra data"
              />
            )}
            <Link
              href="/bujo"
              className="h-8 px-2.5 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-xs font-bold text-[#2d6a3e] flex items-center"
            >
              Hoje
            </Link>
          </div>
        </div>

        {children}
      </main>
    </div>
  );
}
