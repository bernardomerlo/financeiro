"use client";

import { create } from "zustand";
import {
  addMonthsToYearMonth,
  calculateCreditCardInstallmentDates,
  getLocalTodayIsoDate,
  getTodayIsoDate,
  type CashflowSettings,
  type DailyOverrideRecord,
  type RecurringOccurrenceRecord,
  type RecurringRuleRecord,
  type TransactionRecord,
} from "@/lib/cashflow-engine";
import { CATEGORIES } from "@/lib/format";

interface CashflowState {
  isHydrated: boolean;
  settings: CashflowSettings;
  centerYearMonth: string; // e.g., '2026-11' -> shows ['2026-10', '2026-11', '2026-12']
  dbTransactions: TransactionRecord[];
  dbDailyOverrides: DailyOverrideRecord[];
  recurringRules: RecurringRuleRecord[];
  recurringOccurrences: RecurringOccurrenceRecord[];

  // In-memory simulation scratchpad
  stagedTransactions: TransactionRecord[];
  stagedOverrides: DailyOverrideRecord[];
  stagedDeletedTxIds: string[];
  includeSimulations: boolean;

  // UI Modals state
  isLaunchModalOpen: boolean;
  launchModalPresetDate: string | null;
  launchModalPresetSimulation: boolean;
  launchModalPresetType: "income" | "expense_fixed" | "expense_daily";
  selectedDayForDetail: string | null;
  selectedColumnForDetail: "income" | "expense_fixed" | "expense_daily";
  isSettingsModalOpen: boolean;
  isRecurringModalOpen: boolean;
  isCommandPaletteOpen: boolean;

  // Actions
  hydrateFromServer: (data: {
    settings: CashflowSettings;
    transactions: TransactionRecord[];
    dailyOverrides: DailyOverrideRecord[];
    recurringRules: RecurringRuleRecord[];
    recurringOccurrences: RecurringOccurrenceRecord[];
  }) => void;
  navigateMonths: (delta: number) => void;
  resetToCurrentQuarter: () => void;
  syncCurrentDate: (todayIso: string) => void;
  toggleIncludeSimulations: () => void;

  // In-memory simulation mutations
  addStagedSimulation: (payload: {
    date: string;
    type: "income" | "expense_fixed" | "expense_daily";
    amount: number;
    description?: string;
    category?: string;
    paymentMethod: "cash" | "credit_card";
    installments: number;
  }) => void;
  updateStagedSimulation: (
    id: string,
    patch: {
      type: "income" | "expense_fixed" | "expense_daily";
      amount: number;
      description?: string | null;
      category?: string | null;
      paymentMethod?: "cash" | "credit_card";
    }
  ) => void;
  stageDailyOverride: (date: string, amount: number, note?: string) => void;
  stageDeleteTransaction: (id: string) => void;
  removeStagedSimulation: (id: string) => void;
  discardAllStagedChanges: () => void;
  applyTemporaryDailyTargetInMemory: (newTarget: number, startDate: string, endDate: string) => void;

  // Direct DB state sync helpers
  moveDayFieldOptimistic: (
    sourceDate: string,
    targetDate: string,
    fieldType: "income" | "expense_fixed" | "expense_daily",
    targetFieldType?: "income" | "expense_fixed" | "expense_daily"
  ) => void;
  addCommittedTransactions: (txs: TransactionRecord[]) => void;
  removeCommittedTransaction: (id: string) => void;
  upsertCommittedDailyOverride: (override: DailyOverrideRecord) => void;
  removeCommittedDailyOverride: (date: string) => void;
  updateLocalSettings: (partial: Partial<CashflowSettings>) => void;
  setLocalTags: (tags: string[]) => void;
  upsertLocalRecurringRule: (rule: RecurringRuleRecord) => void;
  removeLocalRecurringRule: (id: string) => void;
  upsertLocalRecurringOccurrence: (occ: RecurringOccurrenceRecord) => void;

  // Modal triggers
  openLaunchModal: (opts?: {
    date?: string;
    isSimulation?: boolean;
    type?: "income" | "expense_fixed" | "expense_daily";
  }) => void;
  closeLaunchModal: () => void;
  setSelectedDayForDetail: (
    date: string | null,
    column?: "income" | "expense_fixed" | "expense_daily"
  ) => void;
  setSettingsModalOpen: (open: boolean) => void;
  setRecurringModalOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  closeAllModals: () => void;
}

const initialTodayIso = getTodayIsoDate();

