"use client";

import React, { useState, useEffect, useMemo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  TrendingDown,
  TrendingUp,
  Wallet,
  FlaskConical,
  CreditCard,
  Banknote,
  Check,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  calculateCreditCardInstallmentDates,
  classifyLiquidity,
  getDaysInMonth,
  formatIsoDate,
} from "@/lib/cashflow-engine";
import { CATEGORIES, formatBRL, formatFullDate } from "@/lib/format";
import { createRealTransactionAction, fetchInitialCashflowData } from "@/app/actions";

interface LaunchModalProps {
  currentEndOfMonthBalance: number;
}

export function LaunchModal({ currentEndOfMonthBalance }: LaunchModalProps) {
  const {
    isLaunchModalOpen,
    closeLaunchModal,
    launchModalPresetDate,
    launchModalPresetSimulation,
    launchModalPresetType,
    settings,
    addStagedSimulation,
    hydrateFromServer,
  } = useCashflowStore();

  const [txType, setTxType] = useState<"expense_fixed" | "expense_daily" | "income">("expense_fixed");
  const [isSimulation, setIsSimulation] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [date, setDate] = useState(settings.referenceToday);
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit_card">("cash");
  const [installments, setInstallments] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLaunchModalOpen) {
      setDate(launchModalPresetDate || settings.referenceToday);
      setIsSimulation(launchModalPresetSimulation);
      setTxType(launchModalPresetType);
      setAmountStr("");
      setDescription("");
      setCategory("");
      setPaymentMethod("cash");
      setInstallments(1);
    }
  }, [
    isLaunchModalOpen,
    launchModalPresetDate,
    launchModalPresetSimulation,
    launchModalPresetType,
    settings.referenceToday,
  ]);

  const parsedAmount = useMemo(() => {
    const cleaned = amountStr.replace(/[^\d,.-]/g, "").replace(",", ".");
    const val = parseFloat(cleaned);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [amountStr]);

  const todayIso = settings.referenceToday;
  const tomorrowIso = useMemo(() => {
    const d = new Date(`${todayIso}T00:00:00`);
    d.setDate(d.getDate() + 1);
    return formatIsoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, [todayIso]);

  const endOfMonthIso = useMemo(() => {
    const [y, m] = todayIso.split("-").map(Number);
    return formatIsoDate(y, m, getDaysInMonth(y, m));
  }, [todayIso]);

  const installmentDates = useMemo(() => {
    if (paymentMethod !== "credit_card" || txType === "income") {
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
      paymentMethod === "credit_card" && txType !== "income"
        ? Math.max(1, installments)
        : 1;
    return Number((parsedAmount / count).toFixed(2));
  }, [parsedAmount, paymentMethod, txType, installments]);

  const currentYM = todayIso.slice(0, 7);
  const currentMonthImpact = useMemo(() => {
    let impact = 0;
    for (const d of installmentDates) {
      if (d.slice(0, 7) <= currentYM) {
        impact += txType === "income" ? perInstallmentAmount : -perInstallmentAmount;
      }
    }
    return impact;
  }, [installmentDates, currentYM, txType, perInstallmentAmount]);

  const projectedAfter = Number((currentEndOfMonthBalance + currentMonthImpact).toFixed(2));
  const afterLiquidity = classifyLiquidity(projectedAfter);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedAmount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }
    if (!date) {
      toast.error("Informe a data.");
      return;
    }

    const effectivePaymentMethod = txType === "income" ? "cash" : paymentMethod;

    if (isSimulation) {
      addStagedSimulation({
        date,
        type: txType,
        amount: parsedAmount,
        description: description.trim() || undefined,
        category: category || undefined,
        paymentMethod: effectivePaymentMethod,
        installments: effectivePaymentMethod === "credit_card" ? installments : 1,
      });
      toast.success("Simulação adicionada.");
      closeLaunchModal();
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
        paymentMethod: effectivePaymentMethod,
        installments: effectivePaymentMethod === "credit_card" ? installments : 1,
        isSimulation: false,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success("Lançamento salvo.");
      closeLaunchModal();
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <AnimatePresence>
      {isLaunchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={closeLaunchModal}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative bg-white w-full max-w-md rounded-xl shadow-2xl border border-[#cfd8d2] overflow-hidden z-10"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-launch-title"
          >
            <div className="px-4 py-3 border-b border-[#d8e0da] flex items-center justify-between bg-[#eff3f0]">
              <h2 id="modal-launch-title" className="text-sm font-bold text-[#141f17]">
                {txType === "expense_fixed"
                  ? "Nova Saída"
                  : txType === "expense_daily"
                  ? "Novo Gasto Diário"
                  : "Nova Entrada"}{" "}
                • {formatFullDate(date)}
              </h2>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white text-[#526657] border border-[#cfd8d2] rounded">
                  Esc
                </kbd>
                <button
                  type="button"
                  onClick={closeLaunchModal}
                  className="p-1 rounded-md text-[#526657] hover:bg-white cursor-pointer"
                  aria-label="Fechar modal"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <form
              onSubmit={handleSubmit}
              className="p-4 space-y-3.5 max-h-[82dvh] overflow-y-auto thin-scroll"
            >
              {/* Animated Tabs */}
              <div className="grid grid-cols-3 gap-1 bg-[#eff3f0] p-1 rounded-lg border border-[#d5ded8]">
                {(
                  [
                    { id: "expense_fixed", label: "Saída", icon: TrendingDown, color: "text-[#9e1c1c]" },
                    { id: "expense_daily", label: "Diário", icon: Wallet, color: "text-[#7c5800]" },
                    { id: "income", label: "Entrada", icon: TrendingUp, color: "text-[#1b5e20]" },
                  ] as const
                ).map((tab) => {
                  const active = txType === tab.id;
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setTxType(tab.id)}
                      className={`relative py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer z-10 ${
                        active ? tab.color : "text-[#4e6153]"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="launch-modal-tab-pill"
                          transition={{ type: "spring", stiffness: 450, damping: 34 }}
                          className="absolute inset-0 bg-white rounded-md shadow-2xs -z-10"
                        />
                      )}
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Toggle Simulação */}
              <div
                onClick={() => setIsSimulation(!isSimulation)}
                className={`px-3 py-2 rounded-lg border flex items-center justify-between cursor-pointer transition-colors ${
                  isSimulation
                    ? "bg-[#fdf6e2] border-[#d9c27e]"
                    : "bg-[#eff3f0] border-[#d5ded8]"
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-[#141f17]">
                  <FlaskConical className="w-3.5 h-3.5 text-[#7c5800]" />
                  <span>Simulação em Memória</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isSimulation}
                  className={`w-9 h-5 rounded-full transition-colors p-0.5 ${
                    isSimulation ? "bg-[#7c5800]" : "bg-[#c5d1c8]"
                  }`}
                >
                  <span
                    className={`block w-4 h-4 rounded-full bg-white transition-transform ${
                      isSimulation ? "translate-x-4" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>

              {/* Valor */}
              <div>
                <label
                  htmlFor="launch-amount"
                  className="block text-xs font-semibold text-[#141f17] mb-1"
                >
                  Valor (R$) *
                </label>
                <input
                  id="launch-amount"
                  type="text"
                  inputMode="decimal"
                  required
                  autoFocus
                  placeholder="0,00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-[#c5d1c8] bg-white text-right text-base font-bold text-[#141f17] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
                />
              </div>

              {/* Data */}
              <div>
                <label
                  htmlFor="launch-date"
                  className="block text-xs font-semibold text-[#141f17] mb-1"
                >
                  Data *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 items-center">
                  <input
                    id="launch-date"
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-xs font-semibold text-[#141f17]"
                  />
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setDate(todayIso)}
                      className={`flex-1 h-8 px-2 rounded text-[11px] font-semibold border cursor-pointer ${
                        date === todayIso
                          ? "bg-[#dce6df] border-[#2d6a3e] text-[#141f17]"
                          : "bg-[#eff3f0] border-[#d5ded8] text-[#4e6153]"
                      }`}
                    >
                      Hoje
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(tomorrowIso)}
                      className={`flex-1 h-8 px-2 rounded text-[11px] font-semibold border cursor-pointer ${
                        date === tomorrowIso
                          ? "bg-[#dce6df] border-[#2d6a3e] text-[#141f17]"
                          : "bg-[#eff3f0] border-[#d5ded8] text-[#4e6153]"
                      }`}
                    >
                      Amanhã
                    </button>
                    <button
                      type="button"
                      onClick={() => setDate(endOfMonthIso)}
                      className={`flex-1 h-8 px-2 rounded text-[11px] font-semibold border cursor-pointer ${
                        date === endOfMonthIso
                          ? "bg-[#dce6df] border-[#2d6a3e] text-[#141f17]"
                          : "bg-[#eff3f0] border-[#d5ded8] text-[#4e6153]"
                      }`}
                    >
                      Fim Mês
                    </button>
                  </div>
                </div>
              </div>

              {/* Cartão & Parcelas */}
              {txType !== "income" && (
                <div className="p-3 rounded-lg bg-[#eff3f0] border border-[#d5ded8] space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="grid grid-cols-2 gap-1 bg-white p-0.5 rounded-md border border-[#d5ded8]">
                      <button
                        type="button"
                        onClick={() => {
                          setPaymentMethod("cash");
                          setInstallments(1);
                        }}
                        className={`py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                          paymentMethod === "cash"
                            ? "bg-[#2d6a3e] text-white"
                            : "text-[#4e6153]"
                        }`}
                      >
                        <Banknote className="w-3 h-3" />
                        <span>À Vista</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setPaymentMethod("credit_card")}
                        className={`py-1.5 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
                          paymentMethod === "credit_card"
                            ? "bg-[#2d6a3e] text-white"
                            : "text-[#4e6153]"
                        }`}
                      >
                        <CreditCard className="w-3 h-3" />
                        <span>Cartão</span>
                      </button>
                    </div>

                    <select
                      id="launch-installments"
                      disabled={paymentMethod !== "credit_card"}
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value))}
                      className="w-full h-8 px-2 rounded-md border border-[#c5d1c8] bg-white text-xs font-semibold text-[#141f17] disabled:opacity-50"
                    >
                      {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                        <option key={n} value={n}>
                          {n}x {parsedAmount > 0 ? `(${formatBRL(parsedAmount / n)})` : ""}
                        </option>
                      ))}
                    </select>
                  </div>

                  {paymentMethod === "credit_card" && (
                    <div className="text-[11px] text-[#141f17] flex justify-between">
                      <span>
                        Fecha dia {settings.creditCardClosingDay} • Vence dia{" "}
                        {settings.creditCardDueDay}
                      </span>
                      <span className="font-bold text-[#2d6a3e]">
                        1º débito: {formatFullDate(installmentDates[0])}
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Descrição & Categoria (Opcionais) */}
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="text"
                  placeholder="Descrição (opcional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-xs text-[#141f17]"
                />
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-9 px-2.5 rounded-lg border border-[#c5d1c8] bg-white text-xs text-[#141f17]"
                >
                  <option value="">Categoria (opcional)</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Preview compacto */}
              <div className="p-2.5 rounded-lg bg-[#eff3f0] border border-[#d5ded8] flex items-center justify-between text-xs">
                <div>
                  <span className="text-[#526657]">Saldo Fim Mês: </span>
                  <span className="font-bold text-[#141f17]">{formatBRL(projectedAfter)}</span>
                </div>
                <span
                  className={`text-[11px] px-2 py-0.5 rounded font-semibold ${afterLiquidity.bgClass}`}
                >
                  {afterLiquidity.shortLabel}
                </span>
              </div>

              <div className="pt-1 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={closeLaunchModal}
                  className="h-9 px-4 rounded-lg border border-[#d5ded8] text-xs font-semibold text-[#4e6153] cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className={`h-9 px-5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer ${
                    isSimulation
                      ? "bg-[#7c5800] hover:bg-[#5c4300]"
                      : "bg-[#2d6a3e] hover:bg-[#204f2d]"
                  }`}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Check className="w-3.5 h-3.5" />
                  )}
                  <span>{isSimulation ? "Simular" : "Salvar"}</span>
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
