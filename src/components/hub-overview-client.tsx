"use client";

import React, { useEffect, useMemo } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Dumbbell,
  Flame,
  HeartPulse,
  LayoutGrid,
  Moon,
  Smartphone,
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
import { formatBRL, formatShortDate } from "@/lib/format";
import { formatDurationHoursMinutes } from "@/lib/health-sync";
import type {
  HealthDashboardData,
  MobileNotificationRecord,
} from "@/app/actions";
import { TopNavbar } from "./top-navbar";

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
}

export function HubOverviewClient({
  initialCashflowData,
  initialNotifications,
  initialHealthData,
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

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f6f4] text-[#141f17]">
      <TopNavbar
        currentBalance={currentBalance}
        projectedEndOfMonth={projectedEndOfMonth}
        projectedQuarterEnd={projection.quarterEndRow?.projectedBalance}
        simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
      />

      <main className="flex-1 max-w-5xl w-full mx-auto px-3 py-5 pb-16 space-y-4">
        {/* Hub Banner */}
        <div className="bg-white rounded-xl border border-[#cfd8d2] p-4 shadow-2xs flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#2d6a3e] text-white flex items-center justify-center shrink-0">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-extrabold text-[#141f17]">
                Personal Hub • Central de Módulos
              </h1>
              <p className="text-xs text-[#526657]">
                Visão unificada das suas finanças, automações mobile e saúde
                (Samsung Health)
              </p>
            </div>
          </div>
          <div className="text-xs font-semibold text-[#526657] bg-[#eff3f0] px-3 py-1.5 rounded-lg border border-[#d5ded8]">
            Hoje • {formatShortDate(activeSettings.referenceToday)}
          </div>
        </div>

        {/* Modules Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
          {/* MODULE 1: FINANCEIRO */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-4 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] flex items-center justify-center">
                    <Wallet className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#141f17]">
                      Módulo Financeiro (CashFlow)
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Planilha trimestral, metas diárias e webhook MacroDroid
                    </p>
                  </div>
                </div>
                {pendingNotificationsCount > 0 && (
                  <Link
                    href="/notificacoes"
                    className="px-2 py-0.5 rounded-full bg-[#1b5e20] text-white text-[10px] font-bold"
                  >
                    {pendingNotificationsCount} pendente(s)
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
                    Projeção Fim do Mês
                  </div>
                  <div className="text-sm font-extrabold text-[#141f17] tabular-nums">
                    {formatBRL(projectedEndOfMonth)}
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-1.5 pt-2 border-t border-[#e4ebe6]">
              <Link
                href="/"
                className="h-8 px-2.5 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center justify-center gap-1"
              >
                <Table2 className="w-3.5 h-3.5" />
                <span>Planilha</span>
              </Link>
              <Link
                href="/insights"
                className="h-8 px-2.5 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-[#141f17] text-xs font-semibold flex items-center justify-center gap-1"
              >
                <BarChart3 className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Dashboards</span>
              </Link>
              <Link
                href="/notificacoes"
                className="h-8 px-2.5 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-[#141f17] text-xs font-semibold flex items-center justify-center gap-1"
              >
                <Bell className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Notificações</span>
              </Link>
            </div>
          </div>

          {/* MODULE 2: SAMSUNG HEALTH */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-4 shadow-2xs flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] flex items-center justify-center">
                    <HeartPulse className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-sm font-extrabold text-[#141f17]">
                      Módulo Samsung Health
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Sincronização automática de Sono (Sleep Score) e Exercícios
                    </p>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full bg-[#eff3f0] border border-[#d5ded8] text-[10px] font-bold text-[#2d6a3e]">
                  /api/health/sync
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                  <div className="text-[11px] font-medium text-[#526657] flex items-center gap-1">
                    <Moon className="w-3 h-3 text-[#2d6a3e]" />
                    <span>Último Sono</span>
                  </div>
                  <div className="text-sm font-extrabold text-[#141f17] tabular-nums">
                    {latestSleep
                      ? `${formatDurationHoursMinutes(
                          latestSleep.durationMinutes
                        )}${
                          latestSleep.sleepScore != null
                            ? ` (Score ${latestSleep.sleepScore})`
                            : ""
                        }`
                      : "Aguardando sync"}
                  </div>
                </div>
                <div className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                  <div className="text-[11px] font-medium text-[#526657] flex items-center gap-1">
                    <Dumbbell className="w-3 h-3 text-[#2d6a3e]" />
                    <span>Exercícios</span>
                  </div>
                  <div className="text-sm font-extrabold text-[#141f17] tabular-nums">
                    {totalExercises > 0
                      ? `${totalExercises} (${formatDurationHoursMinutes(
                          totalExerciseMinutes
                        )} • ${totalCalories} kcal)`
                      : "0 treinos"}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-[#e4ebe6]">
              <Link
                href="/saude"
                className="flex-1 h-8 px-3 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center justify-center gap-1.5"
              >
                <span>Abrir Painel de Saúde & Configurar Celular</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