export const useCashflowStore = create<CashflowState>((set, get) => ({
  isHydrated: false,
  settings: {
    initialBalance: 6095.16,
    initialBalanceDate: "2026-09-30",
    dailySpendingTarget: 50.0,
    creditCardClosingDay: 20,
    creditCardDueDay: 27,
    referenceToday: initialTodayIso,
    tags: [...CATEGORIES],
  },
  centerYearMonth: initialTodayIso.slice(0, 7),
  dbTransactions: [],
  dbDailyOverrides: [],
  recurringRules: [],
  recurringOccurrences: [],

  stagedTransactions: [],
  stagedOverrides: [],
  stagedDeletedTxIds: [],
  includeSimulations: true,

  isLaunchModalOpen: false,
  launchModalPresetDate: null,
  launchModalPresetSimulation: false,
  launchModalPresetType: "expense_fixed",
  selectedDayForDetail: null,
  selectedColumnForDetail: "expense_daily",
  isSettingsModalOpen: false,
  isRecurringModalOpen: false,
  isCommandPaletteOpen: false,

  hydrateFromServer: (data) =>
    set((state) => {
      const dynamicToday =
        typeof window !== "undefined"
          ? getLocalTodayIsoDate()
          : data.settings.referenceToday;

      return {
        isHydrated: true,
        settings: {
          ...data.settings,
          referenceToday: dynamicToday,
        },
        centerYearMonth: state.isHydrated
          ? state.centerYearMonth
          : dynamicToday.slice(0, 7),
        dbTransactions: data.transactions,
        dbDailyOverrides: data.dailyOverrides,
        recurringRules: data.recurringRules,
        recurringOccurrences: data.recurringOccurrences,
      };
    }),

  navigateMonths: (delta) =>
    set((state) => ({
      centerYearMonth: addMonthsToYearMonth(state.centerYearMonth, delta),
    })),

  resetToCurrentQuarter: () =>
    set((state) => ({
      centerYearMonth: state.settings.referenceToday.slice(0, 7),
    })),

  syncCurrentDate: (todayIso) =>
    set((state) => {
      if (state.settings.referenceToday === todayIso) {
        return state;
      }
      const prevTodayYM = state.settings.referenceToday.slice(0, 7);
      const nextTodayYM = todayIso.slice(0, 7);
      return {
        settings: {
          ...state.settings,
          referenceToday: todayIso,
        },
        centerYearMonth:
          state.centerYearMonth === prevTodayYM
            ? nextTodayYM
            : state.centerYearMonth,
      };
    }),

  toggleIncludeSimulations: () =>
    set((state) => ({
      includeSimulations: !state.includeSimulations,
    })),

  addStagedSimulation: (payload) => {
    const { settings } = get();
    const installmentsCount =
      payload.paymentMethod === "credit_card" ? Math.max(1, payload.installments) : 1;
    const targetDates =
      payload.paymentMethod === "credit_card"
        ? calculateCreditCardInstallmentDates(
            payload.date,
            installmentsCount,
            settings.creditCardClosingDay,
            settings.creditCardDueDay
          )
        : [payload.date];

    const perInstallmentAmount = Number((payload.amount / installmentsCount).toFixed(2));
    const groupId = installmentsCount > 1 ? `simgrp_${Date.now()}` : null;

    const newStaged: TransactionRecord[] = targetDates.map((effectiveDate, idx) => ({
      id: `sim_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      date: effectiveDate,
      type: payload.type,
      amount: perInstallmentAmount,
      description: payload.description || null,
      category: payload.category || null,
      paymentMethod: payload.paymentMethod,
      purchaseDate: payload.date,
      isSimulation: true,
      isReconciled: false,
      installmentCurrent: installmentsCount > 1 ? idx + 1 : null,
      installmentTotal: installmentsCount > 1 ? installmentsCount : null,
      installmentGroupId: groupId,
      isInMemory: true,
    }));

    set((state) => ({
      stagedTransactions: [...state.stagedTransactions, ...newStaged],
      includeSimulations: true,
    }));
  },

  updateStagedSimulation: (id, patch) =>
    set((state) => ({
      stagedTransactions: state.stagedTransactions.map((t) =>
        t.id === id
          ? {
              ...t,
              type: patch.type,
              amount: patch.amount,
              description: patch.description ?? null,
              category: patch.category ?? null,
              paymentMethod:
                patch.type === "expense_fixed"
                  ? patch.paymentMethod ?? t.paymentMethod
                  : "cash",
            }
          : t
      ),
    })),

  stageDailyOverride: (date, amount, note) =>
    set((state) => {
      const filtered = state.stagedOverrides.filter((o) => o.date !== date);
      return {
        stagedOverrides: [
          ...filtered,
          {
            date,
            amount,
            note: note ?? "Ajuste simulado em memória",
            isReconciled: false,
            isInMemory: true,
          },
        ],
        includeSimulations: true,
      };
    }),

  stageDeleteTransaction: (id) =>
    set((state) => {
      if (id.startsWith("sim_")) {
        return {
          stagedTransactions: state.stagedTransactions.filter((t) => t.id !== id),
        };
      }
      return {
        stagedDeletedTxIds: [...state.stagedDeletedTxIds, id],
      };
    }),

  removeStagedSimulation: (id) =>
    set((state) => ({
      stagedTransactions: state.stagedTransactions.filter((t) => t.id !== id),
    })),

  discardAllStagedChanges: () =>
    set({
      stagedTransactions: [],
      stagedOverrides: [],
      stagedDeletedTxIds: [],
    }),

  applyTemporaryDailyTargetInMemory: (newTarget, startDate, endDate) =>
    set((state) => {
      const overridesMap = new Map(state.stagedOverrides.map((o) => [o.date, o]));
      const cur = new Date(`${startDate}T00:00:00`);
      const end = new Date(`${endDate}T00:00:00`);
      while (cur <= end) {
        const y = cur.getFullYear();
        const m = String(cur.getMonth() + 1).padStart(2, "0");
        const d = String(cur.getDate()).padStart(2, "0");
        const iso = `${y}-${m}-${d}`;
        overridesMap.set(iso, {
          date: iso,
          amount: newTarget,
          note: `Teto temporário sugerido (R$ ${newTarget})`,
          isReconciled: false,
          isInMemory: true,
        });
        cur.setDate(cur.getDate() + 1);
      }
      return {
        stagedOverrides: Array.from(overridesMap.values()),
        includeSimulations: true,
      };
    }),

  moveDayFieldOptimistic: (sourceDate, targetDate, fieldType, targetFieldType) =>
    set((state) => {
      const targetType = targetFieldType ?? fieldType;
      if (
        !sourceDate ||
        !targetDate ||
        (sourceDate === targetDate && fieldType === targetType)
      ) {
        return state;
      }

      const { settings } = state;
      const referenceToday = settings.referenceToday;
      const dailyTarget = settings.dailySpendingTarget;

      // Move & convert any in-memory staged transactions from (sourceDate, fieldType) to (targetDate, targetType)
      const nextStagedTxs = state.stagedTransactions.map((t) =>
        t.date === sourceDate && t.type === fieldType
          ? {
              ...t,
              date: targetDate,
              type: targetType,
              paymentMethod:
                targetType === "expense_fixed" ? t.paymentMethod : "cash",
            }
          : t
      );

      let nextDbTxs = [...state.dbTransactions];

      const sourceTxs = nextDbTxs.filter(
        (t) => t.date === sourceDate && t.type === fieldType
      );
      const positiveSourceIds = new Set(
        sourceTxs.filter((t) => t.amount > 0).map((t) => t.id)
      );
      const zeroSourceTxs = sourceTxs.filter((t) => t.amount <= 0);
      const isSourceFutureProjectedDaily =
        fieldType === "expense_daily" &&
        positiveSourceIds.size === 0 &&
        zeroSourceTxs.length === 0 &&
        sourceDate > referenceToday;

      // Step 1: Prepare targetDate if targetType is 'expense_daily'
      if (targetType === "expense_daily") {
        const targetDailyTxs = nextDbTxs.filter(
          (t) => t.date === targetDate && t.type === "expense_daily"
        );
        const positiveTargetDaily = targetDailyTxs.filter((t) => t.amount > 0);
        const zeroTargetDaily = targetDailyTxs.filter((t) => t.amount <= 0);

        if (zeroTargetDaily.length > 0) {
          nextDbTxs = nextDbTxs.filter(
            (t) =>
              !(
                t.date === targetDate &&
                t.type === "expense_daily" &&
                t.amount <= 0
              )
          );
        } else if (
          positiveTargetDaily.length === 0 &&
          targetDate > referenceToday &&
          dailyTarget > 0
        ) {
          nextDbTxs.push({
            id: `tx_opt_target_${targetDate}_${Date.now()}`,
            date: targetDate,
            type: "expense_daily",
            amount: dailyTarget,
            description: "Meta Diária",
            category: null,
            paymentMethod: "cash",
            purchaseDate: targetDate,
            isSimulation: false,
            isReconciled: true,
          });
        }
      }

      // Step 2: Move & convert source transactions
      if (fieldType === "expense_daily") {
        if (positiveSourceIds.size > 0) {
          nextDbTxs = nextDbTxs.map((t) =>
            positiveSourceIds.has(t.id)
              ? {
                  ...t,
                  date: targetDate,
                  type: targetType,
                  paymentMethod: "cash",
                }
              : t
          );
        } else if (isSourceFutureProjectedDaily) {
          nextDbTxs.push({
            id: `tx_opt_move_${sourceDate}_${Date.now()}`,
            date: targetDate,
            type: targetType,
            amount: dailyTarget,
            description: "Meta Diária",
            category: null,
            paymentMethod: "cash",
            purchaseDate: targetDate,
            isSimulation: false,
            isReconciled: true,
          });
        }

        if (sourceDate > referenceToday) {
          nextDbTxs.push({
            id: `tx_daily_zero_${sourceDate}`,
            date: sourceDate,
            type: "expense_daily",
            amount: 0,
            description: "Diário movido",
            category: null,
            paymentMethod: "cash",
            purchaseDate: sourceDate,
            isSimulation: false,
            isReconciled: true,
          });
        }
      } else {
        nextDbTxs = nextDbTxs.map((t) =>
          positiveSourceIds.has(t.id)
            ? {
                ...t,
                date: targetDate,
                type: targetType,
                paymentMethod:
                  targetType === "expense_fixed" ? t.paymentMethod : "cash",
              }
            : t
        );
      }

      return {
        dbTransactions: nextDbTxs,
        stagedTransactions: nextStagedTxs,
      };
    }),

  addCommittedTransactions: (txs) =>
    set((state) => ({
      dbTransactions: [...state.dbTransactions, ...txs],
    })),

  removeCommittedTransaction: (id) =>
    set((state) => ({
      dbTransactions: state.dbTransactions.filter((t) => t.id !== id),
    })),

  upsertCommittedDailyOverride: (override) =>
    set((state) => ({
      dbDailyOverrides: [
        ...state.dbDailyOverrides.filter((o) => o.date !== override.date),
        override,
      ],
      stagedOverrides: state.stagedOverrides.filter((o) => o.date !== override.date),
    })),

  removeCommittedDailyOverride: (date) =>
    set((state) => ({
      dbDailyOverrides: state.dbDailyOverrides.filter((o) => o.date !== date),
      stagedOverrides: state.stagedOverrides.filter((o) => o.date !== date),
    })),

  updateLocalSettings: (partial) =>
    set((state) => ({
      settings: { ...state.settings, ...partial },
    })),

  setLocalTags: (tags) =>
    set((state) => ({
      settings: { ...state.settings, tags },
    })),

  upsertLocalRecurringRule: (rule) =>
    set((state) => ({
      recurringRules: [
        ...state.recurringRules.filter((r) => r.id !== rule.id),
        rule,
      ],
    })),

  removeLocalRecurringRule: (id) =>
    set((state) => ({
      recurringRules: state.recurringRules.filter((r) => r.id !== id),
    })),

  upsertLocalRecurringOccurrence: (occ) =>
    set((state) => ({
      recurringOccurrences: [
        ...state.recurringOccurrences.filter((o) => o.id !== occ.id),
        occ,
      ],
    })),

  openLaunchModal: (opts) =>
    set((state) => ({
      isLaunchModalOpen: true,
      launchModalPresetDate: opts?.date || state.settings.referenceToday,
      launchModalPresetSimulation: opts?.isSimulation ?? false,
      launchModalPresetType: opts?.type ?? "expense_fixed",
    })),

  closeLaunchModal: () =>
    set({
      isLaunchModalOpen: false,
    }),

  setSelectedDayForDetail: (date, column) =>
    set((state) => ({
      selectedDayForDetail: null,
      selectedColumnForDetail: column ?? state.selectedColumnForDetail,
      isLaunchModalOpen: Boolean(date),
      launchModalPresetDate: date || state.settings.referenceToday,
      launchModalPresetSimulation: false,
      launchModalPresetType: column ?? "expense_daily",
    })),

  setSettingsModalOpen: (open) =>
    set({
      isSettingsModalOpen: open,
    }),

  setRecurringModalOpen: (open) =>
    set({
      isRecurringModalOpen: open,
    }),

  setCommandPaletteOpen: (open) =>
    set({
      isCommandPaletteOpen: open,
    }),

  closeAllModals: () =>
    set({
      isLaunchModalOpen: false,
      selectedDayForDetail: null,
      isSettingsModalOpen: false,
      isRecurringModalOpen: false,
      isCommandPaletteOpen: false,
    }),
}));
