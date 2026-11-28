"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  CalendarDays,
  CalendarClock,
  Bell,
  ArrowRight,
  Sparkles,
  ArrowLeftRight,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  addMonthsToYearMonth,
  calculateCashflowProjection,
  type CashflowSettings,
  type ComputedDayRow,
  type ComputedMonthColumn,
  type DailyOverrideRecord,
  type RecurringOccurrenceRecord,
  type RecurringRuleRecord,
  type TransactionRecord,
} from "@/lib/cashflow-engine";
import { formatBRL, formatFullDate, formatShortDate } from "@/lib/format";
import { TopNavbar } from "@/core/components/top-navbar";
import { LaunchModal } from "./launch-modal";
import { DayDetailDrawer } from "./day-detail-drawer";
import { SimulationFloatingBar } from "./simulation-floating-bar";
import { SettingsAndRecurringModals } from "./settings-and-recurring-modals";
import { MobileQuickEntry } from "./mobile-quick-entry";
import { NotificationsValidator } from "./notifications-validator";
import {
  fetchInitialCashflowData,
  fetchMobileNotificationsAction,
  moveDayFieldTransactionsAction,
} from "@/app/actions";

export type FieldColumnType = "income" | "expense_fixed" | "expense_daily";

export interface DraggedCellInfo {
  sourceDate: string;
  colType: FieldColumnType;
  amount: number;
}

export interface DragTargetInfo {
  targetDate: string;
  targetColType: FieldColumnType;
}

function getFieldMeta(colType: FieldColumnType) {
  switch (colType) {
    case "income":
      return {
        label: "Entrada",
        badgeBg: "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]",
        targetCellClass:
          "bg-[#c8e6c9]/90 ring-2 ring-inset ring-[#1b5e20] text-[#0d3b10] font-extrabold shadow-inner",
        pulseBg: "bg-[#a5d6a7]/50 ring-2 ring-inset ring-[#1b5e20]",
        sourceRing: "ring-[#1b5e20]",
      };
    case "expense_daily":
      return {
        label: "Diário",
        badgeBg: "bg-[#fff3cd] text-[#7c5800] border-[#ffe69c]",
        targetCellClass:
          "bg-[#ffe69c]/90 ring-2 ring-inset ring-[#b27d00] text-[#4d3600] font-extrabold shadow-inner",
        pulseBg: "bg-[#ffe69c]/65 ring-2 ring-inset ring-[#b27d00]",
        sourceRing: "ring-[#b27d00]",
      };
    default:
      return {
        label: "Saída",
        badgeBg: "bg-[#ffebee] text-[#9e1c1c] border-[#ef9a9a]",
        targetCellClass:
          "bg-[#ffcdd2]/90 ring-2 ring-inset ring-[#9e1c1c] text-[#5f0f0f] font-extrabold shadow-inner",
        pulseBg: "bg-[#ffcdd2]/65 ring-2 ring-inset ring-[#9e1c1c]",
        sourceRing: "ring-[#9e1c1c]",
      };
  }
}

interface CashflowDashboardClientProps {
  initialData: {
    settings: CashflowSettings;
    transactions: TransactionRecord[];
    dailyOverrides: DailyOverrideRecord[];
    recurringRules: RecurringRuleRecord[];
    recurringOccurrences: RecurringOccurrenceRecord[];
  };
}

