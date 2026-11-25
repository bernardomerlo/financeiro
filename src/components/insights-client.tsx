"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  SlidersHorizontal,
  FlaskConical,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  ShieldCheck,
  AlertTriangle,
  Calendar,
  PiggyBank,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  addMonthsToYearMonth,
  calculateCashflowProjection,
  type CashflowSettings,
  type ComputedDayRow,
  type DailyOverrideRecord,
  type RecurringOccurrenceRecord,
  type RecurringRuleRecord,
  type TransactionRecord,
} from "@/lib/cashflow-engine";
import { formatBRL, formatFullDate, formatShortDate } from "@/lib/format";
import { TopNavbar } from "./top-navbar";
import { LaunchModal } from "./launch-modal";
import { DayDetailDrawer } from "./day-detail-drawer";
import { SettingsAndRecurringModals } from "./settings-and-recurring-modals";
import { SimulationFloatingBar } from "./simulation-floating-bar";

interface InsightsClientProps {
  initialData: {
    settings: CashflowSettings;
    transactions: TransactionRecord[];
    dailyOverrides: DailyOverrideRecord[];
    recurringRules: RecurringRuleRecord[];
    recurringOccurrences: RecurringOccurrenceRecord[];
  };
}

export function InsightsClient({ initialData }: InsightsClientProps) {
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
    setSettingsModalOpen,
    applyTemporaryDailyTargetInMemory,
    addStagedSimulation,
    stageDailyOverride,
    selectedDayForDetail,
    setSelectedDayForDetail,
  } = useCashflowStore();

  const [hoveredCurveDay, setHoveredCurveDay] = useState<ComputedDayRow | null>(
    null
  );

  useEffect(() => {
    if (!isHydrated) {
      hydrateFromServer(initialData);
    }
  }, [isHydrated, initialData, hydrateFromServer]);

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
    return [...base.filter((t) => !deletedSet.has(t.id)), ...stagedTransactions];
  }, [isHydrated, dbTransactions, initialData.transactions, stagedDeletedTxIds, stagedTransactions]);

  const mergedOverrides = useMemo(() => {
    const base = isHydrated ? dbDailyOverrides : initialData.dailyOverrides;
    const map = new Map<string, DailyOverrideRecord>();
    for (const o of base) map.set(o.date, o);
    if (includeSimulations) {
      for (const st of stagedOverrides) map.set(st.date, st);
    }
    return Array.from(map.values());
  }, [isHydrated, dbDailyOverrides, initialData.dailyOverrides, stagedOverrides, includeSimulations]);

  const projection = useMemo(
    () =>
      calculateCashflowProjection({
        settings: activeSettings,
        visibleYearMonths,
        transactions: mergedTransactions,
        dailyOverrides: mergedOverrides,
        recurringRules: isHydrated ? recurringRules : initialData.recurringRules,
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

  const activeMonthCol = projection.months[1];
  const currentBalance =
    projection.todayRow?.projectedBalance ?? activeSettings.initialBalance;
  const projectedEndOfMonth =
    activeMonthCol.days[activeMonthCol.days.length - 1]?.projectedBalance ??
    currentBalance;

  const allQuarterDays = useMemo(
    () => [
      ...projection.months[0].days,
      ...projection.months[1].days,
      ...projection.months[2].days,
    ],
    [projection.months]
  );

  const selectedDayRow = selectedDayForDetail
    ? projection.allDaysMap[selectedDayForDetail] || null
    : null;

  const metrics = useMemo(() => {
    const daysElapsedOrToday = activeMonthCol.days.filter(
      (d) => d.isPast || d.isToday
    );
    const futureDays = activeMonthCol.days.filter((d) => d.isFuture);
    const effectiveDays =
      daysElapsedOrToday.length > 0 ? daysElapsedOrToday : activeMonthCol.days;

    const targetPerDay = activeSettings.dailySpendingTarget;
    const totalAllowedToDate = Number(
      (effectiveDays.length * targetPerDay).toFixed(2)
    );
    const totalSpentToDate = Number(
      effectiveDays.reduce((acc, d) => acc + d.dailyAmount, 0).toFixed(2)
    );

    const netSavingsToDate = Number(
      (totalAllowedToDate - totalSpentToDate).toFixed(2)
    );
    const averageActualDaily =
      effectiveDays.length > 0
        ? Number((totalSpentToDate / effectiveDays.length).toFixed(2))
        : 0;

    const daysWithinTarget = effectiveDays.filter(
      (d) => d.dailyAmount <= targetPerDay
    ).length;
    const daysOverTarget = effectiveDays.length - daysWithinTarget;
    const adherencePct =
      effectiveDays.length > 0
        ? Number(((daysWithinTarget / effectiveDays.length) * 100).toFixed(1))
        : 100;

    const lowestDay = activeMonthCol.lowestBalanceDay;

    // 1. Weekday vs Weekend pattern analysis across all past/today days of the quarter
    const pastQuarterDays = allQuarterDays.filter((d) => d.isPast || d.isToday);
    let weekdaySum = 0;
    let weekdayCount = 0;
    let weekendSum = 0;
    let weekendCount = 0;

    for (const d of pastQuarterDays) {
      const dow = new Date(`${d.date}T00:00:00`).getDay();
      if (dow === 0 || dow === 6) {
        weekendSum += d.dailyAmount;
        weekendCount++;
      } else {
        weekdaySum += d.dailyAmount;
        weekdayCount++;
      }
    }

    const weekdayAvg =
      weekdayCount > 0 ? Number((weekdaySum / weekdayCount).toFixed(2)) : 0;
    const weekendAvg =
      weekendCount > 0 ? Number((weekendSum / weekendCount).toFixed(2)) : 0;

    // 2. Top Outliers (> targetPerDay) in active month
    const outlierDays = [...effectiveDays]
      .filter((d) => d.dailyAmount > targetPerDay)
      .sort((a, b) => b.dailyAmount - a.dailyAmount);

    const top3OutliersExcess = Number(
      outlierDays
        .slice(0, 3)
        .reduce((acc, d) => acc + (d.dailyAmount - targetPerDay), 0)
        .toFixed(2)
    );

    // 3. Pre-salary liquidity protection window (days in current month where balance < 1500)
    const criticalFutureDays = futureDays.filter(
      (d) => d.projectedBalance < 1500
    );
    const lowestFutureBalance =
      lowestDay?.projectedBalance ?? projectedEndOfMonth;
    const deficitToYellowZone = Math.max(
      0,
      Number((1500 - lowestFutureBalance).toFixed(2))
    );

    // 4. Safe Investment Capacity (Colchão de Segurança R$ 2.000)
    const quarterMinAfterToday = Math.min(
      ...allQuarterDays
        .filter((d) => !d.isPast)
        .map((d) => d.projectedBalance)
    );
    const nextMonthDays = projection.months[2].days;
    const nextMonthMinBalance = Math.min(
      ...nextMonthDays.map((d) => d.projectedBalance)
    );
    const safeInvestmentNextMonth = Math.max(
      0,
      Math.floor((nextMonthMinBalance - 2000) / 50) * 50
    );

    // Suggested Daily Target
    const desiredSafetyFloor = 1500;
    const minBalance = lowestDay?.projectedBalance ?? projectedEndOfMonth;
    const remainingDaysCount = Math.max(1, futureDays.length);
    const cushionDelta = minBalance - desiredSafetyFloor;
    const rawSuggestedDaily = targetPerDay + cushionDelta / remainingDaysCount;
    const suggestedDailyTarget = Math.max(
      0,
      Math.round(rawSuggestedDaily / 5) * 5
    );

    let runningAllowed = 0;
    let runningSpent = 0;
    const auditRows = activeMonthCol.days.map((d) => {
      runningAllowed = Number((runningAllowed + d.dailyTarget).toFixed(2));
      runningSpent = Number((runningSpent + d.dailyAmount).toFixed(2));
      const dayDiff = Number((d.dailyTarget - d.dailyAmount).toFixed(2));
      const cumulativeDiff = Number((runningAllowed - runningSpent).toFixed(2));
      return {
        day: d,
        runningAllowed,
        runningSpent,
        dayDiff,
        cumulativeDiff,
      };
    });

    return {
      effectiveDaysCount: effectiveDays.length,
      futureDays,
      targetPerDay,
      totalAllowedToDate,
      totalSpentToDate,
      netSavingsToDate,
      averageActualDaily,
      daysWithinTarget,
      daysOverTarget,
      adherencePct,
      lowestDay,
      suggestedDailyTarget,
      weekdayAvg,
      weekendAvg,
      outlierDays,
      top3OutliersExcess,
      criticalFutureDays,
      deficitToYellowZone,
      quarterMinAfterToday,
      safeInvestmentNextMonth,
      auditRows,
    };
  }, [
    activeMonthCol,
    activeSettings.dailySpendingTarget,
    projectedEndOfMonth,
    allQuarterDays,
    projection.months,
  ]);

  function handleSimulateSuggestedTarget() {
    if (metrics.futureDays.length === 0) return;
    const start = metrics.futureDays[0].date;
    const end = metrics.futureDays[metrics.futureDays.length - 1].date;
    applyTemporaryDailyTargetInMemory(metrics.suggestedDailyTarget, start, end);
    toast.success(`Meta de ${formatBRL(metrics.suggestedDailyTarget)}/dia simulada.`);
  }

  function handleSimulatePreSalaryProtection() {
    // Zero or reduce daily spend on critical future days before salary (e.g. 25/11 to 29/11) to R$ 15/day
    const targetDays =
      metrics.criticalFutureDays.length > 0
        ? metrics.criticalFutureDays
        : metrics.futureDays;
    for (const d of targetDays) {
      stageDailyOverride(d.date, 15);
    }
    toast.success(
      `Simulado teto de R$ 15,00/dia em ${targetDays.length} dias críticos.`
    );
  }

  function handleSimulateNextMonthAporte() {
    if (metrics.safeInvestmentNextMonth <= 0) return;
    const nextMonthFirstDay = projection.months[2].days[0]?.date;
    if (!nextMonthFirstDay) return;
    addStagedSimulation({
      date: nextMonthFirstDay,
      type: "expense_fixed",
      amount: metrics.safeInvestmentNextMonth,
      description: "Aporte Reserva / Investimento",
      category: "Outros",
      paymentMethod: "cash",
      installments: 1,
    });
    toast.success(
      `Aporte de ${formatBRL(metrics.safeInvestmentNextMonth)} simulado em ${formatShortDate(
        nextMonthFirstDay
      )}.`
    );
  }

  function handleSimulateWeekdayPatternInDecember() {
    const decDays = projection.months[2].days;
    for (const d of decDays) {
      const dow = new Date(`${d.date}T00:00:00`).getDay();
      const simVal = dow === 0 || dow === 6 ? 50 : 28;
      stageDailyOverride(d.date, simVal);
    }
    toast.success(
      `Simulado padrão R$ 28 (úteis) / R$ 50 (fim de semana) em ${projection.months[2].title}.`
    );
  }

  const maxChartDaily = Math.max(
    100,
    activeSettings.dailySpendingTarget * 1.6,
    ...activeMonthCol.days.map((d) => d.dailyAmount)
  );

  // 90-Day SVG Waterline Coordinates
  const svgCurve = useMemo(() => {
    const width = 920;
    const height = 150;
    const padY = 14;
    const balances = allQuarterDays.flatMap((d) => [
      d.projectedBalance,
      d.realBalance,
      1000,
      3000,
    ]);
    const minB = Math.min(0, ...balances);
    const maxB = Math.max(4000, ...balances);
    const range = Math.max(1, maxB - minB);

    const toX = (idx: number) =>
      allQuarterDays.length > 1
        ? (idx / (allQuarterDays.length - 1)) * width
        : 0;
    const toY = (val: number) =>
      height - padY - ((val - minB) / range) * (height - padY * 2);

    const projectedPoints = allQuarterDays
      .map((d, i) => `${toX(i).toFixed(1)},${toY(d.projectedBalance).toFixed(1)}`)
      .join(" ");

    const realPoints = allQuarterDays
      .map((d, i) => `${toX(i).toFixed(1)},${toY(d.realBalance).toFixed(1)}`)
      .join(" ");

    const areaPath = `M 0,${height} L ${projectedPoints
      .split(" ")
      .join(" L ")} L ${width},${height} Z`;

    const todayIdx = allQuarterDays.findIndex((d) => d.isToday);
    const todayX = todayIdx >= 0 ? toX(todayIdx) : null;

    return {
      width,
      height,
      projectedPoints,
      realPoints,
      areaPath,
      y3000: toY(3000),
      y1500: toY(1500),
      todayX,
      toX,
      toY,
    };
  }, [allQuarterDays]);

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f6f4] text-[#141f17]">
      <TopNavbar
        currentBalance={currentBalance}
        projectedEndOfMonth={projectedEndOfMonth}
        projectedQuarterEnd={projection.quarterEndRow?.projectedBalance}
        simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
      />

      <main className="max-w-7xl w-full mx-auto px-4 py-4 space-y-4 flex-1">
        {/* Top Header */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <Link
              href="/"
              className="h-8 px-2.5 rounded-lg bg-white border border-[#cfd8d2] hover:bg-[#eff3f0] text-xs font-semibold text-[#141f17] flex items-center gap-1 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Fluxo</span>
            </Link>
            <h1 className="text-base font-bold text-[#141f17]">
              Metas & Insights • {activeMonthCol.title}
            </h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSimulateSuggestedTarget}
              className="h-8 px-3 rounded-lg bg-[#fdf6e2] hover:bg-[#faeec9] border border-[#d9c27e] text-[#5c4300] text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              <span>
                Simular Meta Sugerida ({formatBRL(metrics.suggestedDailyTarget)}/dia)
              </span>
            </button>
            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="h-8 px-3 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>Meta: {formatBRL(metrics.targetPerDay)}</span>
            </button>
          </div>
        </div>

        {/* 5 Core KPIs */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-2.5">
          <div className="bg-white p-3.5 rounded-lg border border-[#cfd8d2]">
            <div className="text-[11px] font-semibold text-[#526657]">Meta Diária</div>
            <div className="text-lg font-bold text-[#141f17] mt-1">
              {formatBRL(metrics.targetPerDay)}
            </div>
            <div className="text-[11px] text-[#526657] mt-0.5">
              Teto Mês: {formatBRL(metrics.targetPerDay * activeMonthCol.days.length)}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-[#cfd8d2]">
            <div className="text-[11px] font-semibold text-[#526657]">
              Média Real ({metrics.effectiveDaysCount}d)
            </div>
            <div
              className={`text-lg font-bold mt-1 ${
                metrics.averageActualDaily <= metrics.targetPerDay
                  ? "text-[#1b5e20]"
                  : "text-[#9e1c1c]"
              }`}
            >
              {formatBRL(metrics.averageActualDaily)}
            </div>
            <div className="text-[11px] text-[#526657] mt-0.5">
              Úteis: {formatBRL(metrics.weekdayAvg)} • FDS: {formatBRL(metrics.weekendAvg)}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-[#cfd8d2]">
            <div className="text-[11px] font-semibold text-[#526657]">
              Poderia Gastar x Gastou
            </div>
            <div
              className={`text-lg font-bold mt-1 ${
                metrics.netSavingsToDate >= 0 ? "text-[#1b5e20]" : "text-[#9e1c1c]"
              }`}
            >
              {formatBRL(metrics.netSavingsToDate, true)}
            </div>
            <div className="text-[11px] text-[#526657] mt-0.5">
              {formatBRL(metrics.totalAllowedToDate)} x {formatBRL(metrics.totalSpentToDate)}
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-[#cfd8d2]">
            <div className="text-[11px] font-semibold text-[#526657]">Dias no Teto</div>
            <div className="text-lg font-bold text-[#141f17] mt-1">
              {metrics.daysWithinTarget} / {metrics.effectiveDaysCount}
            </div>
            <div className="text-[11px] text-[#526657] mt-0.5">
              {metrics.adherencePct}% ({metrics.daysOverTarget} acima)
            </div>
          </div>

          <div className="bg-white p-3.5 rounded-lg border border-[#cfd8d2]">
            <div className="text-[11px] font-semibold text-[#526657]">Menor Saldo no Mês</div>
            <div className="text-lg font-bold text-[#141f17] mt-1">
              {metrics.lowestDay ? formatBRL(metrics.lowestDay.projectedBalance) : "-"}
            </div>
            <div className="text-[11px] text-[#526657] mt-0.5">
              Dia {metrics.lowestDay ? formatShortDate(metrics.lowestDay.date) : "-"}
            </div>
          </div>
        </div>

        {/* INSIGHTS DE MELHORIAS (4 Actionable Optimization Cards with 1-Click Simulation) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Card 1: Padrão Dias Úteis vs Fim de Semana */}
          <div className="bg-white p-3.5 rounded-lg border border-[#cfd8d2] flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#141f17] flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>Ritmo Dias Úteis x FDS</span>
                </span>
                <span className="text-[11px] font-bold text-[#1b5e20] bg-[#e8f5e9] px-1.5 py-0.2 rounded">
                  +R$ 484/mês
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#526657]">Média Seg-Sex:</span>
                  <span className="font-semibold text-[#141f17]">
                    {formatBRL(metrics.weekdayAvg)}/dia
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526657]">Média Sáb-Dom:</span>
                  <span className="font-semibold text-[#7c5800]">
                    {formatBRL(metrics.weekendAvg)}/dia
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSimulateWeekdayPatternInDecember}
              className="w-full h-8 px-2.5 rounded-md bg-[#eff3f0] hover:bg-[#dce6df] text-[#141f17] border border-[#cfd8d2] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <FlaskConical className="w-3 h-3 text-[#2d6a3e]" />
              <span>Projetar R$ 28 / R$ 50 em {projection.months[2].title.split(" ")[0]}</span>
            </button>
          </div>

          {/* Card 2: Janela Pré-Salário (24/11 a 29/11) */}
          <div className="bg-white p-3.5 rounded-lg border border-[#cfd8d2] flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#141f17] flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 text-[#e68a00]" />
                  <span>Vale Pré-Salário</span>
                </span>
                <span className="text-[11px] font-bold text-[#8c3d00] bg-[#fff3e0] px-1.5 py-0.2 rounded">
                  {metrics.lowestDay ? formatShortDate(metrics.lowestDay.date) : "-"}
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#526657]">Piso projetado:</span>
                  <span className="font-semibold text-[#8c3d00]">
                    {metrics.lowestDay ? formatBRL(metrics.lowestDay.projectedBalance) : "-"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526657]">Falta p/ faixa 1,5k:</span>
                  <span className="font-semibold text-[#141f17]">
                    {formatBRL(metrics.deficitToYellowZone)}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSimulatePreSalaryProtection}
              className="w-full h-8 px-2.5 rounded-md bg-[#fdf6e2] hover:bg-[#faeec9] text-[#5c4300] border border-[#d9c27e] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
            >
              <FlaskConical className="w-3 h-3" />
              <span>Simular R$ 15/dia até Salário</span>
            </button>
          </div>

          {/* Card 3: Capacidade de Aporte Seguro */}
          <div className="bg-white p-3.5 rounded-lg border border-[#cfd8d2] flex flex-col justify-between gap-2.5">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#141f17] flex items-center gap-1.5">
                  <PiggyBank className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>Folga p/ Aporte</span>
                </span>
                <span className="text-[11px] font-bold text-[#1b5e20] bg-[#e8f5e9] px-1.5 py-0.2 rounded">
                  Colchão R$ 2k
                </span>
              </div>
              <div className="mt-2 space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-[#526657]">Aporte seguro 01/12:</span>
                  <span className="font-bold text-[#1b5e20]">
                    {formatBRL(metrics.safeInvestmentNextMonth)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#526657]">Superávit Trimestre:</span>
                  <span className="font-semibold text-[#141f17]">
                    {formatBRL(
                      (projection.quarterEndRow?.projectedBalance ?? 0) -
                        activeSettings.initialBalance,
                      true
                    )}
                  </span>
                </div>
              </div>
            </div>
            <button
              type="button"
              disabled={metrics.safeInvestmentNextMonth <= 0}
              onClick={handleSimulateNextMonthAporte}
              className="w-full h-8 px-2.5 rounded-md bg-[#eff3f0] hover:bg-[#dce6df] text-[#141f17] border border-[#cfd8d2] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
            >
              <FlaskConical className="w-3 h-3 text-[#2d6a3e]" />
              <span>Simular Aporte de {formatBRL(metrics.safeInvestmentNextMonth)}</span>
            </button>
          </div>

          {/* Card 4: Top Estouros do Mês (Outliers) */}
          <div className="bg-white p-3.5 rounded-lg border border-[#cfd8d2] flex flex-col justify-between gap-2">
            <div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#141f17] flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-[#9e1c1c]" />
                  <span>Maiores Estouros</span>
                </span>
                <span className="text-[11px] font-bold text-[#9e1c1c] bg-[#ffebee] px-1.5 py-0.2 rounded">
                  Top 3: +{formatBRL(metrics.top3OutliersExcess)}
                </span>
              </div>
              <div className="mt-2 space-y-1">
                {metrics.outlierDays.slice(0, 3).map((od) => (
                  <button
                    key={od.date}
                    type="button"
                    onClick={() => setSelectedDayForDetail(od.date, "expense_daily")}
                    className="w-full flex items-center justify-between text-xs px-1.5 py-0.5 rounded hover:bg-[#eff3f0] cursor-pointer"
                  >
                    <span className="font-medium text-[#526657]">
                      {formatFullDate(od.date)}
                    </span>
                    <span className="font-bold text-[#9e1c1c]">
                      {formatBRL(od.dailyAmount)}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 2 Charts Side-by-Side: 90-Day Cashflow Waterline + Current Month Daily Deviation */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          {/* 90-Day Waterline Trajectory (6 cols) */}
          <div className="lg:col-span-6 bg-white p-4 rounded-lg border border-[#cfd8d2] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#141f17]">
                Linha d&apos;Água Trimestral (90 Dias)
              </span>
              <span className="text-xs font-semibold text-[#2d6a3e]">
                {hoveredCurveDay
                  ? `${formatFullDate(hoveredCurveDay.date)}: ${formatBRL(
                      hoveredCurveDay.projectedBalance
                    )}`
                  : `Fim Trimestre: ${formatBRL(
                      projection.quarterEndRow?.projectedBalance ?? 0
                    )}`}
              </span>
            </div>

            <div className="relative h-40 w-full select-none">
              <svg
                viewBox={`0 0 ${svgCurve.width} ${svgCurve.height}`}
                className="w-full h-full overflow-visible"
                onMouseLeave={() => setHoveredCurveDay(null)}
              >
                <defs>
                  <linearGradient id="cashflowAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2d6a3e" stopOpacity="0.28" />
                    <stop offset="100%" stopColor="#2d6a3e" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Threshold R$ 3.000 */}
                <line
                  x1={0}
                  y1={svgCurve.y3000}
                  x2={svgCurve.width}
                  y2={svgCurve.y3000}
                  stroke="#6aa84f"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />
                {/* Threshold R$ 1.500 */}
                <line
                  x1={0}
                  y1={svgCurve.y1500}
                  x2={svgCurve.width}
                  y2={svgCurve.y1500}
                  stroke="#e68a00"
                  strokeDasharray="4 4"
                  strokeWidth="1"
                />

                {/* Today vertical line */}
                {svgCurve.todayX !== null && (
                  <line
                    x1={svgCurve.todayX}
                    y1={0}
                    x2={svgCurve.todayX}
                    y2={svgCurve.height}
                    stroke="#1b5e20"
                    strokeWidth="1.5"
                  />
                )}

                {/* Area under curve */}
                <path d={svgCurve.areaPath} fill="url(#cashflowAreaGrad)" />

                {/* Real balance dashed curve (visible when simulation shifts projected curve) */}
                {projection.totalSimulationImpactOnQuarter !== 0 && (
                  <polyline
                    fill="none"
                    stroke="#8c9e91"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                    points={svgCurve.realPoints}
                  />
                )}

                {/* Projected balance primary curve */}
                <polyline
                  fill="none"
                  stroke="#2d6a3e"
                  strokeWidth="2.2"
                  points={svgCurve.projectedPoints}
                />

                {/* Interactive hover slices */}
                {allQuarterDays.map((d, idx) => {
                  const x = svgCurve.toX(idx);
                  const sliceW = svgCurve.width / allQuarterDays.length;
                  return (
                    <rect
                      key={d.date}
                      x={x - sliceW / 2}
                      y={0}
                      width={sliceW}
                      height={svgCurve.height}
                      fill="transparent"
                      className="cursor-pointer"
                      onMouseEnter={() => setHoveredCurveDay(d)}
                      onClick={() => setSelectedDayForDetail(d.date, "expense_daily")}
                    />
                  );
                })}
              </svg>
            </div>

            <div className="flex items-center justify-between text-[10px] font-semibold text-[#526657] pt-1 border-t border-[#eff3f0]">
              <span>{projection.months[0].title}</span>
              <span>{projection.months[1].title} (Hoje)</span>
              <span>{projection.months[2].title}</span>
            </div>
          </div>

          {/* Daily Deviation Bar Chart (6 cols) */}
          <div className="lg:col-span-6 bg-white p-4 rounded-lg border border-[#cfd8d2] flex flex-col justify-between">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-[#141f17]">
                Gasto Diário vs. Teto ({activeMonthCol.title})
              </span>
              <span className="text-xs font-semibold text-[#526657]">
                Teto: {formatBRL(metrics.targetPerDay)}/dia
              </span>
            </div>

            <div className="relative h-40 pt-4 pb-1 flex items-end gap-1 select-none">
              <div
                className="absolute left-0 right-0 border-t border-dashed border-[#2d6a3e] pointer-events-none z-10"
                style={{
                  bottom: `${Math.min(
                    90,
                    Math.max(10, (metrics.targetPerDay / maxChartDaily) * 100)
                  )}%`,
                }}
              />

              {activeMonthCol.days.map((d) => {
                const heightPct = Math.min(
                  100,
                  Math.max(4, (d.dailyAmount / maxChartDaily) * 100)
                );
                const isOver = d.dailyAmount > d.dailyTarget;

                return (
                  <div
                    key={d.date}
                    onClick={() => setSelectedDayForDetail(d.date, "expense_daily")}
                    className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                  >
                    <div className="hidden group-hover:block absolute -top-7 z-20 bg-[#141f17] text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap">
                      {formatShortDate(d.date)}: {formatBRL(d.dailyAmount)}
                    </div>

                    <div
                      className={`w-full rounded-t transition-opacity group-hover:opacity-80 ${
                        d.isToday
                          ? "bg-[#1b5e20] ring-2 ring-[#2d6a3e]"
                          : d.isFuture
                          ? "bg-[#e3ebe5] border border-dashed border-[#6e8574]"
                          : isOver
                          ? "bg-[#e68a00]"
                          : "bg-[#6aa84f]"
                      }`}
                      style={{ height: `${heightPct}%` }}
                    />
                    <span
                      className={`mt-1 text-[9px] ${
                        d.isToday ? "font-bold text-[#1b5e20]" : "text-[#526657]"
                      }`}
                    >
                      {String(d.dayOfMonth).padStart(2, "0")}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Tabela Comparativa: Poderia Gastar x Gastou (Dia e Agregado) */}
        <div className="bg-white rounded-lg border border-[#cfd8d2] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs tabular-nums">
              <thead>
                <tr className="bg-[#eff3f0] border-b border-[#cfd8d2] text-[11px] font-bold text-[#141f17]">
                  <th className="py-2 px-3">Data</th>
                  <th className="py-2 px-3 text-right">Meta (Dia)</th>
                  <th className="py-2 px-3 text-right">Gasto (Dia)</th>
                  <th className="py-2 px-3 text-right">Diferença (Dia)</th>
                  <th className="py-2 px-3 text-right">Meta Acumulada</th>
                  <th className="py-2 px-3 text-right">Gasto Acumulado</th>
                  <th className="py-2 px-3 text-right">Saldo Meta</th>
                  <th className="py-2 px-3 text-right">Saldo Caixa</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#e4ebe6]">
                {metrics.auditRows.map(
                  ({ day, runningAllowed, runningSpent, dayDiff, cumulativeDiff }) => (
                    <tr
                      key={day.date}
                      onClick={() => setSelectedDayForDetail(day.date, "expense_daily")}
                      className={`cursor-pointer hover:brightness-95 ${
                        day.isToday
                          ? "bg-[#bdd7c5] font-bold"
                          : day.isPast
                          ? "bg-[#dce6df]"
                          : "bg-white"
                      }`}
                    >
                      <td className="py-1.5 px-3">{formatFullDate(day.date)}</td>
                      <td className="py-1.5 px-3 text-right">
                        {formatBRL(day.dailyTarget)}
                      </td>
                      <td
                        className={`py-1.5 px-3 text-right font-semibold ${
                          day.dailyAmount > day.dailyTarget
                            ? "text-[#9e1c1c]"
                            : "text-[#141f17]"
                        }`}
                      >
                        {formatBRL(day.dailyAmount)}
                      </td>
                      <td
                        className={`py-1.5 px-3 text-right font-semibold ${
                          dayDiff >= 0 ? "text-[#1b5e20]" : "text-[#9e1c1c]"
                        }`}
                      >
                        {formatBRL(dayDiff, true)}
                      </td>
                      <td className="py-1.5 px-3 text-right text-[#4e6153]">
                        {formatBRL(runningAllowed)}
                      </td>
                      <td className="py-1.5 px-3 text-right font-semibold">
                        {formatBRL(runningSpent)}
                      </td>
                      <td
                        className={`py-1.5 px-3 text-right font-bold ${
                          cumulativeDiff >= 0 ? "text-[#1b5e20]" : "text-[#9e1c1c]"
                        }`}
                      >
                        {formatBRL(cumulativeDiff, true)}
                      </td>
                      <td
                        className={`py-1.5 px-3 text-right font-bold ${day.liquidity.bgClass}`}
                      >
                        {formatBRL(day.projectedBalance)}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        </div>
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
