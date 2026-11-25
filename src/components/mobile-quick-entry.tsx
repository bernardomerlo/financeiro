"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  Banknote,
  CreditCard,
  Calendar,
  Check,
  Loader2,
  X,
  FlaskConical,
  RotateCcw,
  Trash2,
  Plus,
  Equal,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  calculateCreditCardInstallmentDates,
  classifyLiquidity,
  formatIsoDate,
  type CashflowSettings,
  type ComputedDayRow,
  type DailyOverrideRecord,
  type TransactionRecord,
} from "@/lib/cashflow-engine";
import { CATEGORIES, formatBRL, formatFullDate, formatShortDate } from "@/lib/format";
import {
  createRealTransactionAction,
  deleteTransactionAction,
  fetchInitialCashflowData,
  removeDailyOverrideAction,
  upsertDailyOverrideAction,
} from "@/app/actions";

interface MobileQuickEntryProps {
  currentBalance: number;
  currentMonthEndBalance: number;
  simulationImpact: number;
  settings: CashflowSettings;
  allDaysMap: Record<string, ComputedDayRow>;
  transactions: TransactionRecord[];
  dailyOverrides: DailyOverrideRecord[];
}

const QUICK_AMOUNTS = [10, 20, 50, 100] as const;
const QUICK_INSTALLMENTS = [1, 2, 3, 4, 6, 10, 12] as const;

