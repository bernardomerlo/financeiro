"use client";

import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  X,
  SlidersHorizontal,
  CalendarClock,
  Plus,
  Trash2,
  Check,
  Loader2,
  Tag,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  updateSettingsAction,
  upsertRecurringRuleAction,
  deleteRecurringRuleAction,
  fetchInitialCashflowData,
  createTagAction,
  deleteTagAction,
} from "@/app/actions";
import { CATEGORIES, formatBRL, formatFullDate } from "@/lib/format";

export function SettingsAndRecurringModals() {
  const {
    settings,
    recurringRules,
    isSettingsModalOpen,
    setSettingsModalOpen,
    isRecurringModalOpen,
    setRecurringModalOpen,
    hydrateFromServer,
    setLocalTags,
  } = useCashflowStore();

  const availableTags =
    settings.tags && settings.tags.length > 0 ? settings.tags : [...CATEGORIES];

  const [newTagInput, setNewTagInput] = useState("");
  const [isSavingTag, setIsSavingTag] = useState(false);

  async function handleAddTag() {
    const cleaned = newTagInput.trim();
    if (!cleaned) {
      toast.error("Informe o nome da tag.");
      return;
    }
    setIsSavingTag(true);
    try {
      const updated = await createTagAction(cleaned);
      setLocalTags(updated);
      setNewTagInput("");
      toast.success(`Tag "${cleaned}" cadastrada.`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao cadastrar tag.");
    } finally {
      setIsSavingTag(false);
    }
  }

  async function handleRemoveTag(tagToRemove: string) {
    setIsSavingTag(true);
    try {
      const updated = await deleteTagAction(tagToRemove);
      setLocalTags(updated);
      toast.info(`Tag "${tagToRemove}" removida.`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao remover tag.");
    } finally {
      setIsSavingTag(false);
    }
  }

  const [initialBalance, setInitialBalance] = useState(String(settings.initialBalance));
  const [initialBalanceDate, setInitialBalanceDate] = useState(settings.initialBalanceDate);
  const [dailyTarget, setDailyTarget] = useState(String(settings.dailySpendingTarget));
  const [closingDay, setClosingDay] = useState(String(settings.creditCardClosingDay));
  const [dueDay, setDueDay] = useState(String(settings.creditCardDueDay));
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  const [recTitle, setRecTitle] = useState("");
  const [recAmount, setRecAmount] = useState("");
  const [recType, setRecType] = useState<"income" | "expense_fixed">("expense_fixed");
  const [recCategory, setRecCategory] = useState("Moradia");
  const [recDay, setRecDay] = useState("5");
  const [isSavingRec, setIsSavingRec] = useState(false);

  useEffect(() => {
    setInitialBalance(String(settings.initialBalance));
    setInitialBalanceDate(settings.initialBalanceDate);
    setDailyTarget(String(settings.dailySpendingTarget));
    setClosingDay(String(settings.creditCardClosingDay));
    setDueDay(String(settings.creditCardDueDay));
  }, [settings, isSettingsModalOpen]);

  async function handleSaveSettings(e: React.FormEvent) {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      await updateSettingsAction({
        initialBalance: parseFloat(initialBalance.replace(",", ".")) || 0,
        initialBalanceDate,
        dailySpendingTarget: parseFloat(dailyTarget.replace(",", ".")) || 50,
        creditCardClosingDay: Math.min(31, Math.max(1, parseInt(closingDay) || 20)),
        creditCardDueDay: Math.min(31, Math.max(1, parseInt(dueDay) || 27)),
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.success("Configurações salvas.");
      setSettingsModalOpen(false);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setIsSavingSettings(false);
    }
  }

  async function handleAddRecurring(e: React.FormEvent) {
    e.preventDefault();
    const amt = parseFloat(recAmount.replace(",", "."));
    if (!recTitle.trim() || isNaN(amt) || amt <= 0) {
      toast.error("Preencha descrição e valor.");
      return;
    }
    setIsSavingRec(true);
    try {
      await upsertRecurringRuleAction({
        title: recTitle.trim(),
        amount: amt,
        type: recType,
        category: recCategory,
        dayOfMonth: Math.min(31, Math.max(1, parseInt(recDay) || 1)),
      });
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      setRecTitle("");
      setRecAmount("");
      toast.success("Fixo salvo.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setIsSavingRec(false);
    }
  }

  async function handleDeleteRecurring(id: string) {
    setIsSavingRec(true);
    try {
      await deleteRecurringRuleAction(id);
      const fresh = await fetchInitialCashflowData();
      hydrateFromServer(fresh);
      toast.info("Removido.");
    } catch (err) {
      console.error(err);
      toast.error("Erro.");
    } finally {
      setIsSavingRec(false);
    }
  }

  return (
    <>
      <AnimatePresence>
        {isSettingsModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
              onClick={() => setSettingsModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 28 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="relative bg-white w-full lg:max-w-md rounded-t-2xl lg:rounded-xl shadow-2xl border-t lg:border border-[#cfd8d2] overflow-hidden z-10 pb-safe"
              role="dialog"
              aria-modal="true"
              aria-label="Configurações"
            >
              <div className="flex lg:hidden justify-center pt-2 pb-1 bg-[#eff3f0]">
                <span className="w-10 h-1 rounded-full bg-[#b9c7bd]" />
              </div>

              <div className="px-4 py-3 border-b border-[#d8e0da] flex items-center justify-between bg-[#eff3f0]">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#2d6a3e]" />
                  <h3 className="text-sm font-bold text-[#141f17]">Configurações</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-white text-[#526657] border border-[#cfd8d2] rounded">
                    Esc
                  </kbd>
                  <button
                    type="button"
                    onClick={() => setSettingsModalOpen(false)}
                    className="w-9 h-9 lg:w-auto lg:h-auto lg:p-1 rounded-lg lg:rounded hover:bg-white text-[#526657] flex items-center justify-center cursor-pointer"
                    aria-label="Fechar configurações"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveSettings} className="p-4 space-y-3.5 text-xs max-h-[80dvh] overflow-y-auto thin-scroll">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#526657] mb-1">
                      Saldo Inicial (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={initialBalance}
                      onChange={(e) => setInitialBalance(e.target.value)}
                      className="w-full h-11 lg:h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-base lg:text-xs font-bold"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#526657] mb-1">
                      Data Base
                    </label>
                    <input
                      type="date"
                      required
                      value={initialBalanceDate}
                      onChange={(e) => setInitialBalanceDate(e.target.value)}
                      className="w-full h-11 lg:h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-base lg:text-xs"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#526657] mb-1">
                      Meta Diária (R$)
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      value={dailyTarget}
                      onChange={(e) => setDailyTarget(e.target.value)}
                      className="w-full h-11 lg:h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-base lg:text-xs font-bold text-[#2d6a3e]"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#526657] mb-1">
                      Dia Atual (Automático)
                    </label>
                    <div className="w-full h-11 lg:h-9 px-2.5 rounded-lg border border-[#d5ded8] bg-[#eff3f0] flex items-center justify-between text-[#141f17] font-semibold">
                      <span>{formatFullDate(settings.referenceToday)}</span>
                      <span className="text-[10px] font-bold text-[#2d6a3e] bg-[#e8f5e9] border border-[#a5d6a7] px-1.5 py-0.5 rounded">
                        Dinâmico
                      </span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-[#526657] mb-1">
                      Fechamento Cartão (Dia)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      required
                      value={closingDay}
                      onChange={(e) => setClosingDay(e.target.value)}
                      className="w-full h-11 lg:h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-base lg:text-xs"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold text-[#526657] mb-1">
                      Vencimento Fatura (Dia)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      required
                      value={dueDay}
                      onChange={(e) => setDueDay(e.target.value)}
                      className="w-full h-11 lg:h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-base lg:text-xs"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t border-[#e4ebe6] space-y-2">
                  <label className="block font-bold text-[#141f17] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-[#2d6a3e]" />
                    <span>Tags / Categorias ({availableTags.length})</span>
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={newTagInput}
                      onChange={(e) => setNewTagInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          handleAddTag();
                        }
                      }}
                      placeholder="Nova tag (ex.: iFood, Mercado, Pet...)"
                      className="flex-1 h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-xs"
                    />
                    <button
                      type="button"
                      disabled={isSavingTag || !newTagInput.trim()}
                      onClick={handleAddTag}
                      className="h-9 px-3 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                    >
                      {isSavingTag ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Plus className="w-3.5 h-3.5" />
                      )}
                      <span>Cadastrar</span>
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {availableTags.map((tag) => (
                      <span
                        key={tag}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#eff3f0] border border-[#d5ded8] text-[11px] font-semibold text-[#141f17]"
                      >
                        <span>{tag}</span>
                        <button
                          type="button"
                          disabled={isSavingTag}
                          onClick={() => handleRemoveTag(tag)}
                          className="text-[#526657] hover:text-[#9e1c1c] cursor-pointer"
                          title={`Remover tag ${tag}`}
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setSettingsModalOpen(false)}
                    className="min-h-[44px] lg:min-h-0 lg:h-9 px-4 rounded-lg border border-[#d5ded8] text-[#4e6153] font-semibold cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingSettings}
                    className="min-h-[44px] lg:min-h-0 lg:h-9 px-4 rounded-lg bg-[#2d6a3e] text-white font-semibold flex items-center gap-1.5 cursor-pointer"
                  >
                    {isSavingSettings ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    <span>Salvar</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isRecurringModalOpen && (
          <div className="fixed inset-0 z-50 flex items-end lg:items-center justify-center p-0 lg:p-3">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.12 }}
              className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
              onClick={() => setRecurringModalOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: 28 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 28 }}
              transition={{ duration: 0.16, ease: "easeOut" }}
              className="relative bg-white w-full lg:max-w-lg rounded-t-2xl lg:rounded-xl shadow-2xl border-t lg:border border-[#cfd8d2] overflow-hidden z-10 pb-safe"
              role="dialog"
              aria-modal="true"
              aria-label="Contas Fixas"
            >
              <div className="flex lg:hidden justify-center pt-2 pb-1 bg-[#eff3f0]">
                <span className="w-10 h-1 rounded-full bg-[#b9c7bd]" />
              </div>

              <div className="px-4 py-3 border-b border-[#d8e0da] flex items-center justify-between bg-[#eff3f0]">
                <div className="flex items-center gap-2">
                  <CalendarClock className="w-4 h-4 text-[#2d6a3e]" />
                  <h3 className="text-sm font-bold text-[#141f17]">Contas Fixas</h3>
                </div>
                <div className="flex items-center gap-1.5">
                  <kbd className="hidden lg:inline-block px-1.5 py-0.5 text-[10px] font-semibold bg-white text-[#526657] border border-[#cfd8d2] rounded">
                    Esc
                  </kbd>
                  <button
                    type="button"
                    onClick={() => setRecurringModalOpen(false)}
                    className="w-9 h-9 lg:w-auto lg:h-auto lg:p-1 rounded-lg lg:rounded hover:bg-white text-[#526657] flex items-center justify-center cursor-pointer"
                    aria-label="Fechar contas fixas"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="p-4 space-y-4 max-h-[82dvh] lg:max-h-[80dvh] overflow-y-auto thin-scroll text-xs">
                <form
                  onSubmit={handleAddRecurring}
                  className="p-3 rounded-lg bg-[#eff3f0] border border-[#d5ded8] space-y-2.5"
                >
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div className="sm:col-span-2">
                      <input
                        type="text"
                        required
                        placeholder="Descrição"
                        value={recTitle}
                        onChange={(e) => setRecTitle(e.target.value)}
                        className="w-full h-11 lg:h-8 px-2.5 rounded-lg lg:rounded border border-[#c5d1c8] bg-white text-base lg:text-xs"
                      />
                    </div>
                    <div>
                      <input
                        type="text"
                        inputMode="decimal"
                        required
                        placeholder="Valor (R$)"
                        value={recAmount}
                        onChange={(e) => setRecAmount(e.target.value)}
                        className="w-full h-11 lg:h-8 px-2.5 rounded-lg lg:rounded border border-[#c5d1c8] bg-white text-base lg:text-xs font-semibold"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <select
                      value={recType}
                      onChange={(e) =>
                        setRecType(e.target.value as "income" | "expense_fixed")
                      }
                      className="w-full h-11 lg:h-8 px-2 rounded-lg lg:rounded border border-[#c5d1c8] bg-white text-base lg:text-xs"
                    >
                      <option value="expense_fixed">Saída (-)</option>
                      <option value="income">Entrada (+)</option>
                    </select>
                    <input
                      type="number"
                      min={1}
                      max={31}
                      required
                      placeholder="Dia (1-31)"
                      value={recDay}
                      onChange={(e) => setRecDay(e.target.value)}
                      className="w-full h-11 lg:h-8 px-2.5 rounded-lg lg:rounded border border-[#c5d1c8] bg-white text-base lg:text-xs"
                    />
                    <select
                      value={recCategory}
                      onChange={(e) => setRecCategory(e.target.value)}
                      className="w-full h-11 lg:h-8 px-2 rounded-lg lg:rounded border border-[#c5d1c8] bg-white text-base lg:text-xs"
                    >
                      {availableTags.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSavingRec}
                      className="w-full sm:w-auto min-h-[44px] lg:min-h-0 lg:h-8 px-3 rounded-lg lg:rounded bg-[#2d6a3e] text-white font-semibold flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Adicionar</span>
                    </button>
                  </div>
                </form>

                <div className="space-y-1.5">
                  {recurringRules.map((rule) => (
                    <div
                      key={rule.id}
                      className="p-2.5 rounded-lg border border-[#d5ded8] flex items-center justify-between gap-2"
                    >
                      <div className="flex items-center gap-2 font-semibold text-[#141f17] min-w-0">
                        <span className="truncate">{rule.title}</span>
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-[#eff3f0] border border-[#d5ded8] shrink-0">
                          Dia {String(rule.dayOfMonth).padStart(2, "0")}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`font-bold ${
                            rule.type === "income"
                              ? "text-[#1b5e20]"
                              : "text-[#9e1c1c]"
                          }`}
                        >
                          {rule.type === "income" ? "+" : "-"} {formatBRL(rule.amount)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteRecurring(rule.id)}
                          className="w-9 h-9 lg:w-auto lg:h-auto lg:p-1 rounded-lg lg:rounded hover:bg-[#ffebee] text-[#9e1c1c] flex items-center justify-center cursor-pointer"
                          aria-label="Excluir conta fixa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