export function CashflowDashboardClient({ initialData }: CashflowDashboardClientProps) {
  const {
    isHydrated,
    hydrateFromServer,
    settings,
    centerYearMonth,
    navigateMonths,
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
    setRecurringModalOpen,
    moveDayFieldOptimistic,
  } = useCashflowStore();

  const [mobileTab, setMobileTab] = useState<"launch" | "notifications" | "month">("launch");
  const [showPastMobileDays, setShowPastMobileDays] = useState(false);
  const [pendingNotifCount, setPendingNotifCount] = useState(0);
  const [draggedCell, setDraggedCell] = useState<DraggedCellInfo | null>(null);
  const [dragTarget, setDragTarget] = useState<DragTargetInfo | null>(null);
  const [dragCursor, setDragCursor] = useState<{ x: number; y: number } | null>(
    null
  );
  const [recentlyDropped, setRecentlyDropped] = useState<{
    date: string;
    colType: FieldColumnType;
    key: number;
  } | null>(null);

  const emptyDragImgRef = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    if (typeof document !== "undefined") {
      const canvas = document.createElement("canvas");
      canvas.width = 1;
      canvas.height = 1;
      emptyDragImgRef.current = canvas;
    }
  }, []);

  async function handleDropCell(
    info: DraggedCellInfo,
    targetDate: string,
    targetColType: FieldColumnType
  ) {
    setDraggedCell(null);
    setDragTarget(null);
    setDragCursor(null);
    if (
      !info ||
      !targetDate ||
      (info.sourceDate === targetDate && info.colType === targetColType)
    ) {
      return;
    }

    const sourceMeta = getFieldMeta(info.colType);
    const targetMeta = getFieldMeta(targetColType);
    const isTypeChange = info.colType !== targetColType;
    const isDateChange = info.sourceDate !== targetDate;

    // Instant 0ms optimistic update in store + landing spring animation
    moveDayFieldOptimistic(
      info.sourceDate,
      targetDate,
      info.colType,
      targetColType
    );
    setRecentlyDropped({
      date: targetDate,
      colType: targetColType,
      key: Date.now(),
    });
    window.setTimeout(() => {
      setRecentlyDropped((prev) =>
        prev && prev.date === targetDate && prev.colType === targetColType
          ? null
          : prev
      );
    }, 1150);

    try {
      await moveDayFieldTransactionsAction({
        sourceDate: info.sourceDate,
        targetDate,
        fieldType: info.colType,
        targetFieldType: targetColType,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);

      if (isTypeChange && !isDateChange) {
        toast.success(
          `Convertido de ${sourceMeta.label} para ${targetMeta.label} (${formatBRL(
            info.amount
          )}) em ${formatShortDate(targetDate)}`
        );
      } else if (isTypeChange && isDateChange) {
        toast.success(
          `${sourceMeta.label} (${formatBRL(info.amount)}) de ${formatShortDate(
            info.sourceDate
          )} ➔ ${targetMeta.label} em ${formatShortDate(targetDate)}`
        );
      } else {
        toast.success(
          `${sourceMeta.label} (${formatBRL(
            info.amount
          )}) movido de ${formatShortDate(
            info.sourceDate
          )} para ${formatShortDate(targetDate)}`
        );
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao mover ou converter lançamento.");
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
    }
  }

  useEffect(() => {
    hydrateFromServer(initialData);
  }, [initialData, hydrateFromServer]);

  useEffect(() => {
    fetchMobileNotificationsAction()
      .then((list) => {
        setPendingNotifCount(list.filter((n) => n.status === "pending").length);
      })
      .catch(() => {
        // ignore
      });
  }, []);

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

  const currentBalance =
    projection.todayRow?.projectedBalance ?? activeSettings.initialBalance;

  const centerMonthCol = projection.months[1];
  const endOfCenterMonthRow =
    centerMonthCol.days[centerMonthCol.days.length - 1] ?? null;
  const projectedEndOfMonth =
    endOfCenterMonthRow?.projectedBalance ?? currentBalance;
  const currentMonthEndBalance =
    projection.currentMonthEndRow?.projectedBalance ?? projectedEndOfMonth;

  const selectedDayRow = selectedDayForDetail
    ? projection.allDaysMap[selectedDayForDetail] || null
    : null;

  function handleExportCSV() {
    const rows: string[] = [
      "Data,Mes,Entrada,Saida,Diario,Saldo",
    ];
    for (const col of projection.months) {
      for (const d of col.days) {
        rows.push(
          `${d.date},${col.title},${d.incomeTotal.toFixed(2)},${d.fixedExpenseTotal.toFixed(
            2
          )},${d.dailyAmount.toFixed(2)},${d.projectedBalance.toFixed(2)}`
        );
      }
    }
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `cashflow_${visibleYearMonths[0]}_${visibleYearMonths[2]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado.");
  }

  return (
    <div className="min-h-dvh lg:h-dvh lg:overflow-hidden flex flex-col bg-[#f4f6f4] text-[#141f17]">
      <TopNavbar
        currentBalance={currentBalance}
        projectedEndOfMonth={projectedEndOfMonth}
        projectedQuarterEnd={projection.quarterEndRow?.projectedBalance}
        simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
        onExportCSV={handleExportCSV}
      />

      {/* DESKTOP VIEW: Pure 3-Month Spreadsheet Grid, 100dvh, Zero Excess Text, Zero Scroll */}
      <main
        className="hidden lg:flex flex-col flex-1 min-h-0 p-2 overflow-hidden relative"
        onDragOver={(e) => {
          if (draggedCell) {
            setDragCursor({ x: e.clientX, y: e.clientY });
          }
        }}
      >
        <div className="flex-1 min-h-0 bg-white rounded-lg border border-[#cfd8d2] shadow-2xs grid grid-cols-3 divide-x divide-[#cfd8d2] overflow-hidden">
          {projection.months.map((monthCol) => (
            <DesktopMonthColumn
              key={monthCol.yearMonth}
              column={monthCol}
              draggedCell={draggedCell}
              dragTarget={dragTarget}
              recentlyDropped={recentlyDropped}
              emptyDragCanvas={emptyDragImgRef.current}
              onDragStartCell={(info, clientX, clientY) => {
                setDraggedCell(info);
                setDragCursor({ x: clientX, y: clientY });
              }}
              onDragOverTarget={(target, clientX, clientY) => {
                setDragTarget(target);
                setDragCursor({ x: clientX, y: clientY });
              }}
              onDragEndCell={() => {
                setDraggedCell(null);
                setDragTarget(null);
                setDragCursor(null);
              }}
              onDropOnTarget={(info, targetDate, targetColType) =>
                handleDropCell(info, targetDate, targetColType)
              }
              onSelectCell={(dateIso, colType) =>
                setSelectedDayForDetail(dateIso, colType)
              }
            />
          ))}
        </div>

        {/* Floating Animated Drag Preview Pill following the Cursor */}
        <AnimatePresence>
          {draggedCell && dragCursor && (
            <FloatingDragPreviewCard
              draggedCell={draggedCell}
              dragTarget={dragTarget}
              cursor={dragCursor}
              allDaysMap={projection.allDaysMap}
            />
          )}
        </AnimatePresence>
      </main>

      {/* MOBILE VIEW: Quick Entry Hub (default) + Notifications Validator + Monthly Statement tab */}
      <main className="flex lg:hidden flex-col flex-1 px-3 py-3 gap-3 pb-24">
        {mobileTab === "launch" && pendingNotifCount > 0 && (
          <button
            type="button"
            onClick={() => setMobileTab("notifications")}
            className="w-full p-2.5 rounded-xl bg-[#e8f5e9] border border-[#2d6a3e] text-[#141f17] flex items-center justify-between gap-2 shadow-2xs active:scale-[0.99] cursor-pointer"
          >
            <div className="flex items-center gap-2 text-xs font-bold text-[#1b5e20]">
              <Bell className="w-4 h-4 shrink-0" />
              <span>
                {pendingNotifCount} notificação(ões) do celular aguardando aprovação
              </span>
            </div>
            <span className="px-2.5 py-1 rounded-lg bg-[#2d6a3e] text-white text-[11px] font-bold shrink-0">
              Validar →
            </span>
          </button>
        )}

        {mobileTab === "launch" ? (
          <MobileQuickEntry
            currentBalance={currentBalance}
            currentMonthEndBalance={currentMonthEndBalance}
            simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
            settings={activeSettings}
            allDaysMap={projection.allDaysMap}
            transactions={mergedTransactions}
            dailyOverrides={mergedOverrides}
          />
        ) : mobileTab === "notifications" ? (
          <NotificationsValidator
            allDaysMap={projection.allDaysMap}
            dailyOverrides={mergedOverrides}
            settings={activeSettings}
            onPendingCountChange={setPendingNotifCount}
          />
        ) : (
          <>
            <div className="flex items-center justify-between bg-white p-2 rounded-xl border border-[#cfd8d2]">
              <button
                type="button"
                onClick={() => navigateMonths(-1)}
                className="min-w-[44px] min-h-[44px] rounded-lg border border-[#d8e0da] flex items-center justify-center text-[#141f17] active:bg-[#eff3f0] cursor-pointer"
                aria-label="Mês anterior"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-sm font-bold text-[#141f17]">{centerMonthCol.title}</div>
              <button
                type="button"
                onClick={() => navigateMonths(1)}
                className="min-w-[44px] min-h-[44px] rounded-lg border border-[#d8e0da] flex items-center justify-center text-[#141f17] active:bg-[#eff3f0] cursor-pointer"
                aria-label="Próximo mês"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="bg-white p-2.5 rounded-xl border border-[#cfd8d2]">
                <div className="text-[11px] text-[#526657]">
                  Hoje ({formatShortDate(activeSettings.referenceToday)})
                </div>
                <div className="text-base font-bold tabular-nums text-[#141f17]">
                  {formatBRL(currentBalance)}
                </div>
              </div>

              <div className="bg-white p-2.5 rounded-xl border border-[#cfd8d2]">
                <div className="text-[11px] text-[#526657]">Fim do Mês</div>
                <div className="text-base font-bold tabular-nums text-[#1b5e20]">
                  {formatBRL(projectedEndOfMonth)}
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#cfd8d2] overflow-hidden">
              {centerMonthCol.days.some((d) => d.isPast) && (
                <button
                  type="button"
                  onClick={() => setShowPastMobileDays(!showPastMobileDays)}
                  className="w-full min-h-[44px] px-3.5 py-2 bg-[#e3ebe5] border-b border-[#cfd8d2] flex items-center justify-between text-xs font-semibold text-[#1f3325] cursor-pointer"
                >
                  <span>
                    {showPastMobileDays
                      ? "Ocultar dias passados"
                      : `Mostrar passados (${centerMonthCol.days.filter((d) => d.isPast).length})`}
                  </span>
                  {showPastMobileDays ? (
                    <ChevronUp className="w-4 h-4" />
                  ) : (
                    <ChevronDown className="w-4 h-4" />
                  )}
                </button>
              )}

              <div className="divide-y divide-[#e4ebe6]">
                {centerMonthCol.days
                  .filter((d) => showPastMobileDays || !d.isPast)
                  .map((d) => (
                    <div
                      key={d.date}
                      onClick={() => setSelectedDayForDetail(d.date)}
                      className={`px-3.5 py-3 flex items-center justify-between gap-2 cursor-pointer active:brightness-95 ${
                        d.isToday
                          ? "bg-[#c6decb] border-l-4 border-l-[#1b5e20] font-semibold"
                          : d.isPast
                          ? "bg-[#e3ebe5]"
                          : d.hasSimulation
                          ? "bg-[#fdf6e2]"
                          : "bg-white"
                      }`}
                    >
                      <div>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-[#141f17]">
                          <span>{formatFullDate(d.date)}</span>
                          {d.isToday && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#1b5e20] text-white">
                              HOJE
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-[#4e6153] mt-0.5 flex flex-wrap items-center gap-2">
                          {d.dailyAmount > 0 && <span>Diário: {formatBRL(d.dailyAmount)}</span>}
                          {d.fixedExpenseTotal > 0 && (
                            <span className="text-[#9e1c1c]">
                              Saída: {formatBRL(d.fixedExpenseTotal)}
                            </span>
                          )}
                          {d.incomeTotal > 0 && (
                            <span className="text-[#1b5e20]">
                              Entrada: {formatBRL(d.incomeTotal)}
                            </span>
                          )}
                        </div>
                      </div>

                      <span
                        className={`px-2.5 py-1 rounded-md text-xs font-bold tabular-nums ${d.liquidity.bgClass}`}
                      >
                        {formatBRL(d.projectedBalance)}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          </>
        )}

        {/* Mobile Bottom Navigation Bar */}
        <nav
          aria-label="Navegação mobile"
          className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-[#cfd8d2] px-2 pt-1.5 pb-safe z-30 shadow-[0_-2px_10px_rgba(20,31,23,0.06)]"
        >
          <div className="grid grid-cols-4 gap-1 pb-1.5">
            <button
              type="button"
              onClick={() => setMobileTab("launch")}
              className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                mobileTab === "launch"
                  ? "bg-[#e8f5e9] text-[#2d6a3e]"
                  : "text-[#4e6153] active:bg-[#eff3f0]"
              }`}
            >
              <PlusCircle className="w-5 h-5" />
              <span>Lançar</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab("notifications")}
              className={`relative min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                mobileTab === "notifications"
                  ? "bg-[#e8f5e9] text-[#2d6a3e]"
                  : "text-[#4e6153] active:bg-[#eff3f0]"
              }`}
            >
              <div className="relative">
                <Bell className="w-5 h-5" />
                {pendingNotifCount > 0 && (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#1b5e20] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {pendingNotifCount}
                  </span>
                )}
              </div>
              <span>Notificações</span>
            </button>

            <button
              type="button"
              onClick={() => setMobileTab("month")}
              className={`min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold transition-colors cursor-pointer ${
                mobileTab === "month"
                  ? "bg-[#e8f5e9] text-[#2d6a3e]"
                  : "text-[#4e6153] active:bg-[#eff3f0]"
              }`}
            >
              <CalendarDays className="w-5 h-5" />
              <span>Extrato</span>
            </button>

            <button
              type="button"
              onClick={() => setRecurringModalOpen(true)}
              className="min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 text-[11px] font-bold text-[#4e6153] active:bg-[#eff3f0] transition-colors cursor-pointer"
            >
              <CalendarClock className="w-5 h-5" />
              <span>Fixos</span>
            </button>
          </div>
        </nav>
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

interface FloatingDragPreviewCardProps {
  draggedCell: DraggedCellInfo;
  dragTarget: DragTargetInfo | null;
  cursor: { x: number; y: number };
  allDaysMap: Record<string, ComputedDayRow>;
}

function FloatingDragPreviewCard({
  draggedCell,
  dragTarget,
  cursor,
  allDaysMap,
}: FloatingDragPreviewCardProps) {
  const sourceMeta = getFieldMeta(draggedCell.colType);
  const isValidDrop =
    Boolean(dragTarget) &&
    (dragTarget!.targetDate !== draggedCell.sourceDate ||
      dragTarget!.targetColType !== draggedCell.colType);

  const targetMeta = dragTarget
    ? getFieldMeta(dragTarget.targetColType)
    : sourceMeta;

  const isTypeConversion =
    isValidDrop && dragTarget!.targetColType !== draggedCell.colType;

  const targetDayRow = dragTarget ? allDaysMap[dragTarget.targetDate] : null;
  const currentTargetAmount = useMemo(() => {
    if (!targetDayRow || !dragTarget) return 0;
    if (dragTarget.targetColType === "income") return targetDayRow.incomeTotal;
    if (dragTarget.targetColType === "expense_daily")
      return targetDayRow.dailyAmount;
    return targetDayRow.fixedExpenseTotal;
  }, [targetDayRow, dragTarget]);

  const newTargetAmount = Number(
    (currentTargetAmount + draggedCell.amount).toFixed(2)
  );

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.86, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.86 }}
      transition={{ type: "spring", stiffness: 520, damping: 28 }}
      style={{
        left: Math.min(
          typeof window !== "undefined" ? window.innerWidth - 270 : cursor.x,
          cursor.x + 16
        ),
        top: Math.min(
          typeof window !== "undefined" ? window.innerHeight - 110 : cursor.y,
          cursor.y + 14
        ),
      }}
      className="fixed z-50 pointer-events-none bg-white/95 backdrop-blur-md rounded-xl border border-[#2d6a3e]/40 shadow-2xl px-3 py-2 space-y-1.5 min-w-[215px]"
    >
      {/* Top Row: Source -> Target */}
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <div className="flex items-center gap-1">
          <span
            className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${sourceMeta.badgeBg}`}
          >
            {sourceMeta.label}
          </span>
          <span className="font-semibold text-[#526657]">
            {formatShortDate(draggedCell.sourceDate)}
          </span>
        </div>

        <span className="text-xs font-extrabold text-[#141f17] tabular-nums">
          {formatBRL(draggedCell.amount)}
        </span>
      </div>

      {/* Live Target Preview */}
      {isValidDrop && dragTarget ? (
        <motion.div
          key={`${dragTarget.targetDate}_${dragTarget.targetColType}`}
          initial={{ opacity: 0.6, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          className="pt-1.5 border-t border-[#e4ebe6] space-y-1"
        >
          <div className="flex items-center justify-between gap-2 text-[11px]">
            <div className="flex items-center gap-1">
              <ArrowRight className="w-3 h-3 text-[#2d6a3e] shrink-0" />
              <span
                className={`px-1.5 py-0.5 rounded border text-[10px] font-bold uppercase ${targetMeta.badgeBg}`}
              >
                {targetMeta.label}
              </span>
              <span className="font-bold text-[#141f17]">
                {formatShortDate(dragTarget.targetDate)}
              </span>
            </div>

            {isTypeConversion && (
              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded-full bg-[#2d6a3e] text-white text-[9.5px] font-bold">
                <ArrowLeftRight className="w-2.5 h-2.5" />
                <span>Trocar tipo</span>
              </span>
            )}
          </div>

          <div className="flex items-center justify-between text-[11px] bg-[#eff3f0] px-2 py-1 rounded-lg border border-[#d5ded8] tabular-nums">
            <span className="text-[#526657] font-medium">
              {formatBRL(currentTargetAmount)} + {formatBRL(draggedCell.amount)}
            </span>
            <span className="font-extrabold text-[#1b5e20]">
              ➔ {formatBRL(newTargetAmount)}
            </span>
          </div>
        </motion.div>
      ) : (
        <div className="pt-1 border-t border-[#e4ebe6] text-[10px] text-[#526657] flex items-center gap-1">
          <Sparkles className="w-3 h-3 text-[#2d6a3e]" />
          <span>Solte em outra data ou coluna (Entrada, Saída, Diário)</span>
        </div>
      )}
    </motion.div>
  );
}

interface DesktopMonthColumnProps {
  column: ComputedMonthColumn;
  draggedCell: DraggedCellInfo | null;
  dragTarget: DragTargetInfo | null;
  recentlyDropped: {
    date: string;
    colType: FieldColumnType;
    key: number;
  } | null;
  emptyDragCanvas: HTMLCanvasElement | null;
  onDragStartCell: (
    info: DraggedCellInfo,
    clientX: number,
    clientY: number
  ) => void;
  onDragOverTarget: (
    target: DragTargetInfo | null,
    clientX: number,
    clientY: number
  ) => void;
  onDragEndCell: () => void;
  onDropOnTarget: (
    info: DraggedCellInfo,
    targetDate: string,
    targetColType: FieldColumnType
  ) => void;
  onSelectCell: (dateIso: string, colType: FieldColumnType) => void;
}

function DesktopMonthColumn({
  column,
  draggedCell,
  dragTarget,
  recentlyDropped,
  emptyDragCanvas,
  onDragStartCell,
  onDragOverTarget,
  onDragEndCell,
  onDropOnTarget,
  onSelectCell,
}: DesktopMonthColumnProps) {
  const monthNameOnly = column.title.split(" ")[0];

  const paddedSlots = useMemo(() => {
    const slots: (ComputedDayRow | null)[] = [...column.days];
    while (slots.length < 31) {
      slots.push(null);
    }
    return slots;
  }, [column.days]);

  function handleCellDragStart(
    e: React.DragEvent<HTMLDivElement>,
    info: DraggedCellInfo
  ) {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", JSON.stringify(info));
    if (emptyDragCanvas) {
      e.dataTransfer.setDragImage(emptyDragCanvas, 0, 0);
    }
    onDragStartCell(info, e.clientX, e.clientY);
  }

  function handleCellDragOver(
    e: React.DragEvent<HTMLDivElement>,
    targetDate: string,
    targetColType: FieldColumnType
  ) {
    if (!draggedCell) return;
    if (
      draggedCell.sourceDate === targetDate &&
      draggedCell.colType === targetColType
    ) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    onDragOverTarget({ targetDate, targetColType }, e.clientX, e.clientY);
  }

  function handleCellDrop(
    e: React.DragEvent<HTMLDivElement>,
    targetDate: string,
    targetColType: FieldColumnType
  ) {
    e.preventDefault();
    e.stopPropagation();
    let payload = draggedCell;
    if (!payload) {
      try {
        const raw = e.dataTransfer.getData("text/plain");
        if (raw) payload = JSON.parse(raw) as DraggedCellInfo;
      } catch {
        // ignore
      }
    }
    if (
      payload &&
      (payload.sourceDate !== targetDate || payload.colType !== targetColType)
    ) {
      onDropOnTarget(payload, targetDate, targetColType);
    } else {
      onDragEndCell();
    }
  }

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      {/* Month Name Header (matches spreadsheet: OUTUBRO / NOVEMBRO / DEZEMBRO) */}
      <div className="h-6 shrink-0 px-3 bg-white border-b border-[#d8e0da] flex items-center justify-center">
        <span className="text-xs font-bold tracking-wide text-[#141f17]">
          {monthNameOnly}
        </span>
      </div>

      {/* Column Headers: Data | Entrada | Saída | Diário | Saldo */}
      <div className="h-6 shrink-0 bg-[#f4f6f4] border-b border-[#cfd8d2] grid grid-cols-12 items-center text-[11px] font-bold text-[#141f17] select-none">
        <div className="col-span-3 text-center">Data</div>
        <div className="col-span-2 text-center">Entrada</div>
        <div className="col-span-2 text-center">Saída</div>
        <div className="col-span-2 text-center">Diário</div>
        <div className="col-span-3 text-center">Saldo</div>
      </div>

      {/* 31 Proportional Rows: 0 vertical scroll */}
      <div className="flex-1 min-h-0 grid grid-rows-[repeat(31,minmax(0,1fr))] divide-y divide-[#d5ded8]/60">
        {paddedSlots.map((day, idx) => {
          if (!day) {
            return <div key={`empty_${idx}`} className="bg-white" />;
          }

          const isTargetRow =
            Boolean(draggedCell) &&
            dragTarget?.targetDate === day.date &&
            (draggedCell?.sourceDate !== day.date ||
              draggedCell?.colType !== dragTarget?.targetColType);

          const isSourceDay = draggedCell?.sourceDate === day.date;
          const isDraggingSourceCol = isSourceDay ? draggedCell.colType : null;
          const activeTargetCol =
            isTargetRow && dragTarget ? dragTarget.targetColType : null;

          const leftCellsBg = isTargetRow
            ? "bg-[#e3f3e6] font-semibold text-[#0d2614] ring-1 ring-inset ring-[#2d6a3e]/60"
            : day.isToday
            ? "bg-[#bdd7c5] font-bold text-[#0d2614] ring-1 ring-inset ring-[#2d6a3e]"
            : day.hasSimulation
            ? "bg-[#fdf6e2] text-[#141f17]"
            : day.isPast
            ? "bg-[#dce6df] text-[#1a291e]"
            : "bg-white text-[#141f17]";

          const isRecentlyDroppedCol = (col: FieldColumnType) =>
            recentlyDropped?.date === day.date &&
            recentlyDropped?.colType === col;

          return (
            <div
              key={day.date}
              className="grid grid-cols-12 items-stretch text-[11.5px] leading-none tabular-nums select-none transition-colors duration-150"
            >
              {/* Data + Entrada + Saída + Diário container (cols 1-9) */}
              <div
                className={`col-span-9 grid grid-cols-9 items-stretch transition-colors duration-150 ${leftCellsBg}`}
              >
                {/* Data (3 of 9) - dropping on Data keeps the dragged column type */}
                <div
                  onDragOver={(e) =>
                    draggedCell &&
                    handleCellDragOver(e, day.date, draggedCell.colType)
                  }
                  onDrop={(e) =>
                    draggedCell &&
                    handleCellDrop(e, day.date, draggedCell.colType)
                  }
                  onClick={() => onSelectCell(day.date, "expense_daily")}
                  className="col-span-3 text-center flex items-center justify-center gap-1 cursor-pointer hover:bg-black/5 transition-colors"
                >
                  <span>{formatFullDate(day.date)}</span>
                  {day.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1b5e20] shrink-0" />
                  )}
                </div>

                {/* Entrada (2 of 9) */}
                <motion.div
                  animate={{
                    scale: isRecentlyDroppedCol("income")
                      ? 1.07
                      : activeTargetCol === "income"
                      ? 1.04
                      : 1,
                  }}
                  transition={{ type: "spring", stiffness: 450, damping: 18 }}
                  draggable={day.incomeTotal > 0}
                  onDragStart={(e) =>
                    day.incomeTotal > 0 &&
                    handleCellDragStart(
                      e as unknown as React.DragEvent<HTMLDivElement>,
                      {
                        sourceDate: day.date,
                        colType: "income",
                        amount: day.incomeTotal,
                      }
                    )
                  }
                  onDragOver={(e) => handleCellDragOver(e, day.date, "income")}
                  onDrop={(e) => handleCellDrop(e, day.date, "income")}
                  onDragEnd={onDragEndCell}
                  onClick={() => onSelectCell(day.date, "income")}
                  title={
                    day.incomeTotal > 0
                      ? "Arraste para outra data ou para Saída/Diário (clique para editar)"
                      : "Clique para lançar ou solte um valor aqui para converter em Entrada"
                  }
                  className={`col-span-2 text-center truncate flex items-center justify-center px-1 transition-all duration-150 ${
                    day.incomeTotal > 0
                      ? "cursor-grab active:cursor-grabbing hover:bg-[#1b5e20]/10"
                      : "cursor-pointer hover:bg-black/8"
                  } ${
                    isDraggingSourceCol === "income"
                      ? "opacity-40 scale-95 ring-2 ring-inset ring-dashed ring-[#1b5e20]"
                      : activeTargetCol === "income"
                      ? getFieldMeta("income").targetCellClass
                      : isRecentlyDroppedCol("income")
                      ? getFieldMeta("income").pulseBg
                      : isSourceDay && draggedCell
                      ? "ring-1 ring-inset ring-dashed ring-[#1b5e20]/35"
                      : ""
                  }`}
                >
                  {activeTargetCol === "income" && draggedCell ? (
                    <span className="truncate">
                      {formatBRL(
                        Number(
                          (day.incomeTotal + draggedCell.amount).toFixed(2)
                        )
                      )}
                    </span>
                  ) : day.incomeTotal > 0 ? (
                    formatBRL(day.incomeTotal)
                  ) : (
                    ""
                  )}
                </motion.div>

                {/* Saída (2 of 9) */}
                <motion.div
                  animate={{
                    scale: isRecentlyDroppedCol("expense_fixed")
                      ? 1.07
                      : activeTargetCol === "expense_fixed"
                      ? 1.04
                      : 1,
                  }}
                  transition={{ type: "spring", stiffness: 450, damping: 18 }}
                  draggable={day.fixedExpenseTotal > 0}
                  onDragStart={(e) =>
                    day.fixedExpenseTotal > 0 &&
                    handleCellDragStart(
                      e as unknown as React.DragEvent<HTMLDivElement>,
                      {
                        sourceDate: day.date,
                        colType: "expense_fixed",
                        amount: day.fixedExpenseTotal,
                      }
                    )
                  }
                  onDragOver={(e) =>
                    handleCellDragOver(e, day.date, "expense_fixed")
                  }
                  onDrop={(e) => handleCellDrop(e, day.date, "expense_fixed")}
                  onDragEnd={onDragEndCell}
                  onClick={() => onSelectCell(day.date, "expense_fixed")}
                  title={
                    day.fixedExpenseTotal > 0
                      ? "Arraste para outra data ou para Diário/Entrada (clique para editar)"
                      : "Clique para lançar ou solte um valor aqui para converter em Saída"
                  }
                  className={`col-span-2 text-center truncate flex items-center justify-center px-1 transition-all duration-150 ${
                    day.fixedExpenseTotal > 0
                      ? "cursor-grab active:cursor-grabbing hover:bg-[#9e1c1c]/10"
                      : "cursor-pointer hover:bg-black/8"
                  } ${
                    isDraggingSourceCol === "expense_fixed"
                      ? "opacity-40 scale-95 ring-2 ring-inset ring-dashed ring-[#9e1c1c]"
                      : activeTargetCol === "expense_fixed"
                      ? getFieldMeta("expense_fixed").targetCellClass
                      : isRecentlyDroppedCol("expense_fixed")
                      ? getFieldMeta("expense_fixed").pulseBg
                      : isSourceDay && draggedCell
                      ? "ring-1 ring-inset ring-dashed ring-[#9e1c1c]/35"
                      : ""
                  }`}
                >
                  {activeTargetCol === "expense_fixed" && draggedCell ? (
                    <span className="truncate">
                      {formatBRL(
                        Number(
                          (day.fixedExpenseTotal + draggedCell.amount).toFixed(
                            2
                          )
                        )
                      )}
                    </span>
                  ) : day.fixedExpenseTotal > 0 ? (
                    <span
                      className={
                        day.simulatedExpenseTotal > 0
                          ? "underline decoration-dotted font-bold"
                          : ""
                      }
                    >
                      {formatBRL(day.fixedExpenseTotal)}
                    </span>
                  ) : (
                    ""
                  )}
                </motion.div>

                {/* Diário (2 of 9) */}
                <motion.div
                  animate={{
                    scale: isRecentlyDroppedCol("expense_daily")
                      ? 1.07
                      : activeTargetCol === "expense_daily"
                      ? 1.04
                      : 1,
                  }}
                  transition={{ type: "spring", stiffness: 450, damping: 18 }}
                  draggable={day.dailyAmount > 0}
                  onDragStart={(e) =>
                    day.dailyAmount > 0 &&
                    handleCellDragStart(
                      e as unknown as React.DragEvent<HTMLDivElement>,
                      {
                        sourceDate: day.date,
                        colType: "expense_daily",
                        amount: day.dailyAmount,
                      }
                    )
                  }
                  onDragOver={(e) =>
                    handleCellDragOver(e, day.date, "expense_daily")
                  }
                  onDrop={(e) => handleCellDrop(e, day.date, "expense_daily")}
                  onDragEnd={onDragEndCell}
                  onClick={() => onSelectCell(day.date, "expense_daily")}
                  title={
                    day.dailyAmount > 0
                      ? "Arraste para outra data ou para Saída/Entrada (clique para editar)"
                      : "Clique para lançar ou solte um valor aqui para converter em Diário"
                  }
                  className={`col-span-2 text-center truncate flex items-center justify-center px-1 transition-all duration-150 ${
                    day.dailyAmount > 0
                      ? "cursor-grab active:cursor-grabbing hover:bg-[#7c5800]/10"
                      : "cursor-pointer hover:bg-black/8"
                  } ${
                    isDraggingSourceCol === "expense_daily"
                      ? "opacity-40 scale-95 ring-2 ring-inset ring-dashed ring-[#b27d00]"
                      : activeTargetCol === "expense_daily"
                      ? getFieldMeta("expense_daily").targetCellClass
                      : isRecentlyDroppedCol("expense_daily")
                      ? getFieldMeta("expense_daily").pulseBg
                      : isSourceDay && draggedCell
                      ? "ring-1 ring-inset ring-dashed ring-[#b27d00]/35"
                      : ""
                  }`}
                >
                  {activeTargetCol === "expense_daily" && draggedCell ? (
                    <span className="truncate">
                      {formatBRL(
                        Number(
                          (day.dailyAmount + draggedCell.amount).toFixed(2)
                        )
                      )}
                    </span>
                  ) : day.dailyAmount > 0 ? (
                    formatBRL(day.dailyAmount)
                  ) : (
                    ""
                  )}
                </motion.div>
              </div>

              {/* Saldo (cols 10-12) */}
              <div
                onDragOver={(e) =>
                  draggedCell &&
                  handleCellDragOver(e, day.date, draggedCell.colType)
                }
                onDrop={(e) =>
                  draggedCell &&
                  handleCellDrop(e, day.date, draggedCell.colType)
                }
                onClick={() => onSelectCell(day.date, "expense_daily")}
                className={`col-span-3 flex items-center justify-center font-semibold px-1 truncate cursor-pointer hover:brightness-95 transition-colors duration-150 ${day.liquidity.bgClass}`}
              >
                {formatBRL(day.projectedBalance)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
