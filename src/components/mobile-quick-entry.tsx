"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  TrendingDown,
  TrendingUp,
  Wallet,
  Banknote,
  CreditCard,
  Check,
  Loader2,
  X,
  Trash2,
  Plus,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  calculateCreditCardInstallmentDates,
  classifyLiquidity,
  type CashflowSettings,
  type ComputedDayRow,
  type DailyOverrideRecord,
  type DayLineItem,
  type TransactionRecord,
} from "@/lib/cashflow-engine";
import {
  CATEGORIES,
  formatBRL,
  formatFullDate,
  formatShortDate,
} from "@/lib/format";
import {
  createRealTransactionAction,
  createTagAction,
  deleteTransactionAction,
  fetchInitialCashflowData,
  updateTransactionAction,
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

export function MobileQuickEntry({
  currentBalance,
  currentMonthEndBalance,
  settings,
  allDaysMap,
}: MobileQuickEntryProps) {
  const {
    stageDeleteTransaction,
    updateStagedSimulation,
    hydrateFromServer,
    setLocalTags,
  } = useCashflowStore();

  const availableTags = useMemo(
    () =>
      settings.tags && settings.tags.length > 0
        ? settings.tags
        : [...CATEGORIES],
    [settings.tags]
  );

  const amountInputRef = useRef<HTMLInputElement>(null);
  const date = settings.referenceToday;

  const [txType, setTxType] = useState<
    "expense_daily" | "expense_fixed" | "income"
  >("expense_daily");
  const [amountStr, setAmountStr] = useState("");
  const [paymentMethod, setPaymentMethod] = useState<"cash" | "credit_card">(
    "cash"
  );
  const [installments, setInstallments] = useState(1);
  const [category, setCategory] = useState("");
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Inline edit state for mobile transaction cards (RN-07)
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editType, setEditType] = useState<
    "expense_daily" | "expense_fixed" | "income"
  >("expense_daily");
  const [editAmountStr, setEditAmountStr] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [isSavingEdit, setIsSavingEdit] = useState(false);

  const [isCreatingTagNew, setIsCreatingTagNew] = useState(false);
  const [newTagInput, setNewTagInput] = useState("");
  const [isSavingTag, setIsSavingTag] = useState(false);

  async function handleQuickCreateTag(tagName: string) {
    const cleaned = tagName.trim();
    if (!cleaned) {
      toast.error("Informe o nome da tag.");
      return;
    }
    setIsSavingTag(true);
    try {
      const updated = await createTagAction(cleaned);
      setLocalTags(updated);
      setCategory(cleaned);
      setNewTagInput("");
      setIsCreatingTagNew(false);
      toast.success(`Tag "${cleaned}" cadastrada.`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cadastrar tag.");
    } finally {
      setIsSavingTag(false);
    }
  }

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

  const hasAmountInput = amountStr.trim().length > 0;
  const selectedDayRow = allDaysMap[date] ?? null;

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

  const todayLiquidity = classifyLiquidity(currentBalance);
  const endLiquidity = classifyLiquidity(currentMonthEndBalance);
  const selectedDayItems = selectedDayRow?.items ?? [];

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsedAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      amountInputRef.current?.focus();
      return;
    }

    const effectiveMethod =
      txType === "expense_fixed" ? paymentMethod : "cash";
    const effectiveInstallments =
      effectiveMethod === "credit_card" ? installments : 1;

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
      const label =
        txType === "income"
          ? "Entrada"
          : txType === "expense_daily"
          ? "Diário"
          : "Saída";
      toast.success(
        `${label} adicionado (${formatShortDate(date)}): ${formatBRL(
          parsedAmount
        )}`
      );
      setAmountStr("");
      setDescription("");
      setCategory("");
      setInstallments(1);
    } catch (err) {
      console.error(err);
      toast.error("Falha ao salvar.");
    } finally {
      setIsSubmitting(false);
    }
  }

  function startInlineEdit(item: DayLineItem) {
    setEditingItemId(item.id);
    setEditType(item.type);
    setEditAmountStr(String(item.amount).replace(".", ","));
    const isDefaultLabel =
      item.title === "Saída" ||
      item.title === "Entrada" ||
      item.title === "Diário" ||
      item.title === item.category;
    setEditDescription(isDefaultLabel ? "" : item.title);
    setEditCategory(item.category || "");
  }

  async function handleSaveInlineEdit(item: DayLineItem) {
    if (parsedEditAmount <= 0) {
      toast.error("Informe um valor maior que zero.");
      return;
    }

    if (item.isInMemory || item.id.startsWith("sim_")) {
      updateStagedSimulation(item.id, {
        type: editType,
        amount: parsedEditAmount,
        description: editDescription.trim() || null,
        category: editCategory || null,
      });
      setEditingItemId(null);
      toast.success("Simulação atualizada.");
      return;
    }

    setIsSavingEdit(true);
    try {
      await updateTransactionAction({
        id: item.id,
        type: editType,
        amount: parsedEditAmount,
        description: editDescription.trim() || null,
        category: editCategory || null,
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      setEditingItemId(null);
      toast.success("Transação atualizada.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar.");
    } finally {
      setIsSavingEdit(false);
    }
  }

  async function handleDeleteDayItem(id: string, isInMemory?: boolean) {
    if (isInMemory || id.startsWith("sim_")) {
      stageDeleteTransaction(id);
      if (editingItemId === id) setEditingItemId(null);
      toast.info("Simulação removida.");
      return;
    }
    setDeletingId(id);
    try {
      await deleteTransactionAction(id);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      if (editingItemId === id) setEditingItemId(null);
      toast.success("Transação excluída.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2.5">
      {/* 1. Ultra-compact Balance Bar */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] px-3 py-2 flex items-center justify-between text-xs tabular-nums">
        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: todayLiquidity.hex }}
          />
          <span className="text-[#526657]">Hoje:</span>
          <span className="font-bold text-[#141f17]">
            {formatBRL(currentBalance)}
          </span>
        </div>

        <span className="w-px h-3.5 bg-[#d8e0da]" />

        <div className="flex items-center gap-1.5">
          <span
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: endLiquidity.hex }}
          />
          <span className="text-[#526657]">Fim Mês:</span>
          <span className="font-bold text-[#141f17]">
            {formatBRL(currentMonthEndBalance)}
          </span>
        </div>
      </div>

      {/* 2. Minimalist Launch Card (Individual transactions with Valor, Descrição, Categoria - RN-03, RN-04, RN-05) */}
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-xl border border-[#cfd8d2] p-3 space-y-2.5"
      >
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-[#141f17]">
            Adicionar transação • Hoje ({formatFullDate(date)})
          </span>
        </div>

        {/* Type Selector: Diário | Saída | Entrada */}
        <div className="grid grid-cols-3 gap-1 bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
          {(
            [
              {
                id: "expense_daily",
                label: "Diário",
                icon: Wallet,
                color: "text-[#7c5800]",
              },
              {
                id: "expense_fixed",
                label: "Saída",
                icon: TrendingDown,
                color: "text-[#9e1c1c]",
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
                className={`h-9 rounded-md text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors ${
                  active
                    ? `bg-white shadow-2xs ${tab.color}`
                    : "text-[#4e6153]"
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Amount Input + Add Button */}
        <div className="flex items-center gap-2">
          <div className="flex-1 flex items-center rounded-xl border border-[#c5d1c8] focus-within:border-[#2d6a3e] bg-[#f8faf8] focus-within:bg-white px-3 h-12">
            <span className="text-sm font-bold text-[#526657] mr-1.5">R$</span>
            <input
              ref={amountInputRef}
              type="text"
              inputMode="decimal"
              placeholder="0,00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              className="w-full bg-transparent text-xl font-bold text-[#141f17] tabular-nums focus:outline-none"
            />
            {hasAmountInput && (
              <button
                type="button"
                onClick={() => setAmountStr("")}
                className="text-[#526657] p-1"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-12 px-4 rounded-xl bg-[#2d6a3e] active:bg-[#204f2d] text-white text-xs font-bold flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            {isSubmitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            <span>Adicionar</span>
          </button>
        </div>

        {/* Properties: Descrição & Categoria (Available for Diário, Saída, and Entrada - RN-05) */}
        <div className="space-y-2 pt-1">
          {txType === "expense_fixed" && (
            <div className="flex items-center gap-1.5">
              <div className="grid grid-cols-2 gap-1 bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8] flex-1">
                <button
                  type="button"
                  onClick={() => {
                    setPaymentMethod("cash");
                    setInstallments(1);
                  }}
                  className={`h-7 rounded text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                    paymentMethod === "cash"
                      ? "bg-[#2d6a3e] text-white"
                      : "text-[#4e6153]"
                  }`}
                >
                  <Banknote className="w-3 h-3" />
                  <span>À Vista / Pix</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPaymentMethod("credit_card")}
                  className={`h-7 rounded text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                    paymentMethod === "credit_card"
                      ? "bg-[#2d6a3e] text-white"
                      : "text-[#4e6153]"
                  }`}
                >
                  <CreditCard className="w-3 h-3" />
                  <span>Cartão</span>
                </button>
              </div>

              {paymentMethod === "credit_card" && (
                <select
                  value={installments}
                  onChange={(e) => setInstallments(Number(e.target.value))}
                  className="h-8 px-2 rounded-lg border border-[#c5d1c8] bg-white text-xs font-bold"
                >
                  {Array.from({ length: 12 }, (_, i) => i + 1).map((n) => (
                    <option key={n} value={n}>
                      {n}x
                    </option>
                  ))}
                </select>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            <input
              type="text"
              placeholder="Descrição (opcional)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-xs text-[#141f17]"
            />
            {isCreatingTagNew ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  autoFocus
                  placeholder="Nova tag..."
                  value={newTagInput}
                  onChange={(e) => setNewTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleQuickCreateTag(newTagInput);
                    }
                  }}
                  className="flex-1 h-9 px-2.5 rounded-lg border border-[#2d6a3e] bg-white text-xs text-[#141f17]"
                />
                <button
                  type="button"
                  disabled={isSavingTag}
                  onClick={() => handleQuickCreateTag(newTagInput)}
                  className="h-9 px-2.5 rounded-lg bg-[#2d6a3e] text-white text-xs font-bold cursor-pointer"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setIsCreatingTagNew(false)}
                  className="h-9 px-2 rounded-lg border border-[#c5d1c8] text-xs text-[#526657] cursor-pointer"
                >
                  ✕
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1">
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="min-w-0 flex-1 h-9 px-2 rounded-lg border border-[#c5d1c8] bg-white text-xs text-[#141f17]"
                >
                  <option value="">Tag (opcional)</option>
                  {availableTags.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setIsCreatingTagNew(true)}
                  className="h-9 px-2.5 rounded-lg border border-[#c5d1c8] bg-[#f8faf8] text-xs font-bold text-[#2d6a3e] flex items-center gap-0.5 shrink-0 cursor-pointer"
                  title="Cadastrar nova tag"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tag</span>
                </button>
              </div>
            )}
          </div>

          {txType === "expense_fixed" && paymentMethod === "credit_card" && (
            <div className="text-[11px] text-[#2d6a3e] font-semibold">
              1º vencimento no cartão: {formatFullDate(installmentDates[0])}
            </div>
          )}
        </div>
      </form>

      {/* 3. Transações do Dia com Edição Inline (RN-04, RN-07) */}
      <section className="bg-white rounded-xl border border-[#cfd8d2] overflow-hidden">
        <div className="px-3 py-2 bg-[#eff3f0] border-b border-[#d8e0da] flex items-center justify-between">
          <span className="text-xs font-bold text-[#141f17]">
            Transações em {formatFullDate(date)} ({selectedDayItems.length})
          </span>
          <span className="text-[11px] text-[#526657]">
            Edição rápida no item
          </span>
        </div>

        {selectedDayItems.length === 0 ? (
          <div className="p-4 text-center text-xs text-[#526657]">
            Nenhuma transação lançada hoje.
          </div>
        ) : (
          <div className="divide-y divide-[#e4ebe6]">
            {selectedDayItems.map((item) => {
              const isEditingThis = editingItemId === item.id;
              const badgeStyle =
                item.type === "income"
                  ? "bg-[#e8f5e9] text-[#1b5e20]"
                  : item.type === "expense_daily"
                  ? "bg-[#fff3cd] text-[#7c5800]"
                  : "bg-[#ffebee] text-[#9e1c1c]";
              const badgeLabel =
                item.type === "income"
                  ? "Entrada"
                  : item.type === "expense_daily"
                  ? "Diário"
                  : "Saída";

              if (isEditingThis) {
                return (
                  <div
                    key={item.id}
                    className="p-3 bg-[#eef6f0] border-l-4 border-l-[#2d6a3e] space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#1b5e20] flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#2d6a3e] animate-pulse" />
                        <span>Editando: {item.title}</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingItemId(null)}
                        className="text-[11px] font-semibold text-[#526657]"
                      >
                        Cancelar
                      </button>
                    </div>

                    <div className="grid grid-cols-3 gap-1 bg-white p-1 rounded-lg border border-[#c5d1c8]">
                      {(
                        [
                          { id: "expense_fixed", label: "Saída" },
                          { id: "expense_daily", label: "Diário" },
                          { id: "income", label: "Entrada" },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => setEditType(opt.id)}
                          className={`py-1 rounded text-[11px] font-bold ${
                            editType === opt.id
                              ? "bg-[#2d6a3e] text-white"
                              : "text-[#4e6153]"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>

                    <div className="grid grid-cols-2 gap-1.5">
                      <input
                        type="text"
                        inputMode="decimal"
                        autoFocus
                        value={editAmountStr}
                        onChange={(e) => setEditAmountStr(e.target.value)}
                        placeholder="Valor (R$)"
                        className="h-9 px-2.5 rounded-lg border border-[#2d6a3e] bg-white text-right text-sm font-bold"
                      />
                      <input
                        type="text"
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        placeholder="Descrição"
                        className="h-9 px-2.5 rounded-lg border border-[#c5d1c8] bg-white text-xs"
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <select
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        className="h-8 px-2 rounded-lg border border-[#c5d1c8] bg-white text-xs flex-1"
                      >
                        <option value="">Sem tag</option>
                        {availableTags.map((cat) => (
                          <option key={cat} value={cat}>
                            {cat}
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        disabled={isSavingEdit}
                        onClick={() => handleSaveInlineEdit(item)}
                        className="h-8 px-3 rounded-lg bg-[#2d6a3e] text-white text-xs font-bold flex items-center gap-1"
                      >
                        {isSavingEdit ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Check className="w-3.5 h-3.5" />
                        )}
                        <span>Salvar</span>
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={item.id}
                  className="px-3 py-2.5 flex items-center justify-between gap-2"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span
                        className={`px-1.5 py-0.2 rounded text-[10px] font-bold uppercase ${badgeStyle}`}
                      >
                        {badgeLabel}
                      </span>
                      <span className="text-xs font-semibold text-[#141f17] truncate">
                        {item.title}
                        {item.installmentLabel
                          ? ` (${item.installmentLabel})`
                          : ""}
                      </span>
                    </div>
                    {(item.category || item.source === "recurring") && (
                      <div className="text-[11px] text-[#526657] flex items-center gap-1.5 mt-0.5">
                        {item.category && <span>{item.category}</span>}
                        {item.source === "recurring" && <span>• Fixo</span>}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span
                      className={`text-xs font-bold tabular-nums ${
                        item.type === "income"
                          ? "text-[#1b5e20]"
                          : "text-[#9e1c1c]"
                      }`}
                    >
                      {item.type === "income" ? "+" : "-"}{" "}
                      {formatBRL(item.amount)}
                    </span>

                    {item.source !== "recurring" && (
                      <>
                        <button
                          type="button"
                          onClick={() => startInlineEdit(item)}
                          className="w-7 h-7 rounded-lg border border-[#d5ded8] bg-[#f8faf8] flex items-center justify-center text-[#4e6153] cursor-pointer"
                          aria-label="Editar transação"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          disabled={deletingId === item.id}
                          onClick={() =>
                            handleDeleteDayItem(item.id, item.isInMemory)
                          }
                          className="w-7 h-7 rounded-lg border border-[#ef9a9a] bg-[#ffebee] flex items-center justify-center text-[#9e1c1c] cursor-pointer"
                          aria-label="Excluir transação"
                        >
                          {deletingId === item.id ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
