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
  Pencil,
  Trash2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  calculateCreditCardInstallmentDates,
  classifyLiquidity,
  type TransactionRecord,
} from "@/lib/cashflow-engine";
import { CATEGORIES, formatBRL, formatFullDate } from "@/lib/format";
import {
  createRealTransactionAction,
  deleteTransactionAction,
  fetchInitialCashflowData,
  updateTransactionAction,
} from "@/app/actions";

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
    dbTransactions,
    stagedTransactions,
    stagedDeletedTxIds,
    addStagedSimulation,
    updateStagedSimulation,
    stageDeleteTransaction,
    hydrateFromServer,
  } = useCashflowStore();

  // Fixed date from the clicked cell in the table (RN-01, RN-02)
  const date = launchModalPresetDate || settings.referenceToday;

  // Form state for adding a NEW transaction
  const [txType, setTxType] = useState<
    "expense_fixed" | "expense_daily" | "income"
  >("expense_daily");
  const [isSimulation, setIsSimulation] = useState(false);
  const [amountStr, setAmountStr] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit_card">(
    "cash"
  );
  const [installments, setInstallments] = useState(1);
  const [isSubmittingNew, setIsSubmittingNew] = useState(false);

  // Inline Edit state for an existing transaction card (RN-07)
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [editType, setEditType] = useState<
    "expense_fixed" | "expense_daily" | "income"
  >("expense_daily");
  const [editAmountStr, setEditAmountStr] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPaymentMethod, setEditPaymentMethod] = useState<
    "cash" | "credit_card"
  >("cash");
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);

  useEffect(() => {
    if (isLaunchModalOpen) {
      setIsSimulation(launchModalPresetSimulation);
      setTxType(launchModalPresetType);
      setAmountStr("");
      setDescription("");
      setCategory("");
      setPaymentMethod("cash");
      setInstallments(1);
      setEditingTxId(null);
    }
  }, [
    isLaunchModalOpen,
    launchModalPresetDate,
    launchModalPresetSimulation,
    launchModalPresetType,
  ]);

  const dayTransactions = useMemo(() => {
    const deletedSet = new Set(stagedDeletedTxIds);
    const all = [
      ...dbTransactions.filter((t) => !deletedSet.has(t.id)),
      ...stagedTransactions,
    ];
    return all.filter((t) => t.date === date);
  }, [dbTransactions, stagedTransactions, stagedDeletedTxIds, date]);

  const dayDailyTransactions = useMemo(
    () => dayTransactions.filter((t) => t.type === "expense_daily"),
    [dayTransactions]
  );

  const dayDailySum = useMemo(
    () =>
      Number(
        dayDailyTransactions
          .reduce((acc, t) => acc + t.amount, 0)
          .toFixed(2)
      ),
    [dayDailyTransactions]
  );

  const isFutureDate = date > settings.referenceToday;

  const parsedAmount = useMemo(() => {
    const cleaned = amountStr.replace(/[^\d,.-]/g, "").replace(",", ".");
    const val = parseFloat(cleaned);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [amountStr]);

  const parsedEditAmount = useMemo(() => {
    const cleaned = editAmountStr.replace(/[^\d,.-]/g, "").replace(",", ".");
    const val = parseFloat(cleaned);
    return isNaN(val) || val < 0 ? 0 : val;
  }, [editAmountStr]);

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

  const currentYM = settings.referenceToday.slice(0, 7);
  const currentMonthImpact = useMemo(() => {
    if (parsedAmount <= 0) return 0;
    if (txType === "expense_daily") {
      if (date.slice(0, 7) > currentYM) return 0;
      if (isFutureDate && dayDailyTransactions.length === 0) {
        // First daily transaction on a future day replaces the projected daily target
        return Number(
          (-(parsedAmount - settings.dailySpendingTarget)).toFixed(2)
        );
      }
      return Number((-parsedAmount).toFixed(2));
    }
    let impact = 0;
    for (const d of installmentDates) {
      if (d.slice(0, 7) <= currentYM) {
        impact +=
          txType === "income" ? perInstallmentAmount : -perInstallmentAmount;
      }
    }
    return impact;
  }, [
    parsedAmount,
    txType,
    date,
    currentYM,
    isFutureDate,
    dayDailyTransactions.length,
    settings.dailySpendingTarget,
    installmentDates,
    perInstallmentAmount,
  ]);

  const projectedAfter = Number(
    (currentEndOfMonthBalance + currentMonthImpact).toFixed(2)
  );
  const afterLiquidity = classifyLiquidity(projectedAfter);

  function startInlineEdit(tx: TransactionRecord) {
    setEditingTxId(tx.id);
    setEditType(tx.type);
    setEditAmountStr(String(tx.amount).replace(".", ","));
    setEditDescription(tx.description || "");
    setEditCategory(tx.category || "");
    setEditPaymentMethod(tx.paymentMethod || "cash");
  }

  function cancelInlineEdit() {
    setEditingTxId(null);
  }

  async function handleSaveInlineEdit(tx: TransactionRecord) {
    if (parsedEditAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    const effectiveMethod =
      editType === "expense_fixed" ? editPaymentMethod : "cash";

    if (tx.isInMemory || tx.id.startsWith("sim_")) {
      updateStagedSimulation(tx.id, {
        type: editType,
        amount: parsedEditAmount,
        description: editDescription.trim() || null,
        category: editCategory || null,
        paymentMethod: effectiveMethod,
      });
      setEditingTxId(null);
      toast.success("Simulação atualizada.");
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateTransactionAction({
        id: tx.id,
        type: editType,
        amount: parsedEditAmount,
        description: editDescription.trim() || null,
        category: editCategory || null,
        paymentMethod: effectiveMethod,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      setEditingTxId(null);
      toast.success("Transação atualizada.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar transação.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteTransaction(tx: TransactionRecord) {
    if (tx.isInMemory || tx.id.startsWith("sim_")) {
      stageDeleteTransaction(tx.id);
      if (editingTxId === tx.id) setEditingTxId(null);
      toast.info("Simulação removida.");
      return;
    }
    setDeletingTxId(tx.id);
    try {
      await deleteTransactionAction(tx.id);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      if (editingTxId === tx.id) setEditingTxId(null);
      toast.success("Transação excluída.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir.");
    } finally {
      setDeletingTxId(null);
    }
  }

  async function handleAddTransaction(e: React.FormEvent) {
    e.preventDefault();
    if (parsedAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    // RN-05 & RN-09: Only Saída (expense_fixed) can use credit card / installments
    const effectivePaymentMethod =
      txType === "expense_fixed" ? paymentMethod : "cash";
    const effectiveInstallments =
      effectivePaymentMethod === "credit_card" ? installments : 1;

    if (isSimulation) {
      addStagedSimulation({
        date,
        type: txType,
        amount: parsedAmount,
        description: description.trim() || undefined,
        category: category || undefined,
        paymentMethod: effectivePaymentMethod,
        installments: effectiveInstallments,
      });
      toast.success("Simulação adicionada ao dia.");
      setAmountStr("");
      setDescription("");
      setCategory("");
      setInstallments(1);
      return;
    }

    setIsSubmittingNew(true);
    try {
      await createRealTransactionAction({
        date,
        type: txType,
        amount: parsedAmount,
        description: description.trim() || undefined,
        category: category || undefined,
        paymentMethod: effectivePaymentMethod,
        installments: effectiveInstallments,
        isSimulation: false,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success("Transação adicionada.");
      setAmountStr("");
      setDescription("");
      setCategory("");
      setInstallments(1);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar transação.");
    } finally {
      setIsSubmittingNew(false);
    }
  }

  return (
    <AnimatePresence>
      {isLaunchModalOpen && (
        <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={closeLaunchModal}
          />
          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 28 }}
            transition={{ duration: 0.16, ease: "easeOut" }}
            className="relative bg-white w-full lg:max-w-md rounded-t-2xl lg:rounded-xl shadow-2xl border-t lg:border border-[#cfd8d2] overflow-hidden z-10 pb-safe"
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-launch-title"
          >
            <div className="flex lg:hidden justify-center pt-2 pb-1 bg-[#eff3f0]">
              <span className="w-10 h-1 rounded-full bg-[#b9c7bd]" />
            </div>

            {/* Header: Displays the clicked date (no date picker inside modal - RN-01) */}
            <div className="px-4 py-3 border-b border-[#d8e0da] flex items-center justify-between bg-[#eff3f0]">
              <div className="flex items-center gap-2">
                <h2
                  id="modal-launch-title"
                  className="text-sm font-bold text-[#141f17]"
                >
                  Dia {formatFullDate(date)}
                </h2>
                {dayDailyTransactions.length > 0 && (
                  <span className="px-2 py-0.5 rounded-md bg-[#fff3cd] border border-[#ffe69c] text-[11px] font-bold text-[#7c5800] tabular-nums">
                    Diário: {formatBRL(dayDailySum)}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={closeLaunchModal}
                className="w-8 h-8 rounded-lg text-[#526657] hover:bg-white flex items-center justify-center cursor-pointer"
                aria-label="Fechar modal"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-4 max-h-[82dvh] overflow-y-auto thin-scroll">
              {/* 1. LISTA DE TRANSAÇÕES DO DIA (COM EDIÇÃO INLINE - RN-04, RN-07) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141f17]">
                    Transações em {formatFullDate(date)} ({dayTransactions.length})
                  </span>
                  {dayTransactions.length > 0 && (
                    <span className="text-[11px] text-[#526657]">
                      Clique em Editar para alterar no próprio item
                    </span>
                  )}
                </div>

                {dayTransactions.length === 0 ? (
                  <div className="p-3 rounded-xl border border-dashed border-[#cfd8d2] bg-[#f8faf8] text-center space-y-0.5">
                    <div className="text-xs font-semibold text-[#4e6153]">
                      Nenhuma transação lançada neste dia.
                    </div>
                    {isFutureDate && (
                      <div className="text-[11px] text-[#526657]">
                        Projeção atual usa a Meta Diária ({formatBRL(settings.dailySpendingTarget)}).
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-2">
                    {dayTransactions.map((tx) => {
                      const isEditingThis = editingTxId === tx.id;
                      const badgeStyle =
                        tx.type === "income"
                          ? "bg-[#e8f5e9] text-[#1b5e20]"
                          : tx.type === "expense_daily"
                          ? "bg-[#fff3cd] text-[#7c5800]"
                          : "bg-[#ffebee] text-[#9e1c1c]";
                      const badgeLabel =
                        tx.type === "income"
                          ? "Entrada"
                          : tx.type === "expense_daily"
                          ? "Diário"
                          : "Saída";

                      if (isEditingThis) {
                        return (
                          <div
                            key={tx.id}
                            className="p-3 rounded-xl border-2 border-[#2d6a3e] bg-[#eef6f0] shadow-md space-y-2.5 transition-all"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] font-bold text-[#1b5e20] flex items-center gap-1.5">
                                <span className="w-2 h-2 rounded-full bg-[#2d6a3e] animate-pulse" />
                                <span>
                                  Editando:{" "}
                                  {tx.description || tx.category || badgeLabel}
                                </span>
                              </span>
                              <button
                                type="button"
                                onClick={cancelInlineEdit}
                                className="text-[11px] font-semibold text-[#526657] hover:text-[#141f17] cursor-pointer"
                              >
                                Cancelar
                              </button>
                            </div>

                            {/* Inline Type Switcher */}
                            <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-[#c5d1c8]">
                              {(
                                [
                                  {
                                    id: "expense_fixed",
                                    label: "Saída",
                                    color: "bg-[#ffebee] text-[#9e1c1c] border-[#ef9a9a]",
                                  },
                                  {
                                    id: "expense_daily",
                                    label: "Diário",
                                    color: "bg-[#fff3cd] text-[#7c5800] border-[#ffe69c]",
                                  },
                                  {
                                    id: "income",
                                    label: "Entrada",
                                    color: "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]",
                                  },
                                ] as const
                              ).map((opt) => {
                                const active = editType === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => setEditType(opt.id)}
                                    className={`py-1 px-2 rounded text-[11px] font-bold border transition-colors cursor-pointer ${
                                      active
                                        ? opt.color
                                        : "border-transparent text-[#4e6153] hover:bg-[#eff3f0]"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>

                            {/* Inline Value + (if Saída) Payment Method */}
                            <div className="flex items-center gap-2">
                              <div className="flex-1">
                                <label className="block text-[10px] font-bold text-[#2d6a3e] uppercase mb-0.5">
                                  Valor (R$)
                                </label>
                                <input
                                  type="text"
                                  inputMode="decimal"
                                  autoFocus
                                  value={editAmountStr}
                                  onChange={(e) =>
                                    setEditAmountStr(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveInlineEdit(tx);
                                    } else if (e.key === "Escape") {
                                      cancelInlineEdit();
                                    }
                                  }}
                                  placeholder="0,00"
                                  className="w-full h-9 px-2.5 rounded-lg border border-[#2d6a3e] bg-white text-right text-sm font-bold text-[#141f17] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
                                />
                              </div>

                              {editType === "expense_fixed" && (
                                <div>
                                  <label className="block text-[10px] font-bold text-[#526657] uppercase mb-0.5">
                                    Pagamento
                                  </label>
                                  <div className="grid grid-cols-2 gap-1 bg-white p-0.5 rounded-lg border border-[#c5d1c8] h-9 items-center">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditPaymentMethod("cash")
                                      }
                                      className={`h-7 px-2 rounded text-[11px] font-semibold cursor-pointer ${
                                        editPaymentMethod === "cash"
                                          ? "bg-[#2d6a3e] text-white"
                                          : "text-[#4e6153]"
                                      }`}
                                    >
                                      À Vista
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditPaymentMethod("credit_card")
                                      }
                                      className={`h-7 px-2 rounded text-[11px] font-semibold cursor-pointer ${
                                        editPaymentMethod === "credit_card"
                                          ? "bg-[#2d6a3e] text-white"
                                          : "text-[#4e6153]"
                                      }`}
                                    >
                                      Cartão
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Inline Description & Category (RN-05) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <div>
                                <label className="block text-[10px] font-bold text-[#526657] uppercase mb-0.5">
                                  Descrição
                                </label>
                                <input
                                  type="text"
                                  placeholder="Descrição (opcional)"
                                  value={editDescription}
                                  onChange={(e) =>
                                    setEditDescription(e.target.value)
                                  }
                                  onKeyDown={(e) => {
                                    if (e.key === "Enter") {
                                      e.preventDefault();
                                      handleSaveInlineEdit(tx);
                                    } else if (e.key === "Escape") {
                                      cancelInlineEdit();
                                    }
                                  }}
                                  className="w-full h-9 px-2.5 rounded-lg border border-[#c5d1c8] bg-white text-xs text-[#141f17]"
                                />
                              </div>

                              <div>
                                <label className="block text-[10px] font-bold text-[#526657] uppercase mb-0.5">
                                  Categoria
                                </label>
                                <select
                                  value={editCategory}
                                  onChange={(e) =>
                                    setEditCategory(e.target.value)
                                  }
                                  className="w-full h-9 px-2.5 rounded-lg border border-[#c5d1c8] bg-white text-xs text-[#141f17]"
                                >
                                  <option value="">Sem categoria</option>
                                  {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                      {cat}
                                    </option>
                                  ))}
                                </select>
                              </div>
                            </div>

                            {/* Inline Save / Cancel Actions */}
                            <div className="flex items-center justify-end gap-2 pt-1">
                              <button
                                type="button"
                                onClick={cancelInlineEdit}
                                className="h-8 px-3 rounded-lg border border-[#c5d1c8] bg-white hover:bg-[#eff3f0] text-xs font-semibold text-[#4e6153] cursor-pointer"
                              >
                                Cancelar
                              </button>
                              <button
                                type="button"
                                disabled={isSavingEdit}
                                onClick={() => handleSaveInlineEdit(tx)}
                                className="h-8 px-3.5 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                              >
                                {isSavingEdit ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <Check className="w-3.5 h-3.5" />
                                )}
                                <span>Salvar Alteração</span>
                              </button>
                            </div>
                          </div>
                        );
                      }

                      return (
                        <div
                          key={tx.id}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 transition-colors ${
                            tx.isSimulation
                              ? "bg-[#fdf6e2] border-[#d9c27e]"
                              : "bg-[#f8faf8] border-[#d5ded8] hover:border-[#b9c7bd]"
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase shrink-0 ${badgeStyle}`}
                              >
                                {badgeLabel}
                              </span>
                              <span className="text-xs font-semibold text-[#141f17] truncate">
                                {tx.description || tx.category || badgeLabel}
                                {tx.installmentTotal && tx.installmentTotal > 1
                                  ? ` (${tx.installmentCurrent}/${tx.installmentTotal})`
                                  : ""}
                              </span>
                              {tx.category && tx.description && (
                                <span className="px-1.5 py-0.2 rounded bg-white border border-[#d5ded8] text-[10px] font-medium text-[#526657] shrink-0">
                                  {tx.category}
                                </span>
                              )}
                              {tx.paymentMethod === "credit_card" && (
                                <span className="px-1.5 py-0.2 rounded bg-white border border-[#d5ded8] text-[10px] font-medium text-[#526657] shrink-0">
                                  Cartão
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            <span
                              className={`text-xs font-bold tabular-nums mr-1 ${
                                tx.type === "income"
                                  ? "text-[#1b5e20]"
                                  : "text-[#9e1c1c]"
                              }`}
                            >
                              {tx.type === "income" ? "+" : "-"}{" "}
                              {formatBRL(tx.amount)}
                            </span>

                            <button
                              type="button"
                              onClick={() => startInlineEdit(tx)}
                              className="h-7 px-2 rounded-md border border-[#cfd8d2] bg-white hover:bg-[#eff3f0] text-[#141f17] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Editar</span>
                            </button>

                            <button
                              type="button"
                              disabled={deletingTxId === tx.id}
                              onClick={() => handleDeleteTransaction(tx)}
                              className="h-7 px-2 rounded-md border border-[#ef9a9a] bg-[#ffebee] hover:bg-[#ffcdd2] text-[#9e1c1c] text-[11px] font-semibold flex items-center gap-1 cursor-pointer"
                            >
                              {deletingTxId === tx.id ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <Trash2 className="w-3 h-3" />
                              )}
                              <span>Excluir</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 2. FORMULÁRIO PARA ADICIONAR NOVA TRANSAÇÃO UM A UM (RN-01, RN-03, RN-04, RN-05) */}
              <form
                onSubmit={handleAddTransaction}
                className="pt-3 border-t border-[#d8e0da] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[#141f17]">
                    Adicionar nova transação
                  </span>
                </div>

                {/* Type Switcher Tabs: Saída | Diário | Entrada */}
                <div className="grid grid-cols-3 gap-1 bg-[#eff3f0] p-1 rounded-lg border border-[#d5ded8]">
                  {(
                    [
                      {
                        id: "expense_fixed",
                        label: "Saída",
                        icon: TrendingDown,
                        color: "text-[#9e1c1c]",
                      },
                      {
                        id: "expense_daily",
                        label: "Diário",
                        icon: Wallet,
                        color: "text-[#7c5800]",
                      },
                      {
                        id: "income",
                        label: "Entrada",
                        icon: TrendingUp,
                        color: "text-[#1b5e20]",
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
                        className={`relative py-1.5 px-2 rounded-md text-xs font-semibold flex items-center justify-center gap-1 cursor-pointer z-10 ${
                          active ? tab.color : "text-[#4e6153]"
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="launch-modal-tab-pill"
                            transition={{
                              type: "spring",
                              stiffness: 450,
                              damping: 34,
                            }}
                            className="absolute inset-0 bg-white rounded-md shadow-2xs -z-10"
                          />
                        )}
                        <Icon className="w-3.5 h-3.5" />
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                </div>

                {/* Valor (R$) - Full width without date inputs (RN-01) */}
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
                    autoFocus={!editingTxId}
                    placeholder="0,00"
                    value={amountStr}
                    onChange={(e) => setAmountStr(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-[#c5d1c8] bg-white text-right text-base font-bold text-[#141f17] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
                  />
                </div>

                {/* Cartão & Parcelas (apenas para Saída - RN-05 & RN-09) */}
                {txType === "expense_fixed" && (
                  <div className="p-2.5 rounded-lg bg-[#eff3f0] border border-[#d5ded8] space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <div className="grid grid-cols-2 gap-1 bg-white p-0.5 rounded-md border border-[#d5ded8]">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod("cash");
                            setInstallments(1);
                          }}
                          className={`py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
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
                          className={`py-1 px-2 rounded text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer ${
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
                        onChange={(e) =>
                          setInstallments(Number(e.target.value))
                        }
                        className="w-full h-8 px-2 rounded-md border border-[#c5d1c8] bg-white text-xs font-semibold text-[#141f17] disabled:opacity-50"
                      >
                        {Array.from({ length: 18 }, (_, i) => i + 1).map(
                          (n) => (
                            <option key={n} value={n}>
                              {n}x{" "}
                              {parsedAmount > 0
                                ? `(${formatBRL(parsedAmount / n)})`
                                : ""}
                            </option>
                          )
                        )}
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

                {/* Descrição & Categoria (Presentes em todos os tipos, inclusive Diário - RN-05) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
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

                {/* Simulação & Preview Fim do Mês */}
                <div className="p-2 rounded-lg bg-[#eff3f0] border border-[#d5ded8] flex items-center justify-between text-xs">
                  <button
                    type="button"
                    onClick={() => setIsSimulation(!isSimulation)}
                    className={`px-2 py-1 rounded border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                      isSimulation
                        ? "bg-[#fdf6e2] border-[#d9c27e] text-[#7c5800]"
                        : "bg-white border-[#cfd8d2] text-[#526657]"
                    }`}
                  >
                    <FlaskConical className="w-3 h-3" />
                    <span>
                      {isSimulation ? "Simulação Ativa" : "Simular"}
                    </span>
                  </button>

                  <div className="flex items-center gap-1.5">
                    <span className="text-[#526657]">Fim Mês:</span>
                    <span
                      className={`px-2 py-0.5 rounded font-bold ${afterLiquidity.bgClass}`}
                    >
                      {formatBRL(projectedAfter)}
                    </span>
                  </div>
                </div>

                <div className="pt-1 flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={closeLaunchModal}
                    className="h-9 px-4 rounded-lg border border-[#d5ded8] text-xs font-semibold text-[#4e6153] cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingNew}
                    className={`h-9 px-5 rounded-lg text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer ${
                      isSimulation
                        ? "bg-[#7c5800] hover:bg-[#5c4300]"
                        : "bg-[#2d6a3e] hover:bg-[#204f2d]"
                    }`}
                  >
                    {isSubmittingNew ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Plus className="w-3.5 h-3.5" />
                    )}
                    <span>{isSimulation ? "Simular" : "Adicionar"}</span>
                  </button>
                </div>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
