"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Trash2,
  Plus,
  FlaskConical,
  Check,
  RotateCcw,
  Ban,
  CheckCircle,
  CreditCard,
  Banknote,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import type { ComputedDayRow, DayLineItem } from "@/lib/cashflow-engine";
import { CATEGORIES, formatBRL, formatFullDate } from "@/lib/format";
import {
  createRealTransactionAction,
  deleteTransactionAction,
  updateTransactionAmountAction,
  upsertDailyOverrideAction,
  removeDailyOverrideAction,
  setRecurringOccurrenceStatusAction,
  fetchInitialCashflowData,
} from "@/app/actions";

interface DayDetailDrawerProps {
  dayRow: ComputedDayRow | null;
  onClose: () => void;
}

export function DayDetailDrawer({ dayRow, onClose }: DayDetailDrawerProps) {
  const {
    selectedColumnForDetail,
    setSelectedDayForDetail,
    stageDailyOverride,
    stageDeleteTransaction,
    addStagedSimulation,
    hydrateFromServer,
  } = useCashflowStore();

  const [dailyInput, setDailyInput] = useState("");
  const [newAmountStr, setNewAmountStr] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newCategory, setNewCategory] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit_card">("cash");
  const [installments, setInstallments] = useState(1);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemAmount, setEditingItemAmount] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  const activeCol = selectedColumnForDetail;

  useEffect(() => {
    if (dayRow) {
      setDailyInput(String(dayRow.dailyAmount).replace(".", ","));
      setNewAmountStr("");
      setNewDesc("");
      setNewCategory("");
      setPaymentMethod("cash");
      setInstallments(1);
      setEditingItemId(null);
    }
  }, [dayRow, activeCol]);

  const parsedDaily = (() => {
    const cleaned = dailyInput.replace(/[^\d,.-]/g, "").replace(",", ".");
    const val = parseFloat(cleaned);
    return isNaN(val) || val < 0 ? 0 : val;
  })();

  const parsedNewAmount = (() => {
    const cleaned = newAmountStr.replace(/[^\d,.-]/g, "").replace(",", ".");
    const val = parseFloat(cleaned);
    return isNaN(val) || val < 0 ? 0 : val;
  })();

  const columnTitle =
    activeCol === "income"
      ? "Entrada"
      : activeCol === "expense_fixed"
      ? "Saída"
      : "Diário";

  async function handleSaveDailyToDb(currentDay: ComputedDayRow, amountToSave: number) {
    setIsBusy(true);
    try {
      await upsertDailyOverrideAction(currentDay.date, amountToSave);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success(`Diário: ${formatBRL(amountToSave)}`);
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleResetDailyToDefault(currentDay: ComputedDayRow) {
    setIsBusy(true);
    try {
      await removeDailyOverrideAction(currentDay.date);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.info("Meta padrão restaurada.");
      onClose();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao restaurar.");
    } finally {
      setIsBusy(false);
    }
  }

  function handleSimulateDailyInMemory(currentDay: ComputedDayRow, amountToSim: number) {
    stageDailyOverride(currentDay.date, amountToSim);
    toast.success(`Diário simulado: ${formatBRL(amountToSim)}`);
    onClose();
  }

  async function handleAddMovement(currentDay: ComputedDayRow, asSimulation: boolean) {
    if (parsedNewAmount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    const effectiveMethod = activeCol === "income" ? "cash" : paymentMethod;
    const effectiveInstallments = effectiveMethod === "credit_card" ? installments : 1;

    if (asSimulation) {
      addStagedSimulation({
        date: currentDay.date,
        type: activeCol,
        amount: parsedNewAmount,
        description: newDesc.trim() || undefined,
        category: newCategory || undefined,
        paymentMethod: effectiveMethod,
        installments: effectiveInstallments,
      });
      toast.success(`${columnTitle} simulada.`);
      setNewAmountStr("");
      setNewDesc("");
      return;
    }

    setIsBusy(true);
    try {
      await createRealTransactionAction({
        date: currentDay.date,
        type: activeCol,
        amount: parsedNewAmount,
        description: newDesc.trim() || undefined,
        category: newCategory || undefined,
        paymentMethod: effectiveMethod,
        installments: effectiveInstallments,
        isSimulation: false,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success(`${columnTitle} adicionada.`);
      setNewAmountStr("");
      setNewDesc("");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleSaveEditedItem(item: DayLineItem) {
    const cleaned = editingItemAmount.replace(/[^\d,.-]/g, "").replace(",", ".");
    const val = parseFloat(cleaned);
    if (isNaN(val) || val <= 0) {
      toast.error("Valor inválido.");
      return;
    }

    setIsBusy(true);
    try {
      await updateTransactionAmountAction(item.id, val);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      setEditingItemId(null);
      toast.success("Valor atualizado.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleDeleteItem(itemId: string, isInMemory?: boolean) {
    if (isInMemory || itemId.startsWith("sim_")) {
      stageDeleteTransaction(itemId);
      toast.info("Simulação removida.");
      return;
    }
    setIsBusy(true);
    try {
      await deleteTransactionAction(itemId);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success("Excluído.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleToggleRecurringStatus(
    ruleId: string,
    yearMonth: string,
    status: "confirmed" | "skipped"
  ) {
    setIsBusy(true);
    try {
      await setRecurringOccurrenceStatusAction({
        ruleId,
        yearMonth,
        status,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success(status === "skipped" ? "Ignorado." : "Confirmado.");
    } catch (err) {
      console.error(err);
      toast.error("Erro.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <AnimatePresence>
      {dayRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="relative w-full max-w-sm bg-white rounded-xl shadow-2xl border border-[#cfd8d2] overflow-hidden z-10"
            role="dialog"
            aria-modal="true"
            aria-label={`${columnTitle} ${formatFullDate(dayRow.date)}`}
          >
            {/* Header with Date & Saldo */}
            <div className="px-4 py-2.5 border-b border-[#d8e0da] flex items-center justify-between bg-[#eff3f0]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#141f17]">
                  {columnTitle} • {formatFullDate(dayRow.date)}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${dayRow.liquidity.bgClass}`}
                >
                  {formatBRL(dayRow.projectedBalance)}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-white text-[#526657] border border-[#cfd8d2] rounded">
                  Esc
                </kbd>
                <button
                  type="button"
                  onClick={onClose}
                  className="p-1 rounded hover:bg-white text-[#4e6153] cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Column Switcher Tabs with Framer Motion layoutId */}
            <div className="px-4 pt-3">
              <div className="grid grid-cols-3 gap-1 bg-[#eff3f0] p-1 rounded-lg border border-[#d5ded8]">
                {(
                  [
                    { id: "income", label: "Entrada", color: "text-[#1b5e20]" },
                    { id: "expense_fixed", label: "Saída", color: "text-[#9e1c1c]" },
                    { id: "expense_daily", label: "Diário", color: "text-[#141f17]" },
                  ] as const
                ).map((tab) => {
                  const active = activeCol === tab.id;
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setSelectedDayForDetail(dayRow.date, tab.id)}
                      className={`relative py-1.5 rounded text-xs font-semibold cursor-pointer z-10 ${
                        active ? tab.color : "text-[#4e6153]"
                      }`}
                    >
                      {active && (
                        <motion.span
                          layoutId="day-drawer-tab-pill"
                          transition={{ type: "spring", stiffness: 450, damping: 34 }}
                          className="absolute inset-0 bg-white rounded shadow-2xs -z-10"
                        />
                      )}
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Body specific to the clicked column */}
            <div className="p-4 space-y-3.5 max-h-[75dvh] overflow-y-auto thin-scroll">
              {activeCol === "expense_daily" ? (
                /* DIÁRIO VIEW */
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-[#141f17]">
                      Valor Diário (R$)
                    </label>
                    {dayRow.isDailyOverridden && (
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleResetDailyToDefault(dayRow)}
                        className="text-[11px] text-[#2d6a3e] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Padrão ({formatBRL(dayRow.dailyTarget)})</span>
                      </button>
                    )}
                  </div>

                  <input
                    type="text"
                    inputMode="decimal"
                    autoFocus
                    value={dailyInput}
                    onChange={(e) => setDailyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveDailyToDb(dayRow, parsedDaily);
                      }
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-[#c5d1c8] text-right text-base font-bold text-[#141f17] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
                  />

                  <div className="grid grid-cols-3 gap-1.5">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSaveDailyToDb(dayRow, parsedDaily)}
                      className="h-9 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>Salvar</span>
                    </button>

                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleSaveDailyToDb(dayRow, 0)}
                      className="h-9 rounded-lg border border-[#e06666] bg-[#ffebee] hover:bg-[#ffcdd2] text-[#8e1414] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Zerar</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleSimulateDailyInMemory(dayRow, parsedDaily)}
                      className="h-9 rounded-lg border border-[#d9c27e] bg-[#fdf6e2] hover:bg-[#faeec9] text-[#5c4300] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <FlaskConical className="w-3.5 h-3.5" />
                      <span>Simular</span>
                    </button>
                  </div>
                </div>
              ) : (
                /* ENTRADA OR SAÍDA VIEW */
                <div className="space-y-3.5">
                  {dayRow.items.filter((item) => item.type === activeCol).length > 0 && (
                    <div className="space-y-1.5">
                      {dayRow.items
                        .filter((item) => item.type === activeCol)
                        .map((item) => (
                          <div
                            key={item.id}
                            className={`p-2.5 rounded-lg border flex items-center justify-between gap-2 ${
                              item.source === "simulation"
                                ? "bg-[#fdf6e2] border-[#d9c27e]"
                                : "bg-[#f8faf8] border-[#d5ded8]"
                            }`}
                          >
                            {editingItemId === item.id ? (
                              <div className="flex items-center gap-1.5 w-full">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  autoFocus
                                  value={editingItemAmount}
                                  onChange={(e) => setEditingItemAmount(e.target.value)}
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveEditedItem(item);
                                    }
                                  }}
                                  className="flex-1 h-8 px-2 rounded border border-[#2d6a3e] bg-white text-right text-xs font-bold"
                                />
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleSaveEditedItem(item)}
                                  className="h-8 px-2.5 rounded bg-[#2d6a3e] text-white text-xs font-semibold cursor-pointer"
                                >
                                  OK
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setEditingItemId(null)}
                                  className="h-8 px-2 rounded border border-[#cfd8d2] text-xs cursor-pointer"
                                >
                                  X
                                </button>
                              </div>
                            ) : (
                              <>
                                <div
                                  onClick={() => {
                                    if (item.source === "transaction") {
                                      setEditingItemId(item.id);
                                      setEditingItemAmount(
                                        String(item.amount).replace(".", ",")
                                      );
                                    }
                                  }}
                                  className="min-w-0 flex-1 cursor-pointer"
                                >
                                  <div className="text-xs font-semibold text-[#141f17] truncate">
                                    {item.title}
                                    {item.installmentLabel
                                      ? ` (${item.installmentLabel})`
                                      : ""}
                                  </div>
                                  {item.category && (
                                    <div className="text-[11px] text-[#526657]">
                                      {item.category}
                                    </div>
                                  )}
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (item.source === "transaction") {
                                        setEditingItemId(item.id);
                                        setEditingItemAmount(
                                          String(item.amount).replace(".", ",")
                                        );
                                      }
                                    }}
                                    className={`text-xs font-bold cursor-pointer hover:underline ${
                                      item.type === "income"
                                        ? "text-[#1b5e20]"
                                        : "text-[#9e1c1c]"
                                    }`}
                                  >
                                    {formatBRL(item.amount)}
                                  </button>

                                  {item.source === "recurring" &&
                                  item.recurringRuleId &&
                                  item.yearMonth ? (
                                    <>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() =>
                                          handleToggleRecurringStatus(
                                            item.recurringRuleId!,
                                            item.yearMonth!,
                                            "confirmed"
                                          )
                                        }
                                        className="p-1 rounded hover:bg-[#e8f5e9] text-[#1b5e20] cursor-pointer"
                                      >
                                        <CheckCircle className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        disabled={isBusy}
                                        onClick={() =>
                                          handleToggleRecurringStatus(
                                            item.recurringRuleId!,
                                            item.yearMonth!,
                                            "skipped"
                                          )
                                        }
                                        className="p-1 rounded hover:bg-[#ffebee] text-[#9e1c1c] cursor-pointer"
                                      >
                                        <Ban className="w-3.5 h-3.5" />
                                      </button>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleDeleteItem(item.id, item.isInMemory)
                                      }
                                      className="p-1 rounded hover:bg-[#ffebee] text-[#9e1c1c] cursor-pointer"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  )}
                                </div>
                              </>
                            )}
                          </div>
                        ))}
                    </div>
                  )}

                  {/* Quick Add Form for this specific column */}
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <label className="block text-xs font-bold text-[#141f17] mb-1">
                        Novo Valor de {columnTitle} (R$)
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        placeholder="0,00"
                        value={newAmountStr}
                        onChange={(e) => setNewAmountStr(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddMovement(dayRow, false);
                          }
                        }}
                        className="w-full h-10 px-3 rounded-lg border border-[#c5d1c8] text-right text-base font-bold text-[#141f17] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
                      />
                    </div>

                    {activeCol === "expense_fixed" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div className="grid grid-cols-2 gap-1 bg-[#eff3f0] p-0.5 rounded-md border border-[#d5ded8]">
                          <button
                            type="button"
                            onClick={() => {
                              setPaymentMethod("cash");
                              setInstallments(1);
                            }}
                            className={`py-1 px-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
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
                            className={`py-1 px-1.5 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
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
                          disabled={paymentMethod !== "credit_card"}
                          value={installments}
                          onChange={(e) => setInstallments(Number(e.target.value))}
                          className="h-8 px-2 rounded-md border border-[#c5d1c8] bg-white text-xs font-semibold disabled:opacity-50"
                        >
                          {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                            <option key={n} value={n}>
                              {n}x
                            </option>
                          ))}
                        </select>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Descrição (opcional)"
                        value={newDesc}
                        onChange={(e) => setNewDesc(e.target.value)}
                        className="h-8 px-2.5 rounded-md border border-[#c5d1c8] text-xs"
                      />
                      <select
                        value={newCategory}
                        onChange={(e) => setNewCategory(e.target.value)}
                        className="h-8 px-2 rounded-md border border-[#c5d1c8] bg-white text-xs"
                      >
                        <option value="">Categoria (opcional)</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAddMovement(dayRow, false)}
                        className="h-9 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Salvar {columnTitle}</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => handleAddMovement(dayRow, true)}
                        className="h-9 rounded-lg border border-[#d9c27e] bg-[#fdf6e2] hover:bg-[#faeec9] text-[#5c4300] text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer"
                      >
                        <FlaskConical className="w-3.5 h-3.5" />
                        <span>Simular {columnTitle}</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
