"use client";

import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search,
  Plus,
  FlaskConical,
  BarChart3,
  Table2,
  SlidersHorizontal,
  CalendarClock,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  CornerDownLeft,
} from "lucide-react";
import { useCashflowStore } from "@/store/use-cashflow-store";
import { formatShortDate } from "@/lib/format";

export function KeyboardShortcutsAndPalette() {
  const router = useRouter();
  const {
    settings,
    isLaunchModalOpen,
    selectedDayForDetail,
    isSettingsModalOpen,
    isRecurringModalOpen,
    isCommandPaletteOpen,
    setCommandPaletteOpen,
    openLaunchModal,
    setSelectedDayForDetail,
    setSettingsModalOpen,
    setRecurringModalOpen,
    closeAllModals,
    navigateMonths,
    resetToCurrentQuarter,
    discardAllStagedChanges,
    stagedTransactions,
    stagedOverrides,
  } = useCashflowStore();

  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const anyModalOpen =
    isLaunchModalOpen ||
    Boolean(selectedDayForDetail) ||
    isSettingsModalOpen ||
    isRecurringModalOpen ||
    isCommandPaletteOpen;

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const state = useCashflowStore.getState();
      const modalOpen =
        state.isLaunchModalOpen ||
        Boolean(state.selectedDayForDetail) ||
        state.isSettingsModalOpen ||
        state.isRecurringModalOpen ||
        state.isCommandPaletteOpen;

      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable);

      // 1. Escape always closes any open modal immediately
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        state.closeAllModals();
        return;
      }

      // 2. Ctrl + N (or Alt + N): open creation modal for Saída on current day (Hoje)
      if (
        ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "n") ||
        (e.altKey && e.key.toLowerCase() === "n")
      ) {
        e.preventDefault();
        e.stopPropagation();
        state.closeAllModals();
        state.openLaunchModal({
          date: state.settings.referenceToday,
          isSimulation: false,
          type: "expense_fixed",
        });
        return;
      }

      // 3. Ctrl + K (or Cmd + K): toggle Dev Command Palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        e.stopPropagation();
        if (state.isCommandPaletteOpen) {
          state.setCommandPaletteOpen(false);
        } else {
          state.closeAllModals();
          setQuery("");
          setSelectedIndex(0);
          state.setCommandPaletteOpen(true);
        }
        return;
      }

      // Single-key shortcuts when not typing in an input and no modal is open
      if (!isInputFocused && !modalOpen) {
        if (e.key.toLowerCase() === "n") {
          e.preventDefault();
          state.openLaunchModal({
            date: state.settings.referenceToday,
            isSimulation: false,
            type: "expense_fixed",
          });
        } else if (e.key.toLowerCase() === "s") {
          e.preventDefault();
          state.openLaunchModal({
            date: state.settings.referenceToday,
            isSimulation: true,
            type: "expense_fixed",
          });
        } else if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          state.setSelectedDayForDetail(
            state.settings.referenceToday,
            "expense_daily"
          );
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () =>
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, []);

  const commands = useMemo(
    () => [
      {
        id: "new-expense-today",
        label: `Nova Saída Hoje (${formatShortDate(settings.referenceToday)})`,
        shortcut: "Ctrl+N",
        icon: Plus,
        action: () => {
          closeAllModals();
          openLaunchModal({
            date: settings.referenceToday,
            isSimulation: false,
            type: "expense_fixed",
          });
        },
      },
      {
        id: "sim-expense-today",
        label: `Simular Compra em Memória (${formatShortDate(settings.referenceToday)})`,
        shortcut: "S",
        icon: FlaskConical,
        action: () => {
          closeAllModals();
          openLaunchModal({
            date: settings.referenceToday,
            isSimulation: true,
            type: "expense_fixed",
          });
        },
      },
      {
        id: "edit-daily-today",
        label: `Editar / Zerar Diário de Hoje (${formatShortDate(settings.referenceToday)})`,
        shortcut: "D",
        icon: SlidersHorizontal,
        action: () => {
          closeAllModals();
          setSelectedDayForDetail(settings.referenceToday, "expense_daily");
        },
      },
      {
        id: "go-grid",
        label: "Ir para Fluxo 3 Meses",
        shortcut: "G F",
        icon: Table2,
        action: () => {
          closeAllModals();
          router.push("/financeiro");
        },
      },
      {
        id: "go-insights",
        label: "Ir para Dashboard de Metas & Insights",
        shortcut: "G M",
        icon: BarChart3,
        action: () => {
          closeAllModals();
          router.push("/financeiro/insights");
        },
      },
      {
        id: "open-recurring",
        label: "Gerenciar Contas Fixas",
        shortcut: "F",
        icon: CalendarClock,
        action: () => {
          closeAllModals();
          setRecurringModalOpen(true);
        },
      },
      {
        id: "open-settings",
        label: "Configurações, Marco Zero & Fatura Cartão",
        shortcut: "C",
        icon: SlidersHorizontal,
        action: () => {
          closeAllModals();
          setSettingsModalOpen(true);
        },
      },
      {
        id: "prev-month",
        label: "Voltar 1 Mês no Trimestre",
        shortcut: "←",
        icon: ChevronLeft,
        action: () => {
          navigateMonths(-1);
          closeAllModals();
        },
      },
      {
        id: "next-month",
        label: "Avançar 1 Mês no Trimestre",
        shortcut: "→",
        icon: ChevronRight,
        action: () => {
          navigateMonths(1);
          closeAllModals();
        },
      },
      {
        id: "reset-quarter",
        label: "Centralizar no Trimestre Atual",
        shortcut: "H",
        icon: RotateCcw,
        action: () => {
          resetToCurrentQuarter();
          closeAllModals();
        },
      },
      ...(stagedTransactions.length + stagedOverrides.length > 0
        ? [
            {
              id: "discard-sims",
              label: "Descartar Todas as Simulações em Memória",
              shortcut: "Del",
              icon: RotateCcw,
              action: () => {
                discardAllStagedChanges();
                closeAllModals();
              },
            },
          ]
        : []),
    ],
    [
      settings.referenceToday,
      stagedTransactions.length,
      stagedOverrides.length,
      closeAllModals,
      openLaunchModal,
      setSelectedDayForDetail,
      router,
      setRecurringModalOpen,
      setSettingsModalOpen,
      navigateMonths,
      resetToCurrentQuarter,
      discardAllStagedChanges,
    ]
  );

  const filteredCommands = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(q));
  }, [commands, query]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  return (
    <AnimatePresence>
      {isCommandPaletteOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[14dvh] p-3">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 bg-black/45 backdrop-blur-[1px]"
            onClick={() => setCommandPaletteOpen(false)}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -8 }}
            transition={{ duration: 0.14, ease: "easeOut" }}
            className="relative w-full max-w-md bg-white rounded-xl shadow-2xl border border-[#cfd8d2] overflow-hidden z-10"
            role="dialog"
            aria-modal="true"
            aria-label="Command Palette"
          >
            <div className="px-3.5 py-2.5 border-b border-[#d8e0da] flex items-center gap-2.5">
              <Search className="w-4 h-4 text-[#526657] shrink-0" />
              <input
                type="text"
                autoFocus
                placeholder="Digite um comando..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                      filteredCommands.length > 0
                        ? (prev + 1) % filteredCommands.length
                        : 0
                    );
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setSelectedIndex((prev) =>
                      filteredCommands.length > 0
                        ? (prev - 1 + filteredCommands.length) %
                          filteredCommands.length
                        : 0
                    );
                  } else if (e.key === "Enter" && filteredCommands[selectedIndex]) {
                    e.preventDefault();
                    filteredCommands[selectedIndex].action();
                  }
                }}
                className="flex-1 text-xs font-medium text-[#141f17] bg-transparent focus:outline-none"
              />
              <kbd className="px-1.5 py-0.5 text-[10px] font-semibold bg-[#eff3f0] text-[#526657] border border-[#cfd8d2] rounded">
                Esc
              </kbd>
            </div>

            <div className="p-1.5 max-h-72 overflow-y-auto thin-scroll">
              {filteredCommands.length === 0 ? (
                <div className="py-6 text-center text-xs text-[#526657]">
                  Nenhum comando encontrado.
                </div>
              ) : (
                filteredCommands.map((cmd, idx) => {
                  const Icon = cmd.icon;
                  const active = idx === selectedIndex;
                  return (
                    <button
                      key={cmd.id}
                      type="button"
                      onMouseEnter={() => setSelectedIndex(idx)}
                      onClick={() => cmd.action()}
                      className={`w-full px-3 py-2 rounded-lg flex items-center justify-between text-xs transition-colors cursor-pointer ${
                        active
                          ? "bg-[#2d6a3e] text-white font-semibold"
                          : "text-[#141f17] hover:bg-[#eff3f0]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Icon
                          className={`w-3.5 h-3.5 ${
                            active ? "text-white" : "text-[#2d6a3e]"
                          }`}
                        />
                        <span>{cmd.label}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <kbd
                          className={`px-1.5 py-0.5 text-[10px] rounded border ${
                            active
                              ? "bg-white/15 border-white/25 text-white"
                              : "bg-[#eff3f0] border-[#cfd8d2] text-[#526657]"
                          }`}
                        >
                          {cmd.shortcut}
                        </kbd>
                        {active && <CornerDownLeft className="w-3 h-3 opacity-80" />}
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
