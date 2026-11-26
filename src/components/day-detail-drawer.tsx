"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  Trash2,
  Plus,
  Check,
  RotateCcw,
  Ban,
  CheckCircle,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import type { ComputedDayRow, DayLineItem } from "@/lib/cashflow-engine";
import { formatBRL, formatFullDate } from "@/lib/format";
import {
  createRealTransactionAction,
  deleteTransactionAction,
  updateTransactionAction,
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
    stageDeleteTransaction,
    hydrateFromServer,
  } = useCashflowStore();

  const [dailyInput, setDailyInput] = useState("");
  const [newType, setNewType] = useState<"expense_fixed" | "income">("expense_fixed");
  const [newAmountStr, setNewAmountStr] = useState("");
  const [newDesc, setNewDesc] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editingItemAmount, setEditingItemAmount] = useState("");
  const [editingItemDesc, setEditingItemDesc] = useState("");
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    if (dayRow) {
      setDailyInput(String(dayRow.dailyAmount).replace(".", ","));
      setNewType(selectedColumnForDetail === "income" ? "income" : "expense_fixed");
      setNewAmountStr("");
      setNewDesc("");
      setEditingItemId(null);
    }
  }, [dayRow, selectedColumnForDetail]);

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

  async function handleSaveDailyToDb(currentDay: ComputedDayRow, amountToSave: number) {
    setIsBusy(true);
    try {
      await upsertDailyOverrideAction(currentDay.date, amountToSave);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      setDailyInput(String(amountToSave).replace(".", ","));
      toast.success(`Diário atualizado: ${formatBRL(amountToSave)}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar diário.");
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
      setDailyInput(String(currentDay.dailyTarget).replace(".", ","));
      toast.info("Meta padrão restaurada.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao restaurar.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleAddMovement(currentDay: ComputedDayRow) {
    if (parsedNewAmount <= 0) {
      toast.error("Informe um valor válido.");
      return;
    }

    setIsBusy(true);
    try {
      await createRealTransactionAction({
        date: currentDay.date,
        type: newType,
        amount: parsedNewAmount,
        description: newDesc.trim() || undefined,
        paymentMethod: "cash",
        installments: 1,
        isSimulation: false,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success(
        `${newType === "income" ? "Entrada" : "Saída"} adicionada: ${formatBRL(
          parsedNewAmount
        )}`
      );
      setNewAmountStr("");
      setNewDesc("");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setIsBusy(false);
    }
  }

  function startEditingItem(item: DayLineItem) {
    if (item.source !== "transaction") return;
    setEditingItemId(item.id);
    setEditingItemAmount(String(item.amount).replace(".", ","));
    setEditingItemDesc(
      item.title === "Saída" || item.title === "Entrada" ? "" : item.title
    );
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
      await updateTransactionAction({
        id: item.id,
        amount: val,
        description: editingItemDesc.trim() || null,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      setEditingItemId(null);
      toast.success("Transação atualizada.");
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
      toast.success("Transação excluída.");
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
      toast.success(status === "skipped" ? "Fixo ignorado." : "Fixo confirmado.");
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
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 24 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="relative w-full lg:max-w-md bg-white rounded-t-2xl lg:rounded-xl shadow-2xl border-t lg:border border-[#cfd8d2] overflow-hidden z-10 pb-safe"
            role="dialog"
            aria-modal="true"
            aria-label={`Dia ${formatFullDate(dayRow.date)}`}
          >
            {/* Mobile Sheet Handle */}
            <div className="flex lg:hidden justify-center pt-2 pb-1 bg-[#eff3f0]">
              <span className="w-10 h-1 rounded-full bg-[#b9c7bd]" />
            </div>

            {/* Header: Date & Day Balance */}
            <div className="px-4 py-3 border-b border-[#d8e0da] flex items-center justify-between bg-[#eff3f0]">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-[#141f17]">
                  Dia {formatFullDate(dayRow.date)}
                </h3>
                <span
                  className={`px-2 py-0.5 rounded text-xs font-bold ${dayRow.liquidity.bgClass}`}
                >
                  Saldo: {formatBRL(dayRow.projectedBalance)}
                </span>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg hover:bg-white text-[#4e6153] flex items-center justify-center cursor-pointer"
                aria-label="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Unified Single-View Body: 1. Diário + 2. All Transactions + 3. Quick Add */}
            <div className="p-4 space-y-4 max-h-[80dvh] overflow-y-auto thin-scroll">
              {/* 1. GASTO DIÁRIO DO DIA */}
              <div className="p-3 rounded-xl bg-[#f8faf8] border border-[#d5ded8] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141f17]">
                    Gasto Diário (R$)
                  </span>
                  {dayRow.isDailyOverridden && (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => handleResetDailyToDefault(dayRow)}
                      className="text-[11px] text-[#2d6a3e] font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Voltar meta ({formatBRL(dayRow.dailyTarget)})</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={dailyInput}
                    onChange={(e) => setDailyInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleSaveDailyToDb(dayRow, parsedDaily);
                      }
                    }}
                    className="flex-1 h-10 px-3 rounded-lg border border-[#c5d1c8] bg-white text-right text-base font-bold text-[#141f17] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleSaveDailyToDb(dayRow, parsedDaily)}
                    className="h-10 px-3.5 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Salvar</span>
                  </button>
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleSaveDailyToDb(dayRow, 0)}
                    className="h-10 px-3 rounded-lg border border-[#ef9a9a] bg-[#ffebee] hover:bg-[#ffcdd2] text-[#9e1c1c] text-xs font-bold cursor-pointer shrink-0"
                  >
                    Zerar
                  </button>
                </div>
              </div>

              {/* 2. TODAS AS TRANSAÇÕES DO DIA (SAÍDAS E ENTRADAS) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141f17]">
                    Transações do Dia ({dayRow.items.length})
                  </span>
                </div>

                {dayRow.items.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed border-[#cfd8d2] text-center text-xs text-[#526657]">
                    Nenhuma Saída ou Entrada neste dia.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {dayRow.items.map((item) => {
                      const isIncome = item.type === "income";
                      return (
                        <div
                          key={item.id}
                          className={`p-2.5 rounded-xl border ${
                            item.source === "simulation"
                              ? "bg-[#fdf6e2] border-[#d9c27e]"
                              : "bg-white border-[#cfd8d2]"
                          }`}
                        >
                          {editingItemId === item.id ? (
                            <div className="space-y-2">
                              <div className="grid grid-cols-2 gap-1.5">
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  autoFocus
                                  value={editingItemAmount}
                                  onChange={(e) =>
                                    setEditingItemAmount(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveEditedItem(item);
                                    }
                                  }}
                                  placeholder="Valor (R$)"
                                  className="h-9 px-2.5 rounded-lg border border-[#2d6a3e] bg-white text-right text-sm font-bold"
                                />
                                <input
                                  type="text"
                                  value={editingItemDesc}
                                  onChange={(e) =>
                                    setEditingItemDesc(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveEditedItem(item);
                                    }
                                  }}
                                  placeholder="Descrição"
                                  className="h-9 px-2.5 rounded-lg border border-[#c5d1c8] bg-white text-xs"
                                />
                              </div>
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setEditingItemId(null)}
                                  className="h-8 px-3 rounded-lg border border-[#cfd8d2] text-xs font-semibold text-[#4e6153] cursor-pointer"
                                >
                                  Cancelar
                                </button>
                                <button
                                  type="button"
                                  disabled={isBusy}
                                  onClick={() => handleSaveEditedItem(item)}
                                  className="h-8 px-3.5 rounded-lg bg-[#2d6a3e] text-white text-xs font-bold cursor-pointer"
                                >
                                  Salvar
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5">
                                  <span
                                    className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${
                                      isIncome
                                        ? "bg-[#e8f5e9] text-[#1b5e20]"
                                        : "bg-[#ffebee] text-[#9e1c1c]"
                                    }`}
                                  >
                                    {isIncome ? "Entrada" : "Saída"}
                                  </span>
                                  <span className="text-xs font-semibold text-[#141f17] truncate">
                                    {item.title}
                                    {item.installmentLabel
                                      ? ` (${item.installmentLabel})`
                                      : ""}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <span
                                  className={`text-xs font-bold tabular-nums mr-1 ${
                                    isIncome
                                      ? "text-[#1b5e20]"
                                      : "text-[#9e1c1c]"
                                  }`}
                                >
                                  {isIncome ? "+" : "-"} {formatBRL(item.amount)}
                                </span>

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
                                      className="h-8 px-2 rounded-lg border border-[#a5d6a7] bg-[#e8f5e9] text-[#1b5e20] text-xs font-bold flex items-center gap-1 cursor-pointer"
                                      title="Confirmar fixo"
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
                                      className="h-8 px-2 rounded-lg border border-[#ef9a9a] bg-[#ffebee] text-[#9e1c1c] text-xs font-bold flex items-center gap-1 cursor-pointer"
                                      title="Ignorar neste mês"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() => startEditingItem(item)}
                                      className="h-8 px-2.5 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-[#141f17] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Pencil className="w-3 h-3" />
                                      <span>Editar</span>
                                    </button>
                                    <button
                                      type="button"
                                      disabled={isBusy}
                                      onClick={() =>
                                        handleDeleteItem(
                                          item.id,
                                          item.isInMemory
                                        )
                                      }
                                      className="h-8 px-2.5 rounded-lg border border-[#ef9a9a] bg-[#ffebee] hover:bg-[#ffcdd2] text-[#9e1c1c] text-xs font-semibold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Excluir</span>
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. ADICIONAR NOVA SAÍDA OU ENTRADA NESTE DIA */}
              <div className="pt-3 border-t border-[#e4ebe6] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141f17]">
                    Adicionar neste dia
                  </span>
                  <div className="flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
                    <button
                      type="button"
                      onClick={() => setNewType("expense_fixed")}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                        newType === "expense_fixed"
                          ? "bg-white text-[#9e1c1c] shadow-2xs"
                          : "text-[#4e6153]"
                      }`}
                    >
                      Saída
                    </button>
                    <button
                      type="button"
                      onClick={() => setNewType("income")}
                      className={`px-2.5 py-1 rounded-md text-xs font-bold cursor-pointer ${
                        newType === "income"
                          ? "bg-white text-[#1b5e20] shadow-2xs"
                          : "text-[#4e6153]"
                      }`}
                    >
                      Entrada
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="Valor (R$)"
                    value={newAmountStr}
                    onChange={(e) => setNewAmountStr(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMovement(dayRow);
                      }
                    }}
                    className="w-28 h-10 px-2.5 rounded-lg border border-[#c5d1c8] text-right text-sm font-bold text-[#141f17]"
                  />
                  <input
                    type="text"
                    placeholder="Descrição (opcional)"
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAddMovement(dayRow);
                      }
                    }}
                    className="flex-1 h-10 px-2.5 rounded-lg border border-[#c5d1c8] text-xs text-[#141f17]"
                  />
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleAddMovement(dayRow)}
                    className="h-10 px-3.5 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Lançar</span>
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
