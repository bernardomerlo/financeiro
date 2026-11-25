"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Plus,
  FlaskConical,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Wallet,
  BarChart3,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  addMonthsToYearMonth,
  calculateCashflowProjection,
  LIQUIDITY_TIERS,
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
import { upsertDailyOverrideAction, fetchInitialCashflowData } from "@/app/actions";

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
    openLaunchModal,
    selectedDayForDetail,
    setSelectedDayForDetail,
  } = useCashflowStore();

  const [showPastMobileDays, setShowPastMobileDays] = useState(false);
  const [quickMobileAmount, setQuickMobileAmount] = useState("");
  const [isQuickSaving, setIsQuickSaving] = useState(false);

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

  async function handleQuickMobileDailySave(e: React.FormEvent) {
    e.preventDefault();
    const val = parseFloat(quickMobileAmount.replace(",", "."));
    if (isNaN(val) || val < 0) {
      toast.error("Valor inválido.");
      return;
    }
    setIsQuickSaving(true);
    try {
      await upsertDailyOverrideAction(activeSettings.referenceToday, val);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      setQuickMobileAmount("");
      toast.success(`Diário atualizado: ${formatBRL(val)}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setIsQuickSaving(false);
    }
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

      {/* MOBILE VIEW: Current Month Only */}
      <main className="flex lg:hidden flex-col flex-1 px-3 py-2.5 gap-2.5 pb-20">
        <div className="flex items-center justify-between bg-white p-2 rounded-lg border border-[#cfd8d2]">
          <button
            type="button"
            onClick={() => navigateMonths(-1)}
            className="min-w-[44px] min-h-[44px] rounded-md border border-[#d8e0da] flex items-center justify-center text-[#141f17]"
            aria-label="Mês anterior"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="text-sm font-bold text-[#141f17]">{centerMonthCol.title}</div>
          <button
            type="button"
            onClick={() => navigateMonths(1)}
            className="min-w-[44px] min-h-[44px] rounded-md border border-[#d8e0da] flex items-center justify-center text-[#141f17]"
            aria-label="Próximo mês"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <div className="bg-white p-2.5 rounded-lg border border-[#cfd8d2]">
            <div className="text-[11px] text-[#526657]">
              Hoje ({formatShortDate(activeSettings.referenceToday)})
            </div>
            <div className="text-base font-bold tabular-nums text-[#141f17]">
              {formatBRL(currentBalance)}
            </div>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-[#cfd8d2]">
            <div className="text-[11px] text-[#526657]">Fim do Mês</div>
            <div className="text-base font-bold tabular-nums text-[#1b5e20]">
              {formatBRL(projectedEndOfMonth)}
            </div>
          </div>
        </div>

        <form
          onSubmit={handleQuickMobileDailySave}
          className="bg-white p-2.5 rounded-lg border border-[#cfd8d2] flex items-center gap-2"
        >
          <input
            type="text"
            inputMode="decimal"
            placeholder="Diário de hoje (R$)"
            value={quickMobileAmount}
            onChange={(e) => setQuickMobileAmount(e.target.value)}
            className="flex-1 min-h-[44px] px-3 rounded-md border border-[#c5d1c8] text-sm font-semibold"
          />
          <button
            type="submit"
            disabled={isQuickSaving}
            className="min-h-[44px] px-4 rounded-md bg-[#2d6a3e] text-white text-xs font-semibold shrink-0"
          >
            Salvar
          </button>
        </form>

        <div className="bg-white rounded-lg border border-[#cfd8d2] overflow-hidden">
          {centerMonthCol.days.some((d) => d.isPast) && (
            <button
              type="button"
              onClick={() => setShowPastMobileDays(!showPastMobileDays)}
              className="w-full min-h-[44px] px-3 py-2 bg-[#e3ebe5] border-b border-[#cfd8d2] flex items-center justify-between text-xs font-semibold text-[#1f3325]"
            >
              <span>
                {showPastMobileDays
                  ? "Ocultar passados"
                  : `Passados (${centerMonthCol.days.filter((d) => d.isPast).length})`}
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
                  className={`p-2.5 flex items-center justify-between gap-2 cursor-pointer ${
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
                    className={`px-2.5 py-1 rounded text-xs font-bold tabular-nums ${d.liquidity.bgClass}`}
                  >
                    {formatBRL(d.projectedBalance)}
                  </span>
                </div>
              ))}
          </div>
        </div>

        <nav className="fixed bottom-0 left-0 right-0 h-15 bg-white border-t border-[#cfd8d2] px-3 flex items-center justify-around z-30">
          <Link
            href="/"
            className="min-h-[44px] px-3 flex flex-col items-center justify-center text-[11px] font-semibold text-[#2d6a3e]"
          >
            <Wallet className="w-4 h-4" />
            <span>Fluxo</span>
          </Link>
          <button
            type="button"
            onClick={() => openLaunchModal({ isSimulation: false, type: "expense_fixed" })}
            className="min-h-[44px] px-4 rounded-lg bg-[#2d6a3e] text-white flex items-center gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Saída</span>
          </button>
          <button
            type="button"
            onClick={() => openLaunchModal({ isSimulation: true, type: "expense_fixed" })}
            className="min-h-[44px] px-3 flex flex-col items-center justify-center text-[11px] font-medium text-[#5c4300]"
          >
            <FlaskConical className="w-4 h-4" />
            <span>Simular</span>
          </button>
          <Link
            href="/insights"
            className="min-h-[44px] px-3 flex flex-col items-center justify-center text-[11px] font-medium text-[#4e6153]"
          >
            <BarChart3 className="w-4 h-4" />
            <span>Metas</span>
          </Link>
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
