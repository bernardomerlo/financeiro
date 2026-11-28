"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  CalendarCheck,
  CalendarRange,
  Dumbbell,
  Footprints,
  HeartPulse,
  LayoutGrid,
  Moon,
  Pill,
  Sparkles,
  Table2,
  Wallet,
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
import { formatBRL, formatFullDate, formatShortDate } from "@/lib/format";
import { formatDurationHoursMinutes } from "@/modules/health/health-sync";
import type { MobileNotificationRecord } from "@/app/actions";
import type { HealthDashboardData } from "@/modules/health/actions";
import type { BujoDayViewData } from "@/modules/bujo/types";
import { TopNavbar } from "@/core/components/top-navbar";

interface HubOverviewClientProps {
  initialCashflowData: {
    settings: CashflowSettings;
    transactions: TransactionRecord[];
    dailyOverrides: DailyOverrideRecord[];
    recurringRules: RecurringRuleRecord[];
    recurringOccurrences: RecurringOccurrenceRecord[];
  };
  initialNotifications: MobileNotificationRecord[];
  initialHealthData: HealthDashboardData;
  initialTodayBujo: BujoDayViewData;
}

export function HubOverviewClient({
  initialCashflowData,
  initialNotifications,
  initialHealthData,
  initialTodayBujo,
}: HubOverviewClientProps) {
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

  const pendingNotificationsCount = initialNotifications.filter(
    (n) => n.status === "pending"
  ).length;

  const latestSleep = initialHealthData.sleeps[0] ?? null;
  const totalExercises = initialHealthData.exercises.length;
  const totalExerciseMinutes = initialHealthData.exercises.reduce(
    (acc, e) => acc + e.durationMinutes,
    0
  );
  const totalCalories = Math.round(
    initialHealthData.exercises.reduce(
      (acc, e) => acc + (e.caloriesKcal ?? 0),
      0
    )
  );

  const todayAllTasks = [
    ...initialTodayBujo.annualCommitments,
    ...initialTodayBujo.dayTasks,
  ];
  const todayPendingCount = todayAllTasks.filter(
    (t) => t.status === "todo"
  ).length;
  const todayDoneCount = todayAllTasks.filter(
    (t) => t.status === "done"
  ).length;

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f6f4] text-[#141f17]">
      <TopNavbar
        currentBalance={currentBalance}
        projectedEndOfMonth={projectedEndOfMonth}
        projectedQuarterEnd={projection.quarterEndRow?.projectedBalance}
        simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 py-5 pb-16 space-y-4">
        {/* Hub Banner + Today Cockpit */}
        <div className="bg-white rounded-xl border border-[#cfd8d2] p-4 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#2d6a3e] text-white flex items-center justify-center shrink-0">
                <LayoutGrid className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-[#141f17]">
                  Personal Hub • Cockpit de Hoje
                </h1>
                <p className="text-xs text-[#526657] capitalize">
                  {formatFullDate(initialTodayBujo.date)}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <Link
                href="/bujo"
                className="h-8 px-3 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center gap-1.5"
              >
                <BookOpenCheck className="w-3.5 h-3.5" />
                <span>Abrir BuJo de Hoje</span>
              </Link>
              <Link
                href="/financeiro"
                className="h-8 px-3 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-xs font-semibold text-[#141f17] flex items-center gap-1.5"
              >
                <Wallet className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Planilha Financeira</span>
              </Link>
            </div>
          </div>

          {/* Unified Today Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 pt-2 border-t border-[#e4ebe6]">
            <Link
              href="/bujo"
              className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] hover:border-[#2d6a3e] transition-colors"
            >
              <div className="text-[11px] text-[#526657] font-medium flex items-center gap-1">
                <CalendarCheck className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Tarefas Hoje</span>
              </div>
              <div className="text-sm font-extrabold text-[#141f17] mt-0.5 tabular-nums">
                {todayPendingCount} pendente(s) • {todayDoneCount} feita(s)
              </div>
              {initialTodayBujo.rolledOverTasks.length > 0 && (
                <div className="text-[10px] font-semibold text-[#7c5800] mt-0.5">
                  +{initialTodayBujo.rolledOverTasks.length} rolada(s) de ontem
                </div>
              )}
            </Link>

            <Link
              href="/saude"
              className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] hover:border-[#2d6a3e] transition-colors"
            >
              <div className="text-[11px] text-[#526657] font-medium flex items-center gap-1">
                <Moon className="w-3.5 h-3.5 text-[#0284c7]" />
                <span>Sono Hoje</span>
              </div>
              <div className="text-sm font-extrabold text-[#141f17] mt-0.5 tabular-nums">
                {initialTodayBujo.sleep.minutes != null
                  ? formatDurationHoursMinutes(initialTodayBujo.sleep.minutes)
                  : "Aguardando sync"}
                {initialTodayBujo.sleep.score != null
                  ? ` (Score ${initialTodayBujo.sleep.score})`
                  : ""}
              </div>
            </Link>

            <Link
              href="/bujo"
              className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] hover:border-[#2d6a3e] transition-colors"
            >
              <div className="text-[11px] text-[#526657] font-medium">
                Hábitos de Hoje
              </div>
              <div className="flex items-center gap-2 mt-1 text-xs font-bold">
                <span
                  className={
                    initialTodayBujo.gym.value
                      ? "text-[#1b5e20]"
                      : "text-[#9aa89e]"
                  }
                  title="Academia"
                >
                  <Dumbbell className="w-4 h-4 inline" />
                </span>
                <span
                  className={
                    initialTodayBujo.cardio.value
                      ? "text-[#0369a1]"
                      : "text-[#9aa89e]"
                  }
                  title="Cardio"
                >
                  <Footprints className="w-4 h-4 inline" />
                </span>
                <span
                  className={
                    initialTodayBujo.vitamin
                      ? "text-[#6b21a8]"
                      : "text-[#9aa89e]"
                  }
                  title="Vitamina"
                >
                  <Pill className="w-4 h-4 inline" />
                </span>
                <span
                  className={
                    initialTodayBujo.reading.value
                      ? "text-[#7c5800]"
                      : "text-[#9aa89e]"
                  }
                  title="Leitura"
                >
                  <BookOpen className="w-4 h-4 inline" />
                </span>
              </div>
            </Link>

            <Link
              href="/financeiro"
              className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] hover:border-[#2d6a3e] transition-colors"
            >
              <div className="text-[11px] text-[#526657] font-medium">
                Diário Hoje / Saldo
              </div>
              <div className="text-sm font-extrabold text-[#141f17] mt-0.5 tabular-nums">
                {formatBRL(initialTodayBujo.financeSummary.dailySpent)} /{" "}
                {formatBRL(currentBalance)}
              </div>
            </Link>
          </div>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
          {/* MODULE 1: BULLET JOURNAL */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-4 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] flex items-center justify-center">
                    <BookOpenCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#141f17]">
                      Bullet Journal
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Diário, Hábitos, Log Anual & Heatmap
                    </p>
                  </div>
                </div>
              </div>

              <div className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] text-xs space-y-1">
                <div className="text-[11px] text-[#526657]">
                  Considerações de Hoje:
                </div>
                <div className="text-[#141f17] line-clamp-2 font-medium">
                  {initialTodayBujo.todayNote.trim() ||
                    "Nada escrito para hoje ainda — clique para escrever."}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#e4ebe6]">
              <Link
                href="/bujo"
                className="h-8 px-2 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center justify-center gap-1"
              >
                <span>Diário</span>
              </Link>
              <Link
                href="/bujo/mes"
                className="h-8 px-2 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-[#141f17] text-xs font-semibold flex items-center justify-center gap-1"
              >
                <CalendarRange className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Mês</span>
              </Link>
              <Link
                href="/bujo/anual"
                className="h-8 px-2 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-[#141f17] text-xs font-semibold flex items-center justify-center gap-1"
              >
                <Sparkles className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Anual</span>
              </Link>
            </div>
          </div>

          {/* MODULE 2: FINANCEIRO */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-4 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#141f17]">
                      Financeiro (CashFlow)
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Fluxo trimestral & MacroDroid
                    </p>
                  </div>
                </div>
                {pendingNotificationsCount > 0 && (
                  <Link
                    href="/financeiro/notificacoes"
                    className="px-2 py-0.5 rounded-full bg-[#1b5e20] text-white text-[10px] font-bold"
                  >
                    {pendingNotificationsCount}
                  </Link>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                  <div className="text-[11px] font-medium text-[#526657]">
                    Saldo Hoje
                  </div>
                  <div className="text-sm font-extrabold text-[#141f17] tabular-nums">
                    {formatBRL(currentBalance)}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                  <div className="text-[11px] font-medium text-[#526657]">
                    Fim do Mês
                  </div>
                  <div className="text-sm font-extrabold text-[#141f17] tabular-nums">
                    {formatBRL(projectedEndOfMonth)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#e4ebe6]">
              <Link
                href="/financeiro"
                className="h-8 px-2 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center justify-center gap-1"
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>Fluxo</span>
              </Link>
              <Link
                href="/financeiro/insights"
                className="h-8 px-2 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-[#141f17] text-xs font-semibold flex items-center justify-center gap-1"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Metas</span>
              </Link>
              <Link
                href="/financeiro/notificacoes"
                className="h-8 px-2 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-[#141f17] text-xs font-semibold flex items-center justify-center gap-1"
              >
                <Bell className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Notif.</span>
              </Link>
            </div>
          </div>

          {/* MODULE 3: SAMSUNG HEALTH */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-4 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] flex items-center justify-center">
                    <HeartPulse className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#141f17]">
                      Samsung Health
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Sono & Exercícios (S24 Ultra)
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                  <div className="text-[11px] font-medium text-[#526657]">
                    Último Sono
                  </div>
                  <div className="text-sm font-extrabold text-[#141f17] tabular-nums">
                    {latestSleep
                      ? `${formatDurationHoursMinutes(
                          latestSleep.durationMinutes
                        )}${
                          latestSleep.sleepScore != null
                            ? ` (${latestSleep.sleepScore})`
                            : ""
                        }`
                      : "Sem sync"}
                  </div>
                  {latestSleep && (
                    <div className="text-[10px] text-[#526657]">
                      {formatShortDate(latestSleep.date)}
                    </div>
                  )}
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                  <div className="text-[11px] font-medium text-[#526657]">
                    Exercícios
                  </div>
                  <div className="text-sm font-extrabold text-[#141f17] tabular-nums">
                    {totalExercises > 0
                      ? `${totalExercises} (${formatDurationHoursMinutes(
                          totalExerciseMinutes
                        )})`
                      : "0 treinos"}
                  </div>
                  {totalCalories > 0 && (
                    <div className="text-[10px] text-[#526657]">
                      {totalCalories} kcal
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#e4ebe6]">
              <Link
                href="/saude"
                className="flex-1 h-8 px-3 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <span>Abrir Painel de Saúde</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
