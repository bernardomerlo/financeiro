"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  PlusCircle,
  CalendarDays,
  CalendarClock,
  Bell,
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
import { TopNavbar } from "./top-navbar";
import { LaunchModal } from "./launch-modal";
import { DayDetailDrawer } from "./day-detail-drawer";
import { SimulationFloatingBar } from "./simulation-floating-bar";
import { SettingsAndRecurringModals } from "./settings-and-recurring-modals";
import { MobileQuickEntry } from "./mobile-quick-entry";
import { NotificationsValidator } from "./notifications-validator";
import { fetchMobileNotificationsAction } from "@/app/actions";

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
  } = useCashflowStore();

  const [mobileTab, setMobileTab] = useState<"launch" | "notifications" | "month">("launch");
  const [showPastMobileDays, setShowPastMobileDays] = useState(false);
  const [pendingNotifCount, setPendingNotifCount] = useState(0);

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
      <main className="hidden lg:flex flex-col flex-1 min-h-0 p-2 overflow-hidden">
        <div className="flex-1 min-h-0 bg-white rounded-lg border border-[#cfd8d2] shadow-2xs grid grid-cols-3 divide-x divide-[#cfd8d2] overflow-hidden">
          {projection.months.map((monthCol) => (
            <DesktopMonthColumn
              key={monthCol.yearMonth}
              column={monthCol}
              onSelectCell={(dateIso, colType) =>
                setSelectedDayForDetail(dateIso, colType)
              }
            />
          ))}
        </div>
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

interface DesktopMonthColumnProps {
  column: ComputedMonthColumn;
  onSelectCell: (
    dateIso: string,
    colType: "income" | "expense_fixed" | "expense_daily"
  ) => void;
}

function DesktopMonthColumn({
  column,
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

          const leftCellsBg = day.isToday
            ? "bg-[#bdd7c5] font-bold text-[#0d2614] ring-1 ring-inset ring-[#2d6a3e]"
            : day.hasSimulation
            ? "bg-[#fdf6e2] text-[#141f17]"
            : day.isPast
            ? "bg-[#dce6df] text-[#1a291e]"
            : "bg-white text-[#141f17]";

          return (
            <div
              key={day.date}
              className="grid grid-cols-12 items-stretch text-[11.5px] leading-none tabular-nums select-none"
            >
              {/* Data + Entrada + Saída + Diário container (cols 1-9) */}
              <div className={`col-span-9 grid grid-cols-9 items-stretch ${leftCellsBg}`}>
                {/* Data (3 of 9) */}
                <div
                  onClick={() => onSelectCell(day.date, "expense_daily")}
                  className="col-span-3 text-center flex items-center justify-center gap-1 cursor-pointer hover:bg-black/5 transition-colors"
                >
                  <span>{formatFullDate(day.date)}</span>
                  {day.isToday && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#1b5e20] shrink-0" />
                  )}
                </div>

                {/* Entrada (2 of 9) */}
                <div
                  onClick={() => onSelectCell(day.date, "income")}
                  className="col-span-2 text-center truncate flex items-center justify-center px-1 cursor-pointer hover:bg-black/8 transition-colors"
                >
                  {day.incomeTotal > 0 ? formatBRL(day.incomeTotal) : ""}
                </div>

                {/* Saída (2 of 9) */}
                <div
                  onClick={() => onSelectCell(day.date, "expense_fixed")}
                  className="col-span-2 text-center truncate flex items-center justify-center px-1 cursor-pointer hover:bg-black/8 transition-colors"
                >
                  {day.fixedExpenseTotal > 0 ? (
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
                </div>

                {/* Diário (2 of 9) */}
                <div
                  onClick={() => onSelectCell(day.date, "expense_daily")}
                  className="col-span-2 text-center truncate flex items-center justify-center px-1 cursor-pointer hover:bg-black/8 transition-colors"
                >
                  {day.dailyAmount > 0 ? formatBRL(day.dailyAmount) : ""}
                </div>
              </div>

              {/* Saldo (cols 10-12) */}
              <div
                onClick={() => onSelectCell(day.date, "expense_daily")}
                className={`col-span-3 flex items-center justify-center font-semibold px-1 truncate cursor-pointer hover:brightness-95 ${day.liquidity.bgClass}`}
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
