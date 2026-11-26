"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import {
  SlidersHorizontal,
  FlaskConical,
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Calendar,
  PiggyBank,
  PieChart,
  Activity,
  BarChart3,
  Layers,
  Flame,
  Award,
  Search,
  Sparkles,
  CheckCircle2,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Target,
  ShieldAlert,
  Clock,
  Filter,
  RotateCcw,
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

type DashboardViewTab =
  | "overview"
  | "categories"
  | "heatmap"
  | "quarterly"
  | "audit";

const TAG_PALETTE = [
  "#2d6a3e",
  "#0284c7",
  "#d97706",
  "#7c3aed",
  "#e11d48",
  "#0d9488",
  "#ea580c",
  "#4f46e5",
  "#64748b",
];

const WEEKDAY_LABELS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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
    discardAllStagedChanges,
    selectedDayForDetail,
    setSelectedDayForDetail,
  } = useCashflowStore();

  const [activeTab, setActiveTab] = useState<DashboardViewTab>("overview");
  const [hoveredCurveDay, setHoveredCurveDay] =
    useState<ComputedDayRow | null>(null);

  // Category / Tag dashboard filters
  const [tagPeriodScope, setTagPeriodScope] = useState<"month" | "quarter">(
    "month"
  );
  const [tagExpenseFilter, setTagExpenseFilter] = useState<
    "all_expenses" | "expense_daily" | "expense_fixed"
  >("all_expenses");
  const [selectedTagFilter, setSelectedTagFilter] = useState<string | null>(
    null
  );
  const [hoveredTag, setHoveredTag] = useState<string | null>(null);
  const [txSearchQuery, setTxSearchQuery] = useState("");

  // Audit & What-if Simulator state
  const [auditFilter, setAuditFilter] = useState<
    "all" | "over_target" | "saved" | "elapsed"
  >("all");
  const [simSliderTarget, setSimSliderTarget] = useState<number | null>(null);

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

  const prevMonthCol = projection.months[0];
  const activeMonthCol = projection.months[1];
  const nextMonthCol = projection.months[2];

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

  // Core + Advanced Financial Intelligence Metrics
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
    const zeroSpendDaysCount = effectiveDays.filter(
      (d) => d.dailyAmount === 0
    ).length;
    const adherencePct =
      effectiveDays.length > 0
        ? Number(((daysWithinTarget / effectiveDays.length) * 100).toFixed(1))
        : 100;

    // Streak calculation (within daily target)
    let currentStreak = 0;
    let bestStreak = 0;
    let runningStreak = 0;
    for (const d of effectiveDays) {
      if (d.dailyAmount <= targetPerDay) {
        runningStreak++;
        if (runningStreak > bestStreak) bestStreak = runningStreak;
      } else {
        runningStreak = 0;
      }
    }
    for (let i = effectiveDays.length - 1; i >= 0; i--) {
      if (effectiveDays[i].dailyAmount <= targetPerDay) {
        currentStreak++;
      } else {
        break;
      }
    }

    const lowestDay = activeMonthCol.lowestBalanceDay;

    // 1. Weekday vs Weekend + 7-Day Profile (Dom..Sáb)
    const pastQuarterDays = allQuarterDays.filter((d) => d.isPast || d.isToday);
    let weekdaySum = 0;
    let weekdayCount = 0;
    let weekendSum = 0;
    let weekendCount = 0;

    const dowTotals = [0, 0, 0, 0, 0, 0, 0];
    const dowCounts = [0, 0, 0, 0, 0, 0, 0];

    for (const d of pastQuarterDays) {
      const dow = new Date(`${d.date}T00:00:00`).getDay();
      dowTotals[dow] += d.dailyAmount;
      dowCounts[dow] += 1;
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

    const weekdayProfile = WEEKDAY_LABELS.map((label, idx) => {
      const avg =
        dowCounts[idx] > 0
          ? Number((dowTotals[idx] / dowCounts[idx]).toFixed(2))
          : 0;
      return {
        dow: idx,
        label,
        avg,
        total: Number(dowTotals[idx].toFixed(2)),
        count: dowCounts[idx],
        isWeekend: idx === 0 || idx === 6,
      };
    });

    const sortedWeekdaysByAvg = [...weekdayProfile]
      .filter((w) => w.count > 0)
      .sort((a, b) => b.avg - a.avg);
    const highestSpendDow = sortedWeekdaysByAvg[0] || null;
    const lowestSpendDow =
      sortedWeekdaysByAvg[sortedWeekdaysByAvg.length - 1] || null;

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

    // 3. Pre-salary liquidity protection window
    const criticalFutureDays = futureDays.filter(
      (d) => d.projectedBalance < 1500
    );
    const lowestFutureBalance =
      lowestDay?.projectedBalance ?? projectedEndOfMonth;
    const deficitToYellowZone = Math.max(
      0,
      Number((1500 - lowestFutureBalance).toFixed(2))
    );

    // 4. Safe Investment Capacity (Colchão R$ 2.000)
    const nextMonthDays = nextMonthCol.days;
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

    // 5. Monthly Cashflow & 50/30/20 Allocation
    const monthIncome = activeMonthCol.totalIncome;
    const monthFixedOut = activeMonthCol.totalFixedExpense;
    const monthDailyOut = activeMonthCol.totalDailySpend;
    const monthTotalOut = Number((monthFixedOut + monthDailyOut).toFixed(2));
    const monthNetFlow = Number((monthIncome - monthTotalOut).toFixed(2));
    const savingsRatePct =
      monthIncome > 0
        ? Number(((monthNetFlow / monthIncome) * 100).toFixed(1))
        : 0;
    const fixedShareOfIncomePct =
      monthIncome > 0
        ? Number(((monthFixedOut / monthIncome) * 100).toFixed(1))
        : 0;
    const dailyShareOfIncomePct =
      monthIncome > 0
        ? Number(((monthDailyOut / monthIncome) * 100).toFixed(1))
        : 0;

    // MoM Deltas (Active Month vs Previous Month)
    const prevTotalOut = Number(
      (prevMonthCol.totalFixedExpense + prevMonthCol.totalDailySpend).toFixed(2)
    );
    const outMoMDeltaPct =
      prevTotalOut > 0
        ? Number(
            (((monthTotalOut - prevTotalOut) / prevTotalOut) * 100).toFixed(1)
          )
        : 0;
    const dailyMoMDeltaPct =
      prevMonthCol.totalDailySpend > 0
        ? Number(
            (
              ((monthDailyOut - prevMonthCol.totalDailySpend) /
                prevMonthCol.totalDailySpend) *
              100
            ).toFixed(1)
          )
        : 0;
    const balanceMoMDelta = Number(
      (activeMonthCol.endingBalance - prevMonthCol.endingBalance).toFixed(2)
    );

    // Runway (Autonomia de Caixa em dias no ritmo médio total de saída)
    const avgTotalDailyOutflow =
      activeMonthCol.days.length > 0
        ? monthTotalOut / activeMonthCol.days.length
        : targetPerDay;
    const cashRunwayDays =
      avgTotalDailyOutflow > 0
        ? Math.max(0, Math.round(currentBalance / avgTotalDailyOutflow))
        : 999;

    // 6. Financial Health Score (0 - 100)
    const adherenceScore = Math.round((adherencePct / 100) * 30); // max 30
    const liquidityScore =
      minBalance >= 3000
        ? 25
        : minBalance >= 2000
        ? 21
        : minBalance >= 1500
        ? 16
        : minBalance >= 1000
        ? 9
        : 3; // max 25
    const savingsScore =
      savingsRatePct >= 20
        ? 25
        : savingsRatePct >= 10
        ? 20
        : savingsRatePct >= 0
        ? 14
        : 5; // max 25
    const budgetCushionScore =
      netSavingsToDate >= 150
        ? 20
        : netSavingsToDate >= 0
        ? 16
        : netSavingsToDate >= -150
        ? 9
        : 3; // max 20
    const healthScore = Math.min(
      100,
      Math.max(
        0,
        adherenceScore + liquidityScore + savingsScore + budgetCushionScore
      )
    );

    // 7. Weekly Burn-Rate Breakdown (Weeks 1 to 5 of Active Month)
    const weeklyRanges = [
      { id: "W1", label: "Semana 1 (01–07)", min: 1, max: 7 },
      { id: "W2", label: "Semana 2 (08–14)", min: 8, max: 14 },
      { id: "W3", label: "Semana 3 (15–21)", min: 15, max: 21 },
      { id: "W4", label: "Semana 4 (22–28)", min: 22, max: 28 },
      {
        id: "W5",
        label: `Semana 5 (29–${activeMonthCol.days.length})`,
        min: 29,
        max: 31,
      },
    ];
    const weeklyBreakdown = weeklyRanges
      .map((w) => {
        const wDays = activeMonthCol.days.filter(
          (d) => d.dayOfMonth >= w.min && d.dayOfMonth <= w.max
        );
        const dailySum = Number(
          wDays.reduce((acc, d) => acc + d.dailyAmount, 0).toFixed(2)
        );
        const fixedSum = Number(
          wDays.reduce((acc, d) => acc + d.fixedExpenseTotal, 0).toFixed(2)
        );
        const incomeSum = Number(
          wDays.reduce((acc, d) => acc + d.incomeTotal, 0).toFixed(2)
        );
        const budgetAllowed = Number((wDays.length * targetPerDay).toFixed(2));
        return {
          ...w,
          daysCount: wDays.length,
          dailySum,
          fixedSum,
          incomeSum,
          budgetAllowed,
          avgDaily:
            wDays.length > 0
              ? Number((dailySum / wDays.length).toFixed(2))
              : 0,
          diffFromTarget: Number((budgetAllowed - dailySum).toFixed(2)),
        };
      })
      .filter((w) => w.daysCount > 0);

    // 8. Audit rows
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
      zeroSpendDaysCount,
      adherencePct,
      currentStreak,
      bestStreak,
      lowestDay,
      suggestedDailyTarget,
      weekdayAvg,
      weekendAvg,
      weekdayProfile,
      highestSpendDow,
      lowestSpendDow,
      outlierDays,
      top3OutliersExcess,
      criticalFutureDays,
      deficitToYellowZone,
      safeInvestmentNextMonth,
      monthIncome,
      monthFixedOut,
      monthDailyOut,
      monthTotalOut,
      monthNetFlow,
      savingsRatePct,
      fixedShareOfIncomePct,
      dailyShareOfIncomePct,
      outMoMDeltaPct,
      dailyMoMDeltaPct,
      balanceMoMDelta,
      cashRunwayDays,
      healthScore,
      healthPillars: {
        adherenceScore,
        liquidityScore,
        savingsScore,
        budgetCushionScore,
      },
      weeklyBreakdown,
      auditRows,
    };
  }, [
    activeMonthCol,
    prevMonthCol,
    nextMonthCol,
    activeSettings.dailySpendingTarget,
    projectedEndOfMonth,
    currentBalance,
    allQuarterDays,
  ]);

  // Tag / Category Intelligence & Pareto Analytics
  const tagAnalytics = useMemo(() => {
    const sourceDays =
      tagPeriodScope === "month" ? activeMonthCol.days : allQuarterDays;

    const tagMap = new Map<
      string,
      {
        tag: string;
        total: number;
        count: number;
        dailyTotal: number;
        fixedTotal: number;
      }
    >();

    const allExpenseItems: Array<{
      id: string;
      date: string;
      title: string;
      amount: number;
      type: "income" | "expense_fixed" | "expense_daily";
      tag: string;
      installmentLabel?: string;
    }> = [];

    for (const d of sourceDays) {
      for (const item of d.items) {
        if (item.amount <= 0) continue;
        if (item.type === "income") continue;
        if (
          tagExpenseFilter === "expense_daily" &&
          item.type !== "expense_daily"
        ) {
          continue;
        }
        if (
          tagExpenseFilter === "expense_fixed" &&
          item.type !== "expense_fixed"
        ) {
          continue;
        }

        const resolvedTag =
          item.category && item.category.trim().length > 0
            ? item.category.trim()
            : item.type === "expense_daily"
            ? "Diário (Sem Tag)"
            : "Saída (Sem Tag)";

        const entry = tagMap.get(resolvedTag) || {
          tag: resolvedTag,
          total: 0,
          count: 0,
          dailyTotal: 0,
          fixedTotal: 0,
        };
        entry.total = Number((entry.total + item.amount).toFixed(2));
        entry.count += 1;
        if (item.type === "expense_daily") {
          entry.dailyTotal = Number(
            (entry.dailyTotal + item.amount).toFixed(2)
          );
        } else {
          entry.fixedTotal = Number(
            (entry.fixedTotal + item.amount).toFixed(2)
          );
        }
        tagMap.set(resolvedTag, entry);

        allExpenseItems.push({
          id: item.id,
          date: d.date,
          title: item.title,
          amount: item.amount,
          type: item.type,
          tag: resolvedTag,
          installmentLabel: item.installmentLabel,
        });
      }
    }

    const sorted = Array.from(tagMap.values()).sort(
      (a, b) => b.total - a.total
    );
    const grandTotal = Number(
      sorted.reduce((acc, item) => acc + item.total, 0).toFixed(2)
    );

    let runningCumulative = 0;
    const breakdown = sorted.map((item, idx) => {
      const sharePct =
        grandTotal > 0
          ? Number(((item.total / grandTotal) * 100).toFixed(1))
          : 0;
      runningCumulative = Number((runningCumulative + sharePct).toFixed(1));
      return {
        ...item,
        avgTicket:
          item.count > 0 ? Number((item.total / item.count).toFixed(2)) : 0,
        sharePct,
        cumulativePct: Math.min(100, runningCumulative),
        color: TAG_PALETTE[idx % TAG_PALETTE.length],
      };
    });

    const filteredItems = allExpenseItems
      .filter((it) => {
        if (selectedTagFilter && it.tag !== selectedTagFilter) return false;
        if (txSearchQuery.trim().length > 0) {
          const q = txSearchQuery.trim().toLowerCase();
          return (
            it.title.toLowerCase().includes(q) ||
            it.tag.toLowerCase().includes(q) ||
            it.date.includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => b.amount - a.amount);

    return {
      grandTotal,
      totalTransactionsCount: allExpenseItems.length,
      breakdown,
      filteredItems,
    };
  }, [
    tagPeriodScope,
    tagExpenseFilter,
    selectedTagFilter,
    txSearchQuery,
    activeMonthCol.days,
    allQuarterDays,
  ]);

  // Calendar Heatmap cells for Active Month (aligned Sunday..Saturday)
  const calendarHeatmapCells = useMemo(() => {
    const firstDayIso = activeMonthCol.days[0]?.date;
    if (!firstDayIso) return [];
    const firstDow = new Date(`${firstDayIso}T00:00:00`).getDay(); // 0 (Sun) .. 6 (Sat)
    const cells: Array<{
      key: string;
      day: ComputedDayRow | null;
    }> = [];
    for (let i = 0; i < firstDow; i++) {
      cells.push({ key: `pad_${i}`, day: null });
    }
    for (const d of activeMonthCol.days) {
      cells.push({ key: d.date, day: d });
    }
    return cells;
  }, [activeMonthCol.days]);

  const effectiveSliderValue =
    simSliderTarget ?? metrics.suggestedDailyTarget;

  const sliderProjectedDelta = useMemo(() => {
    let delta = 0;
    for (const d of metrics.futureDays) {
      delta += d.dailyAmount - effectiveSliderValue;
    }
    return Number(delta.toFixed(2));
  }, [metrics.futureDays, effectiveSliderValue]);

  function handleSimulateSuggestedTarget() {
    if (metrics.futureDays.length === 0) return;
    const start = metrics.futureDays[0].date;
    const end = metrics.futureDays[metrics.futureDays.length - 1].date;
    applyTemporaryDailyTargetInMemory(metrics.suggestedDailyTarget, start, end);
    toast.success(
      `Meta de ${formatBRL(metrics.suggestedDailyTarget)}/dia simulada.`
    );
  }

  function handleApplyCustomSliderSimulation() {
    if (metrics.futureDays.length === 0) {
      toast.info("Não há dias futuros restantes neste mês para simular.");
      return;
    }
    const start = metrics.futureDays[0].date;
    const end = metrics.futureDays[metrics.futureDays.length - 1].date;
    applyTemporaryDailyTargetInMemory(effectiveSliderValue, start, end);
    toast.success(
      `Simulado teto de ${formatBRL(effectiveSliderValue)}/dia em ${
        metrics.futureDays.length
      } dias futuros.`
    );
  }

  function handleSimulatePreSalaryProtection() {
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
      `Aporte de ${formatBRL(
        metrics.safeInvestmentNextMonth
      )} simulado em ${formatShortDate(nextMonthFirstDay)}.`
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
    const height = 165;
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

  const filteredAuditRows = useMemo(() => {
    return metrics.auditRows.filter(({ day, dayDiff }) => {
      if (auditFilter === "over_target") return dayDiff < 0;
      if (auditFilter === "saved") return dayDiff > 0 && (day.isPast || day.isToday);
      if (auditFilter === "elapsed") return day.isPast || day.isToday;
      return true;
    });
  }, [metrics.auditRows, auditFilter]);

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f6f4] text-[#141f17]">
      <TopNavbar
        currentBalance={currentBalance}
        projectedEndOfMonth={projectedEndOfMonth}
        projectedQuarterEnd={projection.quarterEndRow?.projectedBalance}
        simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
      />

      <main className="max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 pb-20 space-y-4 flex-1">
        {/* Top Executive Header & Multi-Dashboard Navigation Bar */}
        <div className="bg-white rounded-2xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="flex items-center gap-2.5">
              <Link
                href="/"
                className="h-8 px-2.5 rounded-lg bg-[#eff3f0] border border-[#cfd8d2] hover:bg-[#dce6df] text-xs font-semibold text-[#141f17] flex items-center gap-1 transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Planilha</span>
              </Link>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-base font-extrabold text-[#141f17] tracking-tight">
                    Financial Intelligence Hub • {activeMonthCol.title}
                  </h1>
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e8f5e9] border border-[#a5d6a7] text-[10px] font-bold text-[#1b5e20]">
                    <Sparkles className="w-3 h-3" />
                    <span>Score {metrics.healthScore}/100</span>
                  </span>
                </div>
                <p className="text-[11px] text-[#526657]">
                  Clique em qualquer gráfico, barra, dia ou lançamento para inspecionar ou editar diretamente
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSimulateSuggestedTarget}
                className="h-8 px-3 rounded-lg bg-[#fdf6e2] hover:bg-[#faeec9] border border-[#d9c27e] text-[#5c4300] text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <FlaskConical className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Simular Meta Sugerida:</span>
                <span className="font-bold">
                  {formatBRL(metrics.suggestedDailyTarget)}/dia
                </span>
              </button>
              <button
                type="button"
                onClick={() => setSettingsModalOpen(true)}
                className="h-8 px-3 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                <span>Meta: {formatBRL(metrics.targetPerDay)}</span>
              </button>
            </div>
          </div>

          {/* 5 Dashboard View Switcher Pills */}
          <div className="flex items-center gap-1 overflow-x-auto thin-scroll bg-[#eff3f0] p-1 rounded-xl border border-[#d5ded8]">
            {(
              [
                {
                  id: "overview",
                  label: "Visão Executiva (Bento)",
                  icon: Layers,
                },
                {
                  id: "categories",
                  label: `Tags & Pareto 80/20 (${tagAnalytics.breakdown.length})`,
                  icon: PieChart,
                },
                {
                  id: "heatmap",
                  label: "Mapa de Calor & Ritmo Semanal",
                  icon: Flame,
                },
                {
                  id: "quarterly",
                  label: "Comparativo 3 Meses & 50/30/20",
                  icon: BarChart3,
                },
                {
                  id: "audit",
                  label: "Simulador What-If & Auditoria",
                  icon: Activity,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative py-1.5 px-3 rounded-lg text-xs font-bold flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-colors z-10 ${
                    active
                      ? "text-[#141f17]"
                      : "text-[#4e6153] hover:text-[#141f17]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="insights-dashboard-tab-pill"
                      transition={{
                        type: "spring",
                        stiffness: 460,
                        damping: 34,
                      }}
                      className="absolute inset-0 bg-white rounded-lg shadow-2xs border border-[#cfd8d2]/80 -z-10"
                    />
                  )}
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      active ? "text-[#2d6a3e]" : "text-[#526657]"
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* HERO KPI ROW (Always Visible Across Dashboards — Shadcn / Horizon UI Style) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* KPI 1: Saldo Final Projetado & MoM */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-[#526657] uppercase tracking-wider">
                Projeção Fim Mês
              </span>
              <span
                className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  metrics.balanceMoMDelta >= 0
                    ? "bg-[#e8f5e9] text-[#1b5e20]"
                    : "bg-[#ffebee] text-[#9e1c1c]"
                }`}
              >
                {metrics.balanceMoMDelta >= 0 ? (
                  <ArrowUpRight className="w-3 h-3" />
                ) : (
                  <ArrowDownRight className="w-3 h-3" />
                )}
                <span>{formatBRL(metrics.balanceMoMDelta, true)}</span>
              </span>
            </div>
            <div className="text-xl font-extrabold text-[#141f17] tabular-nums mt-1.5">
              {formatBRL(projectedEndOfMonth)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#526657] mt-1 pt-1.5 border-t border-[#eff3f0]">
              <span>Hoje: {formatBRL(currentBalance)}</span>
              <span className="font-semibold text-[#2d6a3e]">
                {metrics.cashRunwayDays}d autonomia
              </span>
            </div>
          </div>

          {/* KPI 2: Resultado Líquido & Taxa de Poupança */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-[#526657] uppercase tracking-wider">
                Resultado do Mês
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  metrics.savingsRatePct >= 15
                    ? "bg-[#e8f5e9] text-[#1b5e20]"
                    : metrics.savingsRatePct >= 0
                    ? "bg-[#fff3cd] text-[#7c5800]"
                    : "bg-[#ffebee] text-[#9e1c1c]"
                }`}
              >
                Poupança: {metrics.savingsRatePct}%
              </span>
            </div>
            <div
              className={`text-xl font-extrabold tabular-nums mt-1.5 ${
                metrics.monthNetFlow >= 0 ? "text-[#1b5e20]" : "text-[#9e1c1c]"
              }`}
            >
              {formatBRL(metrics.monthNetFlow, true)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#526657] mt-1 pt-1.5 border-t border-[#eff3f0]">
              <span>Entr: {formatBRL(metrics.monthIncome)}</span>
              <span>Saíd: {formatBRL(metrics.monthTotalOut)}</span>
            </div>
          </div>

          {/* KPI 3: Média Diária Real vs Meta */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-[#526657] uppercase tracking-wider">
                Ritmo Diário ({metrics.effectiveDaysCount}d)
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  metrics.averageActualDaily <= metrics.targetPerDay
                    ? "bg-[#e8f5e9] text-[#1b5e20]"
                    : "bg-[#ffebee] text-[#9e1c1c]"
                }`}
              >
                Meta: {formatBRL(metrics.targetPerDay)}
              </span>
            </div>
            <div
              className={`text-xl font-extrabold tabular-nums mt-1.5 ${
                metrics.averageActualDaily <= metrics.targetPerDay
                  ? "text-[#1b5e20]"
                  : "text-[#9e1c1c]"
              }`}
            >
              {formatBRL(metrics.averageActualDaily)}
              <span className="text-xs font-semibold text-[#526657]">/dia</span>
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#526657] mt-1 pt-1.5 border-t border-[#eff3f0]">
              <span>Úteis: {formatBRL(metrics.weekdayAvg)}</span>
              <span>FDS: {formatBRL(metrics.weekendAvg)}</span>
            </div>
          </div>

          {/* KPI 4: Economia Acumulada na Meta & Streak */}
          <div className="bg-white p-3.5 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between">
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-[#526657] uppercase tracking-wider">
                Balanço da Meta
              </span>
              <span className="px-1.5 py-0.5 rounded-md bg-[#eff3f0] text-[#141f17] text-[10px] font-bold">
                {metrics.daysWithinTarget}/{metrics.effectiveDaysCount}d (
                {metrics.adherencePct}%)
              </span>
            </div>
            <div
              className={`text-xl font-extrabold tabular-nums mt-1.5 ${
                metrics.netSavingsToDate >= 0
                  ? "text-[#1b5e20]"
                  : "text-[#9e1c1c]"
              }`}
            >
              {formatBRL(metrics.netSavingsToDate, true)}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#526657] mt-1 pt-1.5 border-t border-[#eff3f0]">
              <span>🔥 Streak: {metrics.currentStreak}d</span>
              <span>Zero gasto: {metrics.zeroSpendDaysCount}d</span>
            </div>
          </div>

          {/* KPI 5: Menor Saldo (Ponto de Estresse) */}
          <div
            onClick={() =>
              metrics.lowestDay &&
              setSelectedDayForDetail(metrics.lowestDay.date, "expense_daily")
            }
            className="bg-white p-3.5 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between cursor-pointer hover:border-[#2d6a3e] transition-colors"
          >
            <div className="flex items-center justify-between gap-1">
              <span className="text-[11px] font-bold text-[#526657] uppercase tracking-wider">
                Vale de Liquidez
              </span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
                  metrics.lowestDay?.liquidity.badgeClass ||
                  "bg-[#eff3f0] text-[#141f17]"
                }`}
              >
                Dia{" "}
                {metrics.lowestDay
                  ? formatShortDate(metrics.lowestDay.date)
                  : "-"}
              </span>
            </div>
            <div className="text-xl font-extrabold text-[#141f17] tabular-nums mt-1.5">
              {metrics.lowestDay
                ? formatBRL(metrics.lowestDay.projectedBalance)
                : "-"}
            </div>
            <div className="flex items-center justify-between text-[11px] text-[#526657] mt-1 pt-1.5 border-t border-[#eff3f0]">
              <span>
                Faixa: {metrics.lowestDay?.liquidity.label || "Seguro"}
              </span>
              <span className="text-[#2d6a3e] font-semibold">Ver dia →</span>
            </div>
          </div>
        </div>

        {/* ===================================================================== */}
        {/* DASHBOARD SECTION 1: VISÃO EXECUTIVA (Overview + Health Score + Waterline + Smart Insights) */}
        {/* ===================================================================== */}
        {activeTab === "overview" && (
          <div className="space-y-4">
            {/* Row A: Financial Health Score Radial Card (4 cols) + 90-Day Waterline Trajectory (8 cols) */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Financial Health Score Gauge Card (Vision UI / Horizon Style) */}
              <div className="lg:col-span-4 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                      Score de Saúde Financeira
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Índice composto de liquidez, meta e poupança
                    </p>
                  </div>
                  <Award className="w-4 h-4 text-[#2d6a3e]" />
                </div>

                {/* Radial SVG Gauge */}
                <div className="my-3 flex items-center gap-4">
                  <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                    <svg
                      viewBox="0 0 100 100"
                      className="w-full h-full -rotate-90"
                    >
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke="#eff3f0"
                        strokeWidth="10"
                      />
                      <circle
                        cx="50"
                        cy="50"
                        r="40"
                        fill="none"
                        stroke={
                          metrics.healthScore >= 75
                            ? "#2d6a3e"
                            : metrics.healthScore >= 50
                            ? "#d97706"
                            : "#9e1c1c"
                        }
                        strokeWidth="10"
                        strokeLinecap="round"
                        strokeDasharray={`${
                          (metrics.healthScore / 100) * 251.2
                        } 251.2`}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-2xl font-extrabold text-[#141f17] tabular-nums leading-none">
                        {metrics.healthScore}
                      </span>
                      <span className="text-[10px] font-bold text-[#526657] uppercase mt-0.5">
                        / 100 pts
                      </span>
                    </div>
                  </div>

                  {/* 4 Pillar Breakdown Bars */}
                  <div className="flex-1 space-y-2 text-[11px]">
                    <div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-[#526657]">Disciplina Meta</span>
                        <span className="text-[#141f17] tabular-nums">
                          {metrics.healthPillars.adherenceScore}/30
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#eff3f0] overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-[#2d6a3e] rounded-full"
                          style={{
                            width: `${
                              (metrics.healthPillars.adherenceScore / 30) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-[#526657]">Colchão Liquidez</span>
                        <span className="text-[#141f17] tabular-nums">
                          {metrics.healthPillars.liquidityScore}/25
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#eff3f0] overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-[#0284c7] rounded-full"
                          style={{
                            width: `${
                              (metrics.healthPillars.liquidityScore / 25) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-[#526657]">Taxa Poupança</span>
                        <span className="text-[#141f17] tabular-nums">
                          {metrics.healthPillars.savingsScore}/25
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#eff3f0] overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-[#7c3aed] rounded-full"
                          style={{
                            width: `${
                              (metrics.healthPillars.savingsScore / 25) * 100
                            }%`,
                          }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between font-semibold">
                        <span className="text-[#526657]">Folga Acumulada</span>
                        <span className="text-[#141f17] tabular-nums">
                          {metrics.healthPillars.budgetCushionScore}/20
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full bg-[#eff3f0] overflow-hidden mt-0.5">
                        <div
                          className="h-full bg-[#d97706] rounded-full"
                          style={{
                            width: `${
                              (metrics.healthPillars.budgetCushionScore / 20) *
                              100
                            }%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Bottom Status Strip */}
                <div className="pt-2 border-t border-[#eff3f0] flex items-center justify-between text-[11px]">
                  <span className="text-[#526657]">Comprometimento Renda:</span>
                  <span className="font-bold text-[#141f17] tabular-nums">
                    {Number(
                      (
                        metrics.fixedShareOfIncomePct +
                        metrics.dailyShareOfIncomePct
                      ).toFixed(1)
                    )}
                    % das Entradas
                  </span>
                </div>
              </div>

              {/* 90-Day Waterline Trajectory (8 cols) */}
              <div className="lg:col-span-8 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <div>
                    <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                      Linha d&apos;Água Trimestral (90 Dias)
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Passe o mouse para inspecionar e clique para abrir o dia
                    </p>
                  </div>

                  {hoveredCurveDay ? (
                    <div className="flex items-center gap-2 bg-[#eff3f0] px-2.5 py-1 rounded-lg border border-[#d5ded8] text-xs tabular-nums">
                      <span className="font-bold text-[#141f17]">
                        {formatFullDate(hoveredCurveDay.date)}
                      </span>
                      {hoveredCurveDay.dailyAmount > 0 && (
                        <span className="text-[#7c5800] font-semibold">
                          Diário: {formatBRL(hoveredCurveDay.dailyAmount)}
                        </span>
                      )}
                      {hoveredCurveDay.fixedExpenseTotal > 0 && (
                        <span className="text-[#9e1c1c] font-semibold">
                          Saída: {formatBRL(hoveredCurveDay.fixedExpenseTotal)}
                        </span>
                      )}
                      {hoveredCurveDay.incomeTotal > 0 && (
                        <span className="text-[#1b5e20] font-semibold">
                          Entr: +{formatBRL(hoveredCurveDay.incomeTotal)}
                        </span>
                      )}
                      <span
                        className={`px-1.5 py-0.2 rounded font-bold ${hoveredCurveDay.liquidity.bgClass}`}
                      >
                        {formatBRL(hoveredCurveDay.projectedBalance)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 text-[11px] font-semibold">
                      <span className="flex items-center gap-1 text-[#1b5e20]">
                        <span className="w-2.5 h-0.5 bg-[#6aa84f] inline-block" />
                        <span>Zona Segura (R$ 3k)</span>
                      </span>
                      <span className="flex items-center gap-1 text-[#8c3d00]">
                        <span className="w-2.5 h-0.5 bg-[#e68a00] inline-block" />
                        <span>Alerta (R$ 1,5k)</span>
                      </span>
                      <span className="font-bold text-[#2d6a3e]">
                        Fim Trimestre:{" "}
                        {formatBRL(
                          projection.quarterEndRow?.projectedBalance ?? 0
                        )}
                      </span>
                    </div>
                  )}
                </div>

                <div className="relative h-44 w-full select-none">
                  <svg
                    viewBox={`0 0 ${svgCurve.width} ${svgCurve.height}`}
                    className="w-full h-full overflow-visible"
                    onMouseLeave={() => setHoveredCurveDay(null)}
                  >
                    <defs>
                      <linearGradient
                        id="cashflowAreaGrad"
                        x1="0"
                        y1="0"
                        x2="0"
                        y2="1"
                      >
                        <stop
                          offset="0%"
                          stopColor="#2d6a3e"
                          stopOpacity="0.32"
                        />
                        <stop
                          offset="100%"
                          stopColor="#2d6a3e"
                          stopOpacity="0.02"
                        />
                      </linearGradient>
                    </defs>

                    <line
                      x1={0}
                      y1={svgCurve.y3000}
                      x2={svgCurve.width}
                      y2={svgCurve.y3000}
                      stroke="#6aa84f"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />
                    <line
                      x1={0}
                      y1={svgCurve.y1500}
                      x2={svgCurve.width}
                      y2={svgCurve.y1500}
                      stroke="#e68a00"
                      strokeDasharray="4 4"
                      strokeWidth="1"
                    />

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

                    <path
                      d={svgCurve.areaPath}
                      fill="url(#cashflowAreaGrad)"
                    />

                    {projection.totalSimulationImpactOnQuarter !== 0 && (
                      <polyline
                        fill="none"
                        stroke="#8c9e91"
                        strokeWidth="1.5"
                        strokeDasharray="3 3"
                        points={svgCurve.realPoints}
                      />
                    )}

                    <polyline
                      fill="none"
                      stroke="#2d6a3e"
                      strokeWidth="2.4"
                      points={svgCurve.projectedPoints}
                    />

                    {allQuarterDays.map((d, idx) => {
                      const x = svgCurve.toX(idx);
                      const sliceW = svgCurve.width / allQuarterDays.length;
                      const isHovered = hoveredCurveDay?.date === d.date;
                      return (
                        <g key={d.date}>
                          {isHovered && (
                            <>
                              <line
                                x1={x}
                                y1={0}
                                x2={x}
                                y2={svgCurve.height}
                                stroke="#141f17"
                                strokeDasharray="2 2"
                                strokeWidth="1"
                              />
                              <circle
                                cx={x}
                                cy={svgCurve.toY(d.projectedBalance)}
                                r={4.5}
                                fill="#2d6a3e"
                                stroke="#ffffff"
                                strokeWidth="2"
                              />
                            </>
                          )}
                          <rect
                            x={x - sliceW / 2}
                            y={0}
                            width={sliceW}
                            height={svgCurve.height}
                            fill="transparent"
                            className="cursor-pointer"
                            onMouseEnter={() => setHoveredCurveDay(d)}
                            onClick={() =>
                              setSelectedDayForDetail(d.date, "expense_daily")
                            }
                          />
                        </g>
                      );
                    })}
                  </svg>
                </div>

                <div className="flex items-center justify-between text-[10px] font-semibold text-[#526657] pt-1.5 border-t border-[#eff3f0]">
                  <span>
                    {prevMonthCol.title} (Fim:{" "}
                    {formatBRL(prevMonthCol.endingBalance)})
                  </span>
                  <span className="text-[#1b5e20] font-bold">
                    {activeMonthCol.title} (Fim:{" "}
                    {formatBRL(activeMonthCol.endingBalance)})
                  </span>
                  <span>
                    {nextMonthCol.title} (Fim:{" "}
                    {formatBRL(nextMonthCol.endingBalance)})
                  </span>
                </div>
              </div>
            </div>

            {/* Row B: 4 Actionable Smart Optimization Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
              {/* Card 1 */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between gap-2.5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141f17] flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-[#2d6a3e]" />
                      <span>Ritmo Dias Úteis x FDS</span>
                    </span>
                    <span className="text-[10px] font-bold text-[#1b5e20] bg-[#e8f5e9] px-1.5 py-0.5 rounded">
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
                  className="w-full h-8 px-2.5 rounded-lg bg-[#eff3f0] hover:bg-[#dce6df] text-[#141f17] border border-[#cfd8d2] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <FlaskConical className="w-3 h-3 text-[#2d6a3e]" />
                  <span>
                    Projetar R$ 28 / R$ 50 em{" "}
                    {nextMonthCol.title.split(" ")[0]}
                  </span>
                </button>
              </div>

              {/* Card 2 */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between gap-2.5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141f17] flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 text-[#e68a00]" />
                      <span>Proteção Pré-Salário</span>
                    </span>
                    <span className="text-[10px] font-bold text-[#8c3d00] bg-[#fff3e0] px-1.5 py-0.5 rounded">
                      {metrics.lowestDay
                        ? formatShortDate(metrics.lowestDay.date)
                        : "-"}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#526657]">Piso projetado:</span>
                      <span className="font-semibold text-[#8c3d00]">
                        {metrics.lowestDay
                          ? formatBRL(metrics.lowestDay.projectedBalance)
                          : "-"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526657]">
                        Margem p/ faixa R$ 1,5k:
                      </span>
                      <span className="font-semibold text-[#141f17]">
                        {formatBRL(metrics.deficitToYellowZone)}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSimulatePreSalaryProtection}
                  className="w-full h-8 px-2.5 rounded-lg bg-[#fdf6e2] hover:bg-[#faeec9] text-[#5c4300] border border-[#d9c27e] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                >
                  <FlaskConical className="w-3 h-3" />
                  <span>Simular R$ 15/dia nos dias críticos</span>
                </button>
              </div>

              {/* Card 3 */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between gap-2.5">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141f17] flex items-center gap-1.5">
                      <PiggyBank className="w-3.5 h-3.5 text-[#2d6a3e]" />
                      <span>Capacidade de Aporte</span>
                    </span>
                    <span className="text-[10px] font-bold text-[#1b5e20] bg-[#e8f5e9] px-1.5 py-0.5 rounded">
                      Colchão R$ 2k
                    </span>
                  </div>
                  <div className="mt-2 space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-[#526657]">Aporte seguro:</span>
                      <span className="font-bold text-[#1b5e20]">
                        {formatBRL(metrics.safeInvestmentNextMonth)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-[#526657]">
                        Superávit Trimestre:
                      </span>
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
                  className="w-full h-8 px-2.5 rounded-lg bg-[#eff3f0] hover:bg-[#dce6df] text-[#141f17] border border-[#cfd8d2] text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-50"
                >
                  <FlaskConical className="w-3 h-3 text-[#2d6a3e]" />
                  <span>
                    Simular Aporte de{" "}
                    {formatBRL(metrics.safeInvestmentNextMonth)}
                  </span>
                </button>
              </div>

              {/* Card 4 */}
              <div className="bg-white p-3.5 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between gap-2">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#141f17] flex items-center gap-1.5">
                      <TrendingDown className="w-3.5 h-3.5 text-[#9e1c1c]" />
                      <span>Maiores Estouros</span>
                    </span>
                    <span className="text-[10px] font-bold text-[#9e1c1c] bg-[#ffebee] px-1.5 py-0.5 rounded">
                      Top 3: +{formatBRL(metrics.top3OutliersExcess)}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1">
                    {metrics.outlierDays.length === 0 ? (
                      <div className="text-[11px] text-[#526657] py-2">
                        Nenhum dia estourou a meta até agora.
                      </div>
                    ) : (
                      metrics.outlierDays.slice(0, 3).map((od) => (
                        <button
                          key={od.date}
                          type="button"
                          onClick={() =>
                            setSelectedDayForDetail(od.date, "expense_daily")
                          }
                          className="w-full flex items-center justify-between text-xs px-1.5 py-0.5 rounded hover:bg-[#eff3f0] cursor-pointer"
                        >
                          <span className="font-medium text-[#526657]">
                            {formatFullDate(od.date)}
                          </span>
                          <span className="font-bold text-[#9e1c1c]">
                            {formatBRL(od.dailyAmount)}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Row C in Overview: Quick Bento Preview of Category Breakdown + Daily Bar Chart + 3-Month Summary */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Mini Category Donut & Top Tags (5 cols) */}
              <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                      Distribuição por Tags ({activeMonthCol.title})
                    </h3>
                    <p className="text-[11px] text-[#526657]">
                      Saídas + Diário agrupados por categoria
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("categories")}
                    className="text-[11px] font-bold text-[#2d6a3e] hover:underline cursor-pointer"
                  >
                    Ver Pareto →
                  </button>
                </div>

                <div className="flex items-center gap-4 my-2">
                  <DonutChartSvg
                    items={tagAnalytics.breakdown}
                    grandTotal={tagAnalytics.grandTotal}
                    hoveredTag={hoveredTag}
                    onHoverTag={setHoveredTag}
                    onSelectTag={(t) => {
                      setSelectedTagFilter(t);
                      setActiveTab("categories");
                    }}
                  />

                  <div className="flex-1 space-y-1.5 min-w-0">
                    {tagAnalytics.breakdown.slice(0, 5).map((item) => (
                      <button
                        key={item.tag}
                        type="button"
                        onMouseEnter={() => setHoveredTag(item.tag)}
                        onMouseLeave={() => setHoveredTag(null)}
                        onClick={() => {
                          setSelectedTagFilter(item.tag);
                          setActiveTab("categories");
                        }}
                        className="w-full flex items-center justify-between gap-2 text-xs px-2 py-1 rounded-lg hover:bg-[#eff3f0] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ backgroundColor: item.color }}
                          />
                          <span className="font-semibold text-[#141f17] truncate">
                            {item.tag}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0 tabular-nums">
                          <span className="font-bold text-[#141f17]">
                            {formatBRL(item.total)}
                          </span>
                          <span className="text-[10px] font-semibold text-[#526657] w-9 text-right">
                            {item.sharePct}%
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#eff3f0] flex items-center justify-between text-[11px] text-[#526657]">
                  <span>
                    {tagAnalytics.totalTransactionsCount} lançamentos analisados
                  </span>
                  <span className="font-bold text-[#141f17]">
                    Total: {formatBRL(tagAnalytics.grandTotal)}
                  </span>
                </div>
              </div>

              {/* Daily Deviation Bar Chart (7 cols) */}
              <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h3 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                      Gasto Diário vs. Teto ({activeMonthCol.title})
                    </h3>
                    <p className="text-[11px] text-[#526657]">
                      Verde: dentro da meta • Laranja: acima de{" "}
                      {formatBRL(metrics.targetPerDay)} • Clique na barra para
                      editar o dia
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab("heatmap")}
                    className="text-[11px] font-bold text-[#2d6a3e] hover:underline cursor-pointer"
                  >
                    Mapa de Calor →
                  </button>
                </div>

                <div className="relative h-44 pt-5 pb-1 flex items-end gap-1 select-none">
                  <div
                    className="absolute left-0 right-0 border-t border-dashed border-[#2d6a3e] pointer-events-none z-10"
                    style={{
                      bottom: `${Math.min(
                        90,
                        Math.max(
                          10,
                          (metrics.targetPerDay / maxChartDaily) * 100
                        )
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
                        onClick={() =>
                          setSelectedDayForDetail(d.date, "expense_daily")
                        }
                        className="flex-1 h-full flex flex-col justify-end items-center group relative cursor-pointer"
                      >
                        <div className="hidden group-hover:block absolute -top-7 z-20 bg-[#141f17] text-white text-[10px] px-2 py-0.5 rounded whitespace-nowrap shadow-md">
                          {formatShortDate(d.date)}: {formatBRL(d.dailyAmount)}
                        </div>

                        <div
                          className={`w-full rounded-t transition-all group-hover:opacity-85 ${
                            d.isToday
                              ? "bg-[#1b5e20] ring-2 ring-[#2d6a3e]"
                              : d.isFuture
                              ? "bg-[#e3ebe5] border border-dashed border-[#6e8574]"
                              : isOver
                              ? "bg-[#e68a00]"
                              : d.dailyAmount === 0
                              ? "bg-[#cbd5e1]"
                              : "bg-[#6aa84f]"
                          }`}
                          style={{ height: `${heightPct}%` }}
                        />
                        <span
                          className={`mt-1 text-[9px] ${
                            d.isToday
                              ? "font-bold text-[#1b5e20]"
                              : "text-[#526657]"
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
          </div>
        )}

        {/* ===================================================================== */}
        {/* DASHBOARD SECTION 2: TAGS, PARETO 80/20 & EXPLORADOR DE TRANSAÇÕES */}
        {/* ===================================================================== */}
        {activeTab === "categories" && (
          <div className="space-y-4">
            {/* Filters Bar */}
            <div className="bg-white p-3 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-bold text-[#141f17] flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>Período:</span>
                </span>
                <div className="flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8] text-xs font-semibold">
                  <button
                    type="button"
                    onClick={() => setTagPeriodScope("month")}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      tagPeriodScope === "month"
                        ? "bg-white text-[#141f17] shadow-2xs"
                        : "text-[#4e6153]"
                    }`}
                  >
                    {activeMonthCol.title}
                  </button>
                  <button
                    type="button"
                    onClick={() => setTagPeriodScope("quarter")}
                    className={`px-2.5 py-1 rounded-md cursor-pointer ${
                      tagPeriodScope === "quarter"
                        ? "bg-white text-[#141f17] shadow-2xs"
                        : "text-[#4e6153]"
                    }`}
                  >
                    Trimestre (3 Meses)
                  </button>
                </div>

                <div className="flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8] text-xs font-semibold">
                  {(
                    [
                      { id: "all_expenses", label: "Saídas + Diário" },
                      { id: "expense_daily", label: "Apenas Diário" },
                      { id: "expense_fixed", label: "Apenas Saídas Fixas" },
                    ] as const
                  ).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setTagExpenseFilter(opt.id)}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        tagExpenseFilter === opt.id
                          ? "bg-white text-[#141f17] shadow-2xs"
                          : "text-[#4e6153]"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {selectedTagFilter && (
                <button
                  type="button"
                  onClick={() => setSelectedTagFilter(null)}
                  className="h-7 px-2.5 rounded-lg bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  <span>Filtro ativo: {selectedTagFilter}</span>
                  <span>✕</span>
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Left: Donut Chart + Pareto 80/20 Ranking (6 cols) */}
              <div className="lg:col-span-6 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                      Curva de Pareto 80/20 por Tag / Categoria
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Clique em uma tag para filtrar os lançamentos ao lado
                    </p>
                  </div>
                  <span className="text-xs font-extrabold text-[#141f17] tabular-nums">
                    Total: {formatBRL(tagAnalytics.grandTotal)}
                  </span>
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-5 py-2">
                  <DonutChartSvg
                    items={tagAnalytics.breakdown}
                    grandTotal={tagAnalytics.grandTotal}
                    hoveredTag={hoveredTag || selectedTagFilter}
                    onHoverTag={setHoveredTag}
                    onSelectTag={(t) =>
                      setSelectedTagFilter((prev) => (prev === t ? null : t))
                    }
                    size={156}
                  />

                  <div className="flex-1 w-full space-y-2">
                    {tagAnalytics.breakdown.length === 0 ? (
                      <div className="text-xs text-[#526657] text-center py-6">
                        Nenhum gasto encontrado para este filtro.
                      </div>
                    ) : (
                      tagAnalytics.breakdown.map((item) => {
                        const isSelected = selectedTagFilter === item.tag;
                        return (
                          <button
                            key={item.tag}
                            type="button"
                            onMouseEnter={() => setHoveredTag(item.tag)}
                            onMouseLeave={() => setHoveredTag(null)}
                            onClick={() =>
                              setSelectedTagFilter((prev) =>
                                prev === item.tag ? null : item.tag
                              )
                            }
                            className={`w-full p-2 rounded-xl border text-left transition-all cursor-pointer ${
                              isSelected
                                ? "bg-[#eef6f0] border-[#2d6a3e] ring-1 ring-[#2d6a3e]"
                                : "bg-[#f8faf8] border-[#e4ebe6] hover:border-[#b9c7bd]"
                            }`}
                          >
                            <div className="flex items-center justify-between text-xs">
                              <div className="flex items-center gap-2 min-w-0">
                                <span
                                  className="w-3 h-3 rounded-full shrink-0"
                                  style={{ backgroundColor: item.color }}
                                />
                                <span className="font-bold text-[#141f17] truncate">
                                  {item.tag}
                                </span>
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-white border border-[#d5ded8] text-[#526657] font-semibold">
                                  {item.count}x • Méd{" "}
                                  {formatBRL(item.avgTicket)}
                                </span>
                              </div>
                              <div className="text-right tabular-nums shrink-0">
                                <span className="font-extrabold text-[#141f17]">
                                  {formatBRL(item.total)}
                                </span>
                                <span className="ml-1.5 text-[11px] font-bold text-[#2d6a3e]">
                                  ({item.sharePct}%)
                                </span>
                              </div>
                            </div>

                            <div className="mt-1.5 h-1.5 w-full rounded-full bg-[#e4ebe6] overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${Math.max(3, item.sharePct)}%`,
                                  backgroundColor: item.color,
                                }}
                              />
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Top Transactions & Merchants Explorer (6 cols) */}
              <div className="lg:col-span-6 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                      Ranking de Lançamentos ({tagAnalytics.filteredItems.length})
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Maiores gastos individuais • Clique para editar no dia
                    </p>
                  </div>

                  <div className="relative w-48">
                    <Search className="w-3.5 h-3.5 text-[#526657] absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={txSearchQuery}
                      onChange={(e) => setTxSearchQuery(e.target.value)}
                      placeholder="Buscar descrição ou tag..."
                      className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-[#c5d1c8] text-xs text-[#141f17]"
                    />
                  </div>
                </div>

                <div className="max-h-[370px] overflow-y-auto thin-scroll divide-y divide-[#eff3f0] border border-[#e4ebe6] rounded-xl">
                  {tagAnalytics.filteredItems.length === 0 ? (
                    <div className="p-8 text-center text-xs text-[#526657]">
                      Nenhum lançamento encontrado.
                    </div>
                  ) : (
                    tagAnalytics.filteredItems.slice(0, 45).map((item) => (
                      <button
                        key={`${item.id}_${item.date}`}
                        type="button"
                        onClick={() =>
                          setSelectedDayForDetail(item.date, item.type)
                        }
                        className="w-full px-3 py-2.5 flex items-center justify-between gap-2 hover:bg-[#f4f8f5] text-left transition-colors cursor-pointer"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                item.type === "expense_daily"
                                  ? "bg-[#fff3cd] text-[#7c5800]"
                                  : "bg-[#ffebee] text-[#9e1c1c]"
                              }`}
                            >
                              {item.type === "expense_daily"
                                ? "Diário"
                                : "Saída"}
                            </span>
                            <span className="text-xs font-bold text-[#141f17] truncate">
                              {item.title}
                              {item.installmentLabel
                                ? ` (${item.installmentLabel})`
                                : ""}
                            </span>
                            <span className="px-1.5 py-0.2 rounded bg-[#eff3f0] border border-[#d5ded8] text-[10px] font-semibold text-[#4e6153]">
                              {item.tag}
                            </span>
                          </div>
                          <div className="text-[11px] text-[#526657] mt-0.5">
                            {formatFullDate(item.date)}
                          </div>
                        </div>

                        <span className="text-xs font-extrabold text-[#9e1c1c] tabular-nums shrink-0">
                          - {formatBRL(item.amount)}
                        </span>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* DASHBOARD SECTION 3: MAPA DE CALOR (CALENDAR HEATMAP) & PERFIL SEMANAL */}
        {/* ===================================================================== */}
        {activeTab === "heatmap" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* Calendar Heatmap Matrix (7 cols) */}
              <div className="lg:col-span-7 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                      Mapa de Calor Diário • {activeMonthCol.title}
                    </h2>
                    <p className="text-[11px] text-[#526657]">
                      Intensidade de gasto por dia do mês • Clique em qualquer
                      dia para editar
                    </p>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-1.5 text-[10px] font-bold">
                    <span className="px-1.5 py-0.5 rounded bg-[#d1fae5] text-[#065f46]">
                      R$ 0
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#dcfce7] text-[#166534]">
                      ≤ Meta
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#fef3c7] text-[#92400e]">
                      &gt; Meta
                    </span>
                    <span className="px-1.5 py-0.5 rounded bg-[#fee2e2] text-[#991b1b]">
                      Estouro
                    </span>
                  </div>
                </div>

                {/* 7-Column Calendar Header */}
                <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-bold text-[#526657]">
                  {WEEKDAY_LABELS.map((w) => (
                    <div key={w} className="py-1">
                      {w}
                    </div>
                  ))}
                </div>

                {/* Calendar Cells */}
                <div className="grid grid-cols-7 gap-1.5">
                  {calendarHeatmapCells.map((cell) => {
                    if (!cell.day) {
                      return (
                        <div
                          key={cell.key}
                          className="h-16 rounded-xl bg-[#f8faf8] border border-dashed border-[#e4ebe6]"
                        />
                      );
                    }
                    const d = cell.day;
                    const ratio =
                      d.dailyTarget > 0 ? d.dailyAmount / d.dailyTarget : 0;

                    let boxClass =
                      "bg-white border-[#d5ded8] text-[#141f17]";
                    if (d.isFuture) {
                      boxClass =
                        "bg-[#f8faf8] border-dashed border-[#c5d1c8] text-[#526657]";
                    } else if (d.dailyAmount === 0) {
                      boxClass =
                        "bg-[#d1fae5] border-[#6ee7b7] text-[#065f46]";
                    } else if (ratio <= 0.75) {
                      boxClass =
                        "bg-[#dcfce7] border-[#86efac] text-[#166534]";
                    } else if (ratio <= 1) {
                      boxClass =
                        "bg-[#f0fdf4] border-[#bbf7d0] text-[#15803d]";
                    } else if (ratio <= 1.5) {
                      boxClass =
                        "bg-[#fef3c7] border-[#fde68a] text-[#92400e]";
                    } else {
                      boxClass =
                        "bg-[#fee2e2] border-[#fca5a5] text-[#991b1b]";
                    }

                    return (
                      <button
                        key={d.date}
                        type="button"
                        onClick={() =>
                          setSelectedDayForDetail(d.date, "expense_daily")
                        }
                        className={`h-16 p-1.5 rounded-xl border flex flex-col justify-between text-left transition-transform hover:scale-[1.03] cursor-pointer ${boxClass} ${
                          d.isToday
                            ? "ring-2 ring-[#1b5e20] shadow-sm"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="text-[11px] font-extrabold tabular-nums">
                            {String(d.dayOfMonth).padStart(2, "0")}
                          </span>
                          {d.isToday && (
                            <span className="px-1 py-0.2 rounded bg-[#1b5e20] text-white text-[8px] font-bold">
                              HOJE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] font-extrabold tabular-nums truncate w-full">
                          {d.dailyAmount > 0 ? formatBRL(d.dailyAmount) : "R$ 0"}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 7-Day Weekday Profile & Streaks (5 cols) */}
              <div className="lg:col-span-5 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs flex flex-col justify-between space-y-4">
                <div>
                  <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                    Perfil por Dia da Semana (Seg a Dom)
                  </h2>
                  <p className="text-[11px] text-[#526657]">
                    Média histórica de gasto diário em cada dia da semana
                  </p>
                </div>

                <div className="space-y-2.5">
                  {metrics.weekdayProfile.map((w) => {
                    const maxDowAvg = Math.max(
                      metrics.targetPerDay,
                      ...metrics.weekdayProfile.map((p) => p.avg)
                    );
                    const pct =
                      maxDowAvg > 0
                        ? Math.min(100, Math.round((w.avg / maxDowAvg) * 100))
                        : 0;
                    const isOver = w.avg > metrics.targetPerDay;

                    return (
                      <div key={w.label} className="space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-[#141f17] flex items-center gap-1.5">
                            <span className="w-8">{w.label}</span>
                            {w.isWeekend && (
                              <span className="px-1.5 py-0.2 rounded bg-[#fff3cd] text-[#7c5800] text-[9.5px] font-bold">
                                FDS
                              </span>
                            )}
                          </span>
                          <span
                            className={`font-extrabold tabular-nums ${
                              isOver ? "text-[#9e1c1c]" : "text-[#1b5e20]"
                            }`}
                          >
                            {formatBRL(w.avg)}/dia
                          </span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-[#eff3f0] overflow-hidden">
                          <div
                            className={`h-full rounded-full ${
                              isOver ? "bg-[#e68a00]" : "bg-[#2d6a3e]"
                            }`}
                            style={{ width: `${Math.max(4, pct)}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Discipline & Streak Badges */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[#eff3f0] text-center">
                  <div className="p-2 rounded-xl bg-[#eff3f0] border border-[#d5ded8]">
                    <div className="text-[10px] font-bold text-[#526657] uppercase">
                      Melhor Streak
                    </div>
                    <div className="text-sm font-extrabold text-[#1b5e20] mt-0.5">
                      {metrics.bestStreak} dias
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#eff3f0] border border-[#d5ded8]">
                    <div className="text-[10px] font-bold text-[#526657] uppercase">
                      Mais Econômico
                    </div>
                    <div className="text-sm font-extrabold text-[#141f17] mt-0.5">
                      {metrics.lowestSpendDow?.label || "-"}
                    </div>
                  </div>
                  <div className="p-2 rounded-xl bg-[#eff3f0] border border-[#d5ded8]">
                    <div className="text-[10px] font-bold text-[#526657] uppercase">
                      Maior Gasto
                    </div>
                    <div className="text-sm font-extrabold text-[#9e1c1c] mt-0.5">
                      {metrics.highestSpendDow?.label || "-"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* DASHBOARD SECTION 4: COMPARATIVO 3 MESES, REGRA 50/30/20 & SEMANAS */}
        {/* ===================================================================== */}
        {activeTab === "quarterly" && (
          <div className="space-y-4">
            {/* 3-Month Comparison Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              {projection.months.map((mCol) => {
                const totalOut = Number(
                  (mCol.totalFixedExpense + mCol.totalDailySpend).toFixed(2)
                );
                const net = Number((mCol.totalIncome - totalOut).toFixed(2));
                const maxBar = Math.max(
                  1,
                  mCol.totalIncome,
                  mCol.totalFixedExpense,
                  mCol.totalDailySpend
                );

                return (
                  <div
                    key={mCol.yearMonth}
                    className={`bg-white p-4 rounded-2xl border shadow-2xs space-y-3 ${
                      mCol.isCurrentMonth
                        ? "border-[#2d6a3e] ring-1 ring-[#2d6a3e]"
                        : "border-[#cfd8d2]"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-[10px] font-bold text-[#2d6a3e] uppercase">
                          {mCol.roleLabel}
                        </span>
                        <h3 className="text-sm font-extrabold text-[#141f17]">
                          {mCol.title}
                        </h3>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-lg text-xs font-extrabold tabular-nums ${
                          net >= 0
                            ? "bg-[#e8f5e9] text-[#1b5e20]"
                            : "bg-[#ffebee] text-[#9e1c1c]"
                        }`}
                      >
                        {formatBRL(net, true)}
                      </span>
                    </div>

                    {/* Visual Horizontal Comparison Bars */}
                    <div className="space-y-2 text-xs tabular-nums">
                      <div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-[#526657]">Entradas</span>
                          <span className="text-[#1b5e20] font-bold">
                            {formatBRL(mCol.totalIncome)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#eff3f0] overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-[#2d6a3e] rounded-full"
                            style={{
                              width: `${
                                (mCol.totalIncome / maxBar) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-[#526657]">Saídas Fixas</span>
                          <span className="text-[#9e1c1c] font-bold">
                            {formatBRL(mCol.totalFixedExpense)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#eff3f0] overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-[#e06666] rounded-full"
                            style={{
                              width: `${
                                (mCol.totalFixedExpense / maxBar) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between font-semibold">
                          <span className="text-[#526657]">Gasto Diário</span>
                          <span className="text-[#7c5800] font-bold">
                            {formatBRL(mCol.totalDailySpend)}
                          </span>
                        </div>
                        <div className="h-2 rounded-full bg-[#eff3f0] overflow-hidden mt-0.5">
                          <div
                            className="h-full bg-[#f59e0b] rounded-full"
                            style={{
                              width: `${
                                (mCol.totalDailySpend / maxBar) * 100
                              }%`,
                            }}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-[#eff3f0] flex items-center justify-between text-xs">
                      <span className="text-[#526657] font-medium">
                        Saldo Fim do Mês:
                      </span>
                      <span className="font-extrabold text-[#141f17] tabular-nums">
                        {formatBRL(mCol.endingBalance)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Row 2: 50/30/20 Income Allocation Benchmark + Weekly Burn-Rate */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3.5">
              {/* 50/30/20 Benchmark (6 cols) */}
              <div className="lg:col-span-6 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs space-y-3">
                <div>
                  <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                    Alocação da Renda (Benchmark 50 / 30 / 20) •{" "}
                    {activeMonthCol.title}
                  </h2>
                  <p className="text-[11px] text-[#526657]">
                    Como cada R$ 100 de Entrada está distribuído entre Saídas,
                    Diário e Poupança
                  </p>
                </div>

                {/* Stacked Bar */}
                <div className="h-5 w-full rounded-xl bg-[#eff3f0] overflow-hidden flex border border-[#cfd8d2]">
                  <div
                    className="h-full bg-[#e06666] transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, metrics.fixedShareOfIncomePct)
                      )}%`,
                    }}
                    title={`Saídas Fixas: ${metrics.fixedShareOfIncomePct}%`}
                  />
                  <div
                    className="h-full bg-[#f59e0b] transition-all"
                    style={{
                      width: `${Math.min(
                        100,
                        Math.max(0, metrics.dailyShareOfIncomePct)
                      )}%`,
                    }}
                    title={`Diário: ${metrics.dailyShareOfIncomePct}%`}
                  />
                  {metrics.savingsRatePct > 0 && (
                    <div
                      className="h-full bg-[#2d6a3e] transition-all"
                      style={{
                        width: `${Math.min(
                          100,
                          Math.max(0, metrics.savingsRatePct)
                        )}%`,
                      }}
                      title={`Poupança Livre: ${metrics.savingsRatePct}%`}
                    />
                  )}
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div className="p-2.5 rounded-xl bg-[#ffebee]/60 border border-[#ef9a9a]">
                    <div className="text-[10px] font-bold text-[#9e1c1c] uppercase">
                      Saídas Fixas (Ideal ≤ 50%)
                    </div>
                    <div className="text-base font-extrabold text-[#141f17] tabular-nums mt-0.5">
                      {metrics.fixedShareOfIncomePct}%
                    </div>
                    <div className="text-[11px] text-[#526657] tabular-nums">
                      {formatBRL(metrics.monthFixedOut)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#fff3cd]/60 border border-[#ffe69c]">
                    <div className="text-[10px] font-bold text-[#7c5800] uppercase">
                      Diário Variável (Ideal ≤ 30%)
                    </div>
                    <div className="text-base font-extrabold text-[#141f17] tabular-nums mt-0.5">
                      {metrics.dailyShareOfIncomePct}%
                    </div>
                    <div className="text-[11px] text-[#526657] tabular-nums">
                      {formatBRL(metrics.monthDailyOut)}
                    </div>
                  </div>

                  <div className="p-2.5 rounded-xl bg-[#e8f5e9]/70 border border-[#a5d6a7]">
                    <div className="text-[10px] font-bold text-[#1b5e20] uppercase">
                      Margem Livre (Ideal ≥ 20%)
                    </div>
                    <div className="text-base font-extrabold text-[#1b5e20] tabular-nums mt-0.5">
                      {metrics.savingsRatePct}%
                    </div>
                    <div className="text-[11px] text-[#526657] tabular-nums">
                      {formatBRL(metrics.monthNetFlow, true)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Weekly Burn-Rate (6 cols) */}
              <div className="lg:col-span-6 bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs space-y-3">
                <div>
                  <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                    Velocidade de Gasto por Semana • {activeMonthCol.title}
                  </h2>
                  <p className="text-[11px] text-[#526657]">
                    Comparativo entre o orçamento semanal permitido e o gasto
                    diário acumulado
                  </p>
                </div>

                <div className="space-y-2 text-xs tabular-nums">
                  {metrics.weeklyBreakdown.map((w) => (
                    <div
                      key={w.id}
                      className="p-2 rounded-xl bg-[#f8faf8] border border-[#e4ebe6] flex items-center justify-between gap-2"
                    >
                      <div>
                        <div className="font-bold text-[#141f17]">
                          {w.label}
                        </div>
                        <div className="text-[11px] text-[#526657]">
                          Média: {formatBRL(w.avgDaily)}/dia • Teto sem:{" "}
                          {formatBRL(w.budgetAllowed)}
                        </div>
                      </div>

                      <div className="text-right">
                        <div className="font-extrabold text-[#141f17]">
                          Diário: {formatBRL(w.dailySum)}
                        </div>
                        <div
                          className={`text-[11px] font-bold ${
                            w.diffFromTarget >= 0
                              ? "text-[#1b5e20]"
                              : "text-[#9e1c1c]"
                          }`}
                        >
                          {w.diffFromTarget >= 0 ? "Economia: " : "Excesso: "}
                          {formatBRL(w.diffFromTarget, true)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ===================================================================== */}
        {/* DASHBOARD SECTION 5: SIMULADOR INTERATIVO WHAT-IF & TABELA DE AUDITORIA */}
        {/* ===================================================================== */}
        {activeTab === "audit" && (
          <div className="space-y-4">
            {/* Interactive What-If Simulator Card */}
            <div className="bg-white p-4 rounded-2xl border border-[#cfd8d2] shadow-2xs space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
                    <FlaskConical className="w-4 h-4 text-[#2d6a3e]" />
                    <span>
                      Simulador de Stress-Test (Dias Restantes de{" "}
                      {activeMonthCol.title})
                    </span>
                  </h2>
                  <p className="text-[11px] text-[#526657]">
                    Ajuste o teto diário para os{" "}
                    <strong>{metrics.futureDays.length} dias futuros</strong> do
                    mês e veja o efeito imediato no saldo final
                  </p>
                </div>

                {(stagedTransactions.length > 0 ||
                  stagedOverrides.length > 0) && (
                  <button
                    type="button"
                    onClick={discardAllStagedChanges}
                    className="h-8 px-3 rounded-lg border border-[#ef9a9a] bg-[#ffebee] text-[#9e1c1c] text-xs font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Limpar Simulações Ativas</span>
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center bg-[#f8faf8] p-3.5 rounded-xl border border-[#e4ebe6]">
                <div className="md:col-span-6 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-[#526657]">
                      Novo Teto Diário Simulado:
                    </span>
                    <span className="text-base font-extrabold text-[#2d6a3e] tabular-nums">
                      {formatBRL(effectiveSliderValue)}/dia
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={150}
                    step={5}
                    value={effectiveSliderValue}
                    onChange={(e) =>
                      setSimSliderTarget(Number(e.target.value))
                    }
                    className="w-full accent-[#2d6a3e] cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] font-semibold text-[#526657]">
                    <span>R$ 0 (Zero)</span>
                    <span>Meta Atual ({formatBRL(metrics.targetPerDay)})</span>
                    <span>R$ 150/dia</span>
                  </div>
                </div>

                <div className="md:col-span-6 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-0.5 tabular-nums">
                    <div className="text-[11px] text-[#526657]">
                      Impacto nos {metrics.futureDays.length} dias restantes:
                    </div>
                    <div
                      className={`text-sm font-extrabold ${
                        sliderProjectedDelta >= 0
                          ? "text-[#1b5e20]"
                          : "text-[#9e1c1c]"
                      }`}
                    >
                      {formatBRL(sliderProjectedDelta, true)} no Fim do Mês
                    </div>
                    <div className="text-xs font-bold text-[#141f17]">
                      Novo Saldo Fim Mês:{" "}
                      {formatBRL(
                        Number(
                          (projectedEndOfMonth + sliderProjectedDelta).toFixed(
                            2
                          )
                        )
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleApplyCustomSliderSimulation}
                    className="h-9 px-4 rounded-xl bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <FlaskConical className="w-3.5 h-3.5" />
                    <span>Aplicar na Planilha</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Full Daily Audit Table */}
            <div className="bg-white rounded-2xl border border-[#cfd8d2] shadow-2xs overflow-hidden">
              <div className="p-3 border-b border-[#e4ebe6] flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                    Auditoria Diária: Poderia Gastar x Gastou (
                    {filteredAuditRows.length} dias)
                  </h3>
                </div>

                <div className="flex items-center gap-1 bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8] text-[11px] font-semibold">
                  {(
                    [
                      { id: "all", label: "Mês Completo" },
                      { id: "elapsed", label: "Passados + Hoje" },
                      { id: "over_target", label: "Apenas Estouros" },
                      { id: "saved", label: "Dias Economizados" },
                    ] as const
                  ).map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setAuditFilter(f.id)}
                      className={`px-2.5 py-1 rounded-md cursor-pointer ${
                        auditFilter === f.id
                          ? "bg-white text-[#141f17] shadow-2xs"
                          : "text-[#4e6153]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>

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
                    {filteredAuditRows.map(
                      ({
                        day,
                        runningAllowed,
                        runningSpent,
                        dayDiff,
                        cumulativeDiff,
                      }) => (
                        <tr
                          key={day.date}
                          onClick={() =>
                            setSelectedDayForDetail(day.date, "expense_daily")
                          }
                          className={`cursor-pointer hover:brightness-95 ${
                            day.isToday
                              ? "bg-[#bdd7c5] font-bold"
                              : day.isPast
                              ? "bg-[#dce6df]"
                              : "bg-white"
                          }`}
                        >
                          <td className="py-1.5 px-3">
                            {formatFullDate(day.date)}
                          </td>
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
                              cumulativeDiff >= 0
                                ? "text-[#1b5e20]"
                                : "text-[#9e1c1c]"
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
          </div>
        )}
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

interface DonutChartSvgProps {
  items: Array<{
    tag: string;
    total: number;
    sharePct: number;
    color: string;
  }>;
  grandTotal: number;
  hoveredTag: string | null;
  onHoverTag: (tag: string | null) => void;
  onSelectTag: (tag: string) => void;
  size?: number;
}

function DonutChartSvg({
  items,
  grandTotal,
  hoveredTag,
  onHoverTag,
  onSelectTag,
  size = 132,
}: DonutChartSvgProps) {
  const radius = 38;
  const circumference = 2 * Math.PI * radius;

  const activeItem = useMemo(
    () =>
      (hoveredTag && items.find((i) => i.tag === hoveredTag)) ||
      items[0] ||
      null,
    [hoveredTag, items]
  );

  let accumulatedPct = 0;

  return (
    <div
      style={{ width: size, height: size }}
      className="relative shrink-0 flex items-center justify-center select-none"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle
          cx="50"
          cy="50"
          r={radius}
          fill="none"
          stroke="#eff3f0"
          strokeWidth="12"
        />
        {items.map((item) => {
          const pct = grandTotal > 0 ? item.total / grandTotal : 0;
          const dashLen = pct * circumference;
          const dashOffset = -accumulatedPct * circumference;
          accumulatedPct += pct;
          const isHighlighted = hoveredTag === item.tag;

          return (
            <circle
              key={item.tag}
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke={item.color}
              strokeWidth={isHighlighted ? "14.5" : "12"}
              strokeDasharray={`${Math.max(0, dashLen - 1.2)} ${circumference}`}
              strokeDashoffset={dashOffset}
              className="cursor-pointer transition-all duration-150"
              onMouseEnter={() => onHoverTag(item.tag)}
              onMouseLeave={() => onHoverTag(null)}
              onClick={() => onSelectTag(item.tag)}
            />
          );
        })}
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 pointer-events-none">
        {activeItem ? (
          <>
            <span className="text-[10px] font-bold text-[#526657] truncate max-w-[85px]">
              {activeItem.tag}
            </span>
            <span className="text-xs font-extrabold text-[#141f17] tabular-nums leading-tight">
              {activeItem.sharePct}%
            </span>
          </>
        ) : (
          <span className="text-[10px] font-bold text-[#526657]">Sem dados</span>
        )}
      </div>
    </div>
  );
}