function shiftIsoDate(isoDate: string, deltaDays: number): string {
  const d = new Date(`${isoDate}T00:00:00`);
  d.setDate(d.getDate() + deltaDays);
  return formatIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

function formatInputValue(value: number): string {
  if (value <= 0) return "";
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(2).replace(".", ",");
}

export function MobileQuickEntry({
  currentBalance,
  currentMonthEndBalance,
  simulationImpact,
  settings,
  allDaysMap,
  transactions,
  dailyOverrides,
}: MobileQuickEntryProps) {
  const {
    addStagedSimulation,
    stageDailyOverride,
    stageDeleteTransaction,
    hydrateFromServer,
    setSelectedDayForDetail,
  } = useCashflowStore();

  const amountInputRef = useRef<HTMLInputElement>(null);

  const todayIso = settings.referenceToday;
  const yesterdayIso = useMemo(() => shiftIsoDate(todayIso, -1), [todayIso]);
  const tomorrowIso = useMemo(() => shiftIsoDate(todayIso, 1), [todayIso]);

  const [txType, setTxType] = useState<"expense_fixed" | "expense_daily" | "income">(
    "expense_fixed"
  );
  const [amountStr, setAmountStr] = useState("");
  const [date, setDate] = useState(todayIso);
  const [showCustomDate, setShowCustomDate] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit_card">("cash");
  const [installments, setInstallments] = useState(1);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isSimulation, setIsSimulation] = useState(false);
  const [dailyMode, setDailyMode] = useState<"set" | "add">("set");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [activityTab, setActivityTab] = useState<"day" | "recent">("recent");

  // Keep date synced when todayIso rolls over unless user manually picked another date
  const prevTodayRef = useRef(todayIso);
  useEffect(() => {
    if (prevTodayRef.current !== todayIso) {
      if (date === prevTodayRef.current) {
        setDate(todayIso);
      }
      prevTodayRef.current = todayIso;
    }
  }, [todayIso, date]);

  const existingOverride = useMemo(
    () => dailyOverrides.find((o) => o.date === date),
    [dailyOverrides, date]
  );

  // When switching to Diário or changing date, default to "add" if day already has an explicit override, else "set"
  useEffect(() => {
    if (txType === "expense_daily") {
      setDailyMode(existingOverride ? "add" : "set");
    }
  }, [txType, date, existingOverride]);

  const parsedAmount = useMemo(() => {
    const cleaned = amountStr.replace(/[^\d,.-]/g, "").replace(",", ".");
    const val = parseFloat(cleaned);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [amountStr]);

  const hasAmountInput = amountStr.trim().length > 0;

  const selectedDayRow = allDaysMap[date] ?? null;
  const baseDaily = existingOverride ? existingOverride.amount : settings.dailySpendingTarget;
  const currentDayDaily = selectedDayRow?.dailyAmount ?? baseDaily;
  const extraDailyFromTxs = Math.max(0, Number((currentDayDaily - baseDaily).toFixed(2)));

  const resultingDailyTotal = useMemo(() => {
    if (!hasAmountInput) return currentDayDaily;
    if (dailyMode === "add") {
      return Number((currentDayDaily + parsedAmount).toFixed(2));
    }
    return Number(parsedAmount.toFixed(2));
  }, [hasAmountInput, dailyMode, currentDayDaily, parsedAmount]);

  const targetOverrideToSave = useMemo(() => {
    if (dailyMode === "add") {
      return Number((baseDaily + parsedAmount).toFixed(2));
    }
    return Math.max(0, Number((parsedAmount - extraDailyFromTxs).toFixed(2)));
  }, [dailyMode, baseDaily, parsedAmount, extraDailyFromTxs]);

  const installmentDates = useMemo(() => {
    if (paymentMethod !== "credit_card" || txType !== "expense_fixed") {
      return [date];
    }
    return calculateCreditCardInstallmentDates(
      date,
      installments,
      settings.creditCardClosingDay,
      settings.creditCardDueDay
    );
  }, [
    paymentMethod,
    txType,
    date,
    installments,
    settings.creditCardClosingDay,
    settings.creditCardDueDay,
  ]);

  const perInstallmentAmount = useMemo(() => {
    const count =
      paymentMethod === "credit_card" && txType === "expense_fixed"
        ? Math.max(1, installments)
        : 1;
    return Number((parsedAmount / count).toFixed(2));
  }, [parsedAmount, paymentMethod, txType, installments]);

  const currentYM = todayIso.slice(0, 7);
  const currentMonthImpact = useMemo(() => {
    if (txType === "expense_daily") {
      if (!hasAmountInput || date.slice(0, 7) > currentYM) return 0;
      return Number((-(resultingDailyTotal - currentDayDaily)).toFixed(2));
    }

    if (parsedAmount <= 0) return 0;
    let impact = 0;
    for (const d of installmentDates) {
      if (d.slice(0, 7) <= currentYM) {
        impact += txType === "income" ? perInstallmentAmount : -perInstallmentAmount;
      }
    }
    return Number(impact.toFixed(2));
  }, [
    txType,
    hasAmountInput,
    date,
    currentYM,
    resultingDailyTotal,
    currentDayDaily,
    parsedAmount,
    installmentDates,
    perInstallmentAmount,
  ]);

  const projectedAfter = Number((currentMonthEndBalance + currentMonthImpact).toFixed(2));
  const todayLiquidity = classifyLiquidity(currentBalance);
  const endLiquidity = classifyLiquidity(currentMonthEndBalance);
  const afterLiquidity = classifyLiquidity(projectedAfter);

  const isPresetDate =
    date === todayIso ||
    date === yesterdayIso ||
    (txType !== "expense_daily" && date === tomorrowIso);

  const recentTransactions = useMemo(() => {
    const firstInstallmentByGroup = new Map<string, TransactionRecord>();
    for (const tx of transactions) {
      if (tx.installmentGroupId) {
        const existing = firstInstallmentByGroup.get(tx.installmentGroupId);
        if (
          !existing ||
          (tx.installmentCurrent ?? 999) < (existing.installmentCurrent ?? 999)
        ) {
          firstInstallmentByGroup.set(tx.installmentGroupId, tx);
        }
      }
    }

    const seenGroups = new Set<string>();
    const result: TransactionRecord[] = [];
    for (let i = transactions.length - 1; i >= 0 && result.length < 6; i--) {
      const tx = transactions[i];
      if (tx.installmentGroupId) {
        if (seenGroups.has(tx.installmentGroupId)) continue;
        seenGroups.add(tx.installmentGroupId);
        result.push(firstInstallmentByGroup.get(tx.installmentGroupId) ?? tx);
      } else {
        result.push(tx);
      }
    }
    return result;
  }, [transactions]);

  const selectedDayItems = useMemo(() => {
    return selectedDayRow?.items ?? [];
  }, [selectedDayRow]);

  function handleQuickIncrement(delta: number) {
    const next = Number((parsedAmount + delta).toFixed(2));
    setAmountStr(formatInputValue(next));
  }

  async function handleZeroDaily() {
    if (isSimulation) {
      stageDailyOverride(date, 0, "Dia sem gasto (simulado)");
      toast.success(`Diário de ${formatShortDate(date)} zerado na simulação.`);
      setAmountStr("");
      return;
    }

    setIsSubmitting(true);
    try {
      await upsertDailyOverrideAction(date, 0, "Dia sem gasto");
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      setAmountStr("");
      toast.success(`Diário de ${formatShortDate(date)} zerado (R$ 0,00).`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao zerar diário.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleRestoreDailyTarget() {
    setIsSubmitting(true);
    try {
      await removeDailyOverrideAction(date);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      setAmountStr("");
      toast.info(`Meta padrão (${formatBRL(settings.dailySpendingTarget)}) restaurada.`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao restaurar meta.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!date) {
      toast.error("Selecione uma data.");
      return;
    }

    if (txType === "expense_daily") {
      if (!hasAmountInput) {
        toast.error("Informe o valor do gasto diário.");
        amountInputRef.current?.focus();
        return;
      }
      if (dailyMode === "add" && parsedAmount <= 0) {
        toast.error("Informe um valor maior que zero para somar.");
        amountInputRef.current?.focus();
        return;
      }

      if (isSimulation) {
        stageDailyOverride(date, targetOverrideToSave, description.trim() || undefined);
        toast.success(
          `Diário simulado (${formatShortDate(date)}): ${formatBRL(resultingDailyTotal)}`
        );
        setAmountStr("");
        setDescription("");
        return;
      }

      setIsSubmitting(true);
      try {
        await upsertDailyOverrideAction(
          date,
          targetOverrideToSave,
          description.trim() || undefined
        );
        const fresh = await fetchInitialCashflowData();
        hydrateFromServer(fresh);
        toast.success(
          `Diário de ${formatShortDate(date)} salvo: ${formatBRL(resultingDailyTotal)}`
        );
        setAmountStr("");
        setDescription("");
      } catch (err) {
        console.error(err);
        toast.error("Falha ao salvar diário.");
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // Saída ou Entrada
    if (parsedAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      amountInputRef.current?.focus();
      return;
    }

    const effectiveMethod = txType === "income" ? "cash" : paymentMethod;
    const effectiveInstallments = effectiveMethod === "credit_card" ? installments : 1;

    if (isSimulation) {
      addStagedSimulation({
        date,
        type: txType,
        amount: parsedAmount,
        description: description.trim() || undefined,
        category: category || undefined,
        paymentMethod: effectiveMethod,
        installments: effectiveInstallments,
      });
      toast.success(
        `${txType === "income" ? "Entrada" : "Saída"} simulada: ${formatBRL(parsedAmount)}`
      );
      setAmountStr("");
      setDescription("");
      return;
    }

    setIsSubmitting(true);
    try {
      await createRealTransactionAction({
        date,
        type: txType,
        amount: parsedAmount,
        description: description.trim() || undefined,
        category: category || undefined,
        paymentMethod: effectiveMethod,
        installments: effectiveInstallments,
        isSimulation: false,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success(
        `${txType === "income" ? "Entrada" : "Saída"} salva: ${formatBRL(parsedAmount)}`
      );
      setAmountStr("");
      setDescription("");
      setCategory("");
      setInstallments(1);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar lançamento.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleQuickDelete(tx: TransactionRecord) {
    if (tx.isInMemory || tx.id.startsWith("sim_")) {
      stageDeleteTransaction(tx.id);
      toast.info("Simulação removida.");
      return;
    }
    setDeletingId(tx.id);
    try {
      await deleteTransactionAction(tx.id);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success("Lançamento removido.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover.");
    } finally {
      setDeletingId(null);
    }
  }

  const submitButtonColor = isSimulation
    ? "bg-[#7c5800] active:bg-[#5c4300]"
    : txType === "expense_fixed"
    ? "bg-[#9e1c1c] active:bg-[#7f1616]"
    : txType === "expense_daily"
    ? "bg-[#2d6a3e] active:bg-[#204f2d]"
    : "bg-[#1b5e20] active:bg-[#144718]";

  const submitLabel = isSimulation
    ? txType === "expense_fixed"
      ? "Simular Saída"
      : txType === "expense_daily"
      ? "Simular Diário"
      : "Simular Entrada"
    : txType === "expense_fixed"
    ? "Salvar Saída"
    : txType === "expense_daily"
    ? dailyMode === "add"
      ? "Somar no Diário"
      : "Salvar Diário"
    : "Salvar Entrada";

  return (
    <div className="flex flex-col gap-3">
      {/* Compact Live Balance Strip */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] px-3 py-2 flex items-center justify-between gap-2 text-xs tabular-nums shadow-2xs">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: todayLiquidity.hex }}
          />
          <span className="text-[#526657] font-medium">Hoje</span>
          <span className="font-bold text-[#141f17] truncate">
            {formatBRL(currentBalance)}
          </span>
        </div>

        <span className="w-px h-4 bg-[#d8e0da] shrink-0" />

        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: endLiquidity.hex }}
          />
          <span className="text-[#526657] font-medium">Fim Mês</span>
          <span className="font-bold text-[#141f17] truncate">
            {formatBRL(currentMonthEndBalance)}
          </span>
          {simulationImpact !== 0 && (
            <span className="text-[10px] font-bold text-[#7c5800] bg-[#fff3cd] px-1 py-0.5 rounded border border-[#ffe69c] shrink-0">
              sim
            </span>
          )}
        </div>
      </div>

      {/* Quick Entry Primary Card */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl border border-[#cfd8d2] p-3.5 shadow-xs space-y-3.5"
      >
        {/* 1. Large Segmented Type Switcher */}
        <div className="grid grid-cols-3 gap-1 bg-[#eff3f0] p-1 rounded-xl border border-[#d5ded8]">
          {(
            [
              {
                id: "expense_fixed",
                label: "Saída",
                icon: TrendingDown,
                activeColor: "text-[#9e1c1c]",
              },
              {
                id: "expense_daily",
                label: "Diário",
                icon: Wallet,
                activeColor: "text-[#7c5800]",
              },
              {
                id: "income",
                label: "Entrada",
                icon: TrendingUp,
                activeColor: "text-[#1b5e20]",
              },
            ] as const
          ).map((tab) => {
            const active = txType === tab.id;
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTxType(tab.id)}
                className={`relative min-h-[44px] rounded-lg text-sm font-bold flex items-center justify-center gap-1.5 cursor-pointer z-10 transition-colors ${
                  active ? tab.activeColor : "text-[#4e6153]"
                }`}
              >
                {active && (
                  <motion.span
                    layoutId="mobile-quick-entry-type-pill"
                    transition={{ type: "spring", stiffness: 450, damping: 34 }}
                    className="absolute inset-0 bg-white rounded-lg shadow-xs border border-[#d5ded8]/80 -z-10"
                  />
                )}
                <Icon className="w-4 h-4 shrink-0" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* 2. Diário Status & Mode Bar (only when Diário is selected) */}
        {txType === "expense_daily" && (
          <div className="rounded-xl bg-[#eff3f0] border border-[#d5ded8] p-2.5 space-y-2">
            <div className="flex items-center justify-between gap-2 text-xs">
              <div className="min-w-0">
                <span className="text-[#526657] font-medium">
                  Diário ({date === todayIso ? "Hoje" : formatShortDate(date)}):{" "}
                </span>
                <span className="font-bold text-[#141f17]">
                  {formatBRL(currentDayDaily)}
                </span>
                <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white border border-[#d5ded8] text-[#526657]">
                  {existingOverride ? "Editado" : "Meta"}
                </span>
              </div>

              <div className="flex items-center gap-1 shrink-0">
                {existingOverride && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleRestoreDailyTarget}
                    className="h-8 px-2 rounded-lg bg-white border border-[#cfd8d2] text-[11px] font-semibold text-[#2d6a3e] flex items-center gap-1 cursor-pointer"
                    title="Restaurar meta padrão"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Meta</span>
                  </button>
                )}
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleZeroDaily}
                  className="h-8 px-2.5 rounded-lg bg-[#ffebee] border border-[#ef9a9a] text-[11px] font-bold text-[#8e1414] cursor-pointer"
                >
                  Zerar
                </button>
              </div>
            </div>

            {/* Mode Switcher: Somar (+) vs Definir (=) */}
            <div className="grid grid-cols-2 gap-1 bg-white p-0.5 rounded-lg border border-[#d5ded8]">
              <button
                type="button"
                onClick={() => setDailyMode("add")}
                className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  dailyMode === "add"
                    ? "bg-[#2d6a3e] text-white"
                    : "text-[#4e6153]"
                }`}
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Somar ao dia</span>
              </button>
              <button
                type="button"
                onClick={() => setDailyMode("set")}
                className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors ${
                  dailyMode === "set"
                    ? "bg-[#2d6a3e] text-white"
                    : "text-[#4e6153]"
                }`}
              >
                <Equal className="w-3.5 h-3.5" />
                <span>Definir total</span>
              </button>
            </div>
          </div>
        )}

        {/* 3. Hero Amount Input + Quick Chips */}
        <div className="space-y-2">
          <div className="relative flex items-center rounded-xl border-2 border-[#c5d1c8] focus-within:border-[#2d6a3e] bg-[#f8faf8] focus-within:bg-white transition-colors px-3.5 h-16">
            <span className="text-lg font-bold text-[#526657] select-none mr-2">R$</span>
            <input
              ref={amountInputRef}
              id="mobile-quick-amount"
              type="text"
              inputMode="decimal"
              enterKeyHint="done"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full bg-transparent text-3xl font-bold text-[#141f17] tabular-nums focus:outline-none placeholder:text-[#9eb0a3]"
              aria-label="Valor em reais"
            />
            {hasAmountInput && (
              <button
                type="button"
                onClick={() => {
                  setAmountStr("");
                  amountInputRef.current?.focus();
                }}
                className="w-8 h-8 rounded-full bg-[#e4ebe6] text-[#4e6153] flex items-center justify-center shrink-0 ml-1 cursor-pointer"
                aria-label="Limpar valor"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {txType === "expense_daily" && hasAmountInput && (
            <div className="text-xs font-semibold text-[#2d6a3e] px-1 flex items-center justify-between">
              <span>
                {dailyMode === "add"
                  ? `${formatBRL(currentDayDaily)} + ${formatBRL(parsedAmount)}`
                  : "Novo total diário"}
              </span>
              <span className="font-bold text-[#141f17]">
                = {formatBRL(resultingDailyTotal)}
              </span>
            </div>
          )}

          {/* Quick Amount Chips */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
            {txType === "expense_daily" && dailyMode === "set" && (
              <button
                type="button"
                onClick={() =>
                  setAmountStr(formatInputValue(settings.dailySpendingTarget))
                }
                className="min-h-[36px] px-3 rounded-full border border-[#b7ceb9] bg-[#e8f5e9] text-[#1b5e20] text-xs font-bold shrink-0 cursor-pointer active:scale-95 transition-transform"
              >
                Meta ({formatBRL(settings.dailySpendingTarget)})
              </button>
            )}
            {QUICK_AMOUNTS.map((val) => (
              <button
                key={val}
                type="button"
                onClick={() => handleQuickIncrement(val)}
                className="min-h-[36px] px-3 rounded-full border border-[#d5ded8] bg-[#eff3f0] active:bg-[#dce6df] text-[#141f17] text-xs font-bold shrink-0 cursor-pointer active:scale-95 transition-transform"
              >
                +R$ {val}
              </button>
            ))}
          </div>
        </div>

        {/* 4. Date Quick Pills */}
        <div className="space-y-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => {
                setDate(todayIso);
                setShowCustomDate(false);
              }}
              className={`flex-1 min-h-[40px] px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                date === todayIso && !showCustomDate
                  ? "bg-[#dce6df] border-[#2d6a3e] text-[#141f17]"
                  : "bg-[#f8faf8] border-[#d5ded8] text-[#4e6153]"
              }`}
            >
              Hoje
            </button>
            <button
              type="button"
              onClick={() => {
                setDate(yesterdayIso);
                setShowCustomDate(false);
              }}
              className={`flex-1 min-h-[40px] px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                date === yesterdayIso && !showCustomDate
                  ? "bg-[#dce6df] border-[#2d6a3e] text-[#141f17]"
                  : "bg-[#f8faf8] border-[#d5ded8] text-[#4e6153]"
              }`}
            >
              Ontem
            </button>
            {txType !== "expense_daily" && (
              <button
                type="button"
                onClick={() => {
                  setDate(tomorrowIso);
                  setShowCustomDate(false);
                }}
                className={`flex-1 min-h-[40px] px-2 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                  date === tomorrowIso && !showCustomDate
                    ? "bg-[#dce6df] border-[#2d6a3e] text-[#141f17]"
                    : "bg-[#f8faf8] border-[#d5ded8] text-[#4e6153]"
                }`}
              >
                Amanhã
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowCustomDate((prev) => !prev)}
              className={`min-h-[40px] px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                showCustomDate || !isPresetDate
                  ? "bg-[#dce6df] border-[#2d6a3e] text-[#141f17]"
                  : "bg-[#f8faf8] border-[#d5ded8] text-[#4e6153]"
              }`}
              aria-label="Escolher outra data"
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>{!isPresetDate ? formatShortDate(date) : "Outra"}</span>
            </button>
          </div>

          {(showCustomDate || !isPresetDate) && (
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full h-11 px-3 rounded-xl border border-[#c5d1c8] bg-white text-base font-semibold text-[#141f17] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
            />
          )}
        </div>

        {/* 5. Payment Method & Installments (only for Saída) */}
        {txType === "expense_fixed" && (
          <div className="space-y-2.5">
            <div className="grid grid-cols-2 gap-1.5 bg-[#eff3f0] p-1 rounded-xl border border-[#d5ded8]">
              <button
                type="button"
                onClick={() => {
                  setPaymentMethod("cash");
                  setInstallments(1);
                }}
                className={`min-h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  paymentMethod === "cash"
                    ? "bg-[#2d6a3e] text-white shadow-2xs"
                    : "text-[#4e6153]"
                }`}
              >
                <Banknote className="w-4 h-4" />
                <span>À Vista / Pix</span>
              </button>
              <button
                type="button"
                onClick={() => setPaymentMethod("credit_card")}
                className={`min-h-[42px] rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                  paymentMethod === "credit_card"
                    ? "bg-[#2d6a3e] text-white shadow-2xs"
                    : "text-[#4e6153]"
                }`}
              >
                <CreditCard className="w-4 h-4" />
                <span>Cartão</span>
              </button>
            </div>

            {paymentMethod === "credit_card" && (
              <div className="p-2.5 rounded-xl bg-[#eff3f0] border border-[#d5ded8] space-y-2">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
                  {QUICK_INSTALLMENTS.map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setInstallments(n)}
                      className={`min-h-[36px] min-w-[42px] px-2.5 rounded-lg text-xs font-bold border shrink-0 cursor-pointer transition-colors ${
                        installments === n
                          ? "bg-[#2d6a3e] border-[#2d6a3e] text-white"
                          : "bg-white border-[#cfd8d2] text-[#141f17]"
                      }`}
                    >
                      {n}x
                    </button>
                  ))}
                  <select
                    value={installments}
                    onChange={(e) => setInstallments(Number(e.target.value))}
                    aria-label="Outras parcelas"
                    className="h-[36px] px-2 rounded-lg border border-[#cfd8d2] bg-white text-base sm:text-xs font-bold text-[#141f17] shrink-0"
                  >
                    {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                      <option key={n} value={n}>
                        {n}x
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#141f17]">
                  <span className="text-[#526657]">
                    {parsedAmount > 0
                      ? `${installments}x de ${formatBRL(perInstallmentAmount)}`
                      : `Fecha dia ${settings.creditCardClosingDay} • Vence dia ${settings.creditCardDueDay}`}
                  </span>
                  <span className="font-bold text-[#2d6a3e]">
                    1º débito: {formatFullDate(installmentDates[0])}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 6. Category Quick Chips (for Saída & Entrada) */}
        {txType !== "expense_daily" && (
          <div className="space-y-1">
            <div className="flex items-center justify-between px-0.5">
              <span className="text-[11px] font-semibold text-[#526657]">
                Categoria (opcional)
              </span>
              {category && (
                <button
                  type="button"
                  onClick={() => setCategory("")}
                  className="text-[11px] font-semibold text-[#2d6a3e] cursor-pointer"
                >
                  Limpar
                </button>
              )}
            </div>
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pb-0.5">
              {CATEGORIES.map((cat) => {
                const selected = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(selected ? "" : cat)}
                    className={`min-h-[38px] px-3 rounded-full text-xs font-semibold border shrink-0 transition-colors cursor-pointer ${
                      selected
                        ? "bg-[#2d6a3e] border-[#2d6a3e] text-white"
                        : "bg-[#f8faf8] border-[#d5ded8] text-[#141f17]"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* 7. Description Input */}
        <input
          type="text"
          placeholder={
            txType === "expense_daily"
              ? "Nota do dia (opcional, ex: almoço + café)"
              : txType === "income"
              ? "Descrição (opcional, ex: Pix, Reembolso...)"
              : "Descrição (opcional, ex: Mercado, Farmácia...)"
          }
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="w-full h-11 px-3 rounded-xl border border-[#c5d1c8] bg-white text-base text-[#141f17] placeholder:text-[#7c8f81] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
        />

        {/* 8. Discreet Simulation Toggle + Impact Preview */}
        <div className="flex items-center justify-between gap-2 pt-0.5">
          <button
            type="button"
            role="switch"
            aria-checked={isSimulation}
            onClick={() => setIsSimulation((prev) => !prev)}
            className={`min-h-[36px] px-2.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
              isSimulation
                ? "bg-[#fdf6e2] border-[#d9c27e] text-[#5c4300]"
                : "bg-[#f8faf8] border-[#d5ded8] text-[#526657]"
            }`}
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>{isSimulation ? "Simulação ativa" : "Apenas simular"}</span>
          </button>

          <div className="flex items-center gap-1.5 text-xs tabular-nums">
            <span className="text-[#526657]">Após:</span>
            <span className={`px-2 py-0.5 rounded-md font-bold ${afterLiquidity.bgClass}`}>
              {formatBRL(projectedAfter)}
            </span>
          </div>
        </div>

        {/* 9. Primary Full-Width CTA */}
        <button
          type="submit"
          disabled={isSubmitting}
          className={`w-full h-12 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 shadow-sm active:scale-[0.99] transition-all cursor-pointer disabled:opacity-60 ${submitButtonColor}`}
        >
          {isSubmitting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Check className="w-4 h-4" />
          )}
          <span>{submitLabel}</span>
          {parsedAmount > 0 && txType !== "expense_daily" && (
            <span className="text-white/90 font-semibold">
              • {formatBRL(parsedAmount)}
            </span>
          )}
        </button>
      </form>

      {/* Recent / Selected Day Quick Review Card */}
      <section className="bg-white rounded-2xl border border-[#cfd8d2] overflow-hidden shadow-2xs">
        <div className="px-3.5 py-2.5 bg-[#eff3f0] border-b border-[#d8e0da] flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-[#141f17]">Conferência Rápida</span>
          <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-[#d5ded8]">
            <button
              type="button"
              onClick={() => setActivityTab("recent")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                activityTab === "recent"
                  ? "bg-[#2d6a3e] text-white"
                  : "text-[#4e6153]"
              }`}
            >
              Recentes ({recentTransactions.length})
            </button>
            <button
              type="button"
              onClick={() => setActivityTab("day")}
              className={`px-2.5 py-1 rounded-md text-[11px] font-bold cursor-pointer transition-colors ${
                activityTab === "day"
                  ? "bg-[#2d6a3e] text-white"
                  : "text-[#4e6153]"
              }`}
            >
              Dia {formatShortDate(date)} ({selectedDayItems.length})
            </button>
          </div>
        </div>

        {activityTab === "recent" ? (
          recentTransactions.length === 0 ? (
            <div className="p-4 text-center text-xs text-[#526657]">
              Nenhum lançamento recente registrado.
            </div>
          ) : (
            <div className="divide-y divide-[#e4ebe6]">
              {recentTransactions.map((tx) => {
                const isIncome = tx.type === "income";
                return (
                  <div
                    key={tx.id}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-2 ${
                      tx.isSimulation ? "bg-[#fdf6e2]" : "bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setSelectedDayForDetail(tx.date, tx.type)}
                      className="min-w-0 flex-1 text-left cursor-pointer"
                    >
                      <div className="flex items-center gap-1.5">
                        <span className="text-[11px] font-bold text-[#526657] shrink-0">
                          {formatShortDate(tx.date)}
                        </span>
                        <span className="text-xs font-semibold text-[#141f17] truncate">
                          {tx.description ||
                            tx.category ||
                            (isIncome ? "Entrada" : "Saída")}
                          {tx.installmentTotal && tx.installmentTotal > 1
                            ? ` (${tx.installmentCurrent}/${tx.installmentTotal})`
                            : ""}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#526657] flex items-center gap-1.5 mt-0.5">
                        {tx.category && <span>{tx.category}</span>}
                        {tx.paymentMethod === "credit_card" && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#eff3f0] border border-[#d5ded8]">
                            Cartão
                          </span>
                        )}
                        {tx.isSimulation && (
                          <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#fff3cd] text-[#7c5800] font-semibold">
                            Simulação
                          </span>
                        )}
                      </div>
                    </button>

                    <div className="flex items-center gap-1 shrink-0">
                      <span
                        className={`text-xs font-bold tabular-nums ${
                          isIncome ? "text-[#1b5e20]" : "text-[#9e1c1c]"
                        }`}
                      >
                        {isIncome ? "+" : "-"} {formatBRL(tx.amount)}
                      </span>
                      <button
                        type="button"
                        disabled={deletingId === tx.id}
                        onClick={() => handleQuickDelete(tx)}
                        className="w-9 h-9 rounded-lg flex items-center justify-center text-[#9e1c1c] active:bg-[#ffebee] cursor-pointer"
                        aria-label="Excluir lançamento"
                      >
                        {deletingId === tx.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Trash2 className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        ) : (
          <div className="divide-y divide-[#e4ebe6]">
            {/* Always show Diário summary row for the selected day */}
            <button
              type="button"
              onClick={() => setSelectedDayForDetail(date, "expense_daily")}
              className="w-full px-3.5 py-2.5 flex items-center justify-between gap-2 bg-[#f8faf8] active:bg-[#eff3f0] text-left cursor-pointer"
            >
              <div>
                <div className="text-xs font-semibold text-[#141f17]">
                  Gasto Diário ({existingOverride ? "Editado" : "Meta padrão"})
                </div>
                {existingOverride?.note && (
                  <div className="text-[11px] text-[#526657]">{existingOverride.note}</div>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-bold tabular-nums text-[#7c5800]">
                  - {formatBRL(currentDayDaily)}
                </span>
                <Pencil className="w-3.5 h-3.5 text-[#526657]" />
              </div>
            </button>

            {selectedDayItems.length === 0 ? (
              <div className="p-3.5 text-center text-xs text-[#526657]">
                Nenhuma entrada ou saída extra em {formatShortDate(date)}.
              </div>
            ) : (
              selectedDayItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedDayForDetail(date, item.type)}
                  className={`w-full px-3.5 py-2.5 flex items-center justify-between gap-2 text-left cursor-pointer ${
                    item.source === "simulation" ? "bg-[#fdf6e2]" : "bg-white"
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-semibold text-[#141f17] truncate">
                      {item.title}
                      {item.installmentLabel ? ` (${item.installmentLabel})` : ""}
                    </div>
                    <div className="text-[11px] text-[#526657] flex items-center gap-1.5">
                      {item.category && <span>{item.category}</span>}
                      {item.source === "recurring" && (
                        <span className="text-[10px] px-1.5 rounded bg-[#eff3f0] border border-[#d5ded8]">
                          Fixo
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        item.type === "income" ? "text-[#1b5e20]" : "text-[#9e1c1c]"
                      }`}
                    >
                      {item.type === "income" ? "+" : "-"} {formatBRL(item.amount)}
                    </span>
                    <Pencil className="w-3.5 h-3.5 text-[#526657]" />
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </section>
    </div>
  );
}
