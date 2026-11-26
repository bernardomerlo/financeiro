"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useTransform,
  type PanInfo,
} from "framer-motion";
import {
  Check,
  CheckCheck,
  X,
  RefreshCw,
  Plus,
  Equal,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Loader2,
  CreditCard,
  Smartphone,
  Pencil,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import type {
  CashflowSettings,
  ComputedDayRow,
  DailyOverrideRecord,
} from "@/lib/cashflow-engine";
import { formatBRL, formatShortDate } from "@/lib/format";
import {
  approveAllNotificationsAction,
  approveNotificationAction,
  fetchInitialCashflowData,
  fetchMobileNotificationsAction,
  rejectNotificationAction,
  reopenNotificationAction,
  revertApprovedNotificationAction,
  type ApproveNotificationInput,
  type MobileNotificationRecord,
  type NotificationApprovalTarget,
} from "@/app/actions";

interface NotificationsValidatorProps {
  initialNotifications?: MobileNotificationRecord[];
  allDaysMap: Record<string, ComputedDayRow>;
  dailyOverrides: DailyOverrideRecord[];
  settings: CashflowSettings;
  onPendingCountChange?: (count: number) => void;
}

interface CardDraftState {
  amountStr: string;
  date: string;
  description: string;
  targetMode: NotificationApprovalTarget;
  paymentMethod: "cash" | "credit_card";
}

const SWIPE_THRESHOLD = 85;

function targetShortLabel(mode: NotificationApprovalTarget): string {
  switch (mode) {
    case "daily_add":
      return "+ Diário";
    case "daily_set":
      return "= Diário";
    case "income":
      return "Entrada";
    default:
      return "Saída";
  }
}

export function NotificationsValidator({
  initialNotifications,
  allDaysMap,
  dailyOverrides,
  settings,
  onPendingCountChange,
}: NotificationsValidatorProps) {
  const { hydrateFromServer } = useCashflowStore();

  const [notifications, setNotifications] = useState<
    MobileNotificationRecord[]
  >(initialNotifications ?? []);
  const [isLoading, setIsLoading] = useState(!initialNotifications);
  const [isApprovingAll, setIsApprovingAll] = useState(false);
  const [busyIds, setBusyIds] = useState<Record<string, boolean>>({});
  const [expandedEditIds, setExpandedEditIds] = useState<
    Record<string, boolean>
  >({});
  const [statusTab, setStatusTab] = useState<
    "pending" | "processed" | "ignored"
  >("pending");
  const [defaultOutgoingTarget, setDefaultOutgoingTarget] =
    useState<NotificationApprovalTarget>("daily_add");

  const [drafts, setDrafts] = useState<Record<string, CardDraftState>>({});

  const loadNotifications = useCallback(async (showSpinner = false) => {
    if (showSpinner) setIsLoading(true);
    try {
      const list = await fetchMobileNotificationsAction();
      setNotifications(list);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar notificações.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!initialNotifications) {
      loadNotifications(true);
    }
  }, [initialNotifications, loadNotifications]);

  const pendingNotifications = useMemo(
    () => notifications.filter((n) => n.status === "pending"),
    [notifications]
  );
  const processedNotifications = useMemo(
    () => notifications.filter((n) => n.status === "processed"),
    [notifications]
  );
  const ignoredNotifications = useMemo(
    () => notifications.filter((n) => n.status === "ignored"),
    [notifications]
  );

  useEffect(() => {
    onPendingCountChange?.(pendingNotifications.length);
  }, [pendingNotifications.length, onPendingCountChange]);

  const getCardDraft = useCallback(
    (notif: MobileNotificationRecord): CardDraftState => {
      const existing = drafts[notif.id];
      if (existing) return existing;

      const defaultTarget: NotificationApprovalTarget =
        notif.detectedType === "incoming"
          ? "income"
          : notif.parsedPaymentMethod === "credit_card"
          ? "expense_fixed"
          : defaultOutgoingTarget;

      const defaultDesc =
        notif.parsedMerchant ||
        [notif.appName, notif.title].filter(Boolean).join(" - ") ||
        notif.message.slice(0, 60);

      return {
        amountStr:
          notif.parsedAmount != null
            ? String(notif.parsedAmount).replace(".", ",")
            : "",
        date: notif.eventDate || settings.referenceToday,
        description: defaultDesc,
        targetMode: defaultTarget,
        paymentMethod:
          notif.parsedPaymentMethod === "credit_card" ? "credit_card" : "cash",
      };
    },
    [drafts, defaultOutgoingTarget, settings.referenceToday]
  );

  function updateCardDraft(
    id: string,
    notif: MobileNotificationRecord,
    patch: Partial<CardDraftState>
  ) {
    setDrafts((prev) => ({
      ...prev,
      [id]: {
        ...getCardDraft(notif),
        ...patch,
      },
    }));
  }

  function handleChangeGlobalDefaultTarget(mode: NotificationApprovalTarget) {
    setDefaultOutgoingTarget(mode);
    setDrafts((prev) => {
      const next = { ...prev };
      for (const n of pendingNotifications) {
        if (n.detectedType !== "incoming" && next[n.id]) {
          next[n.id] = { ...next[n.id], targetMode: mode };
        }
      }
      return next;
    });
  }

  function parseDraftAmount(amountStr: string): number {
    const cleaned = amountStr.replace(/[^\d,.-]/g, "").replace(",", ".");
    const val = Number.parseFloat(cleaned);
    return Number.isFinite(val) && val > 0 ? Number(val.toFixed(2)) : 0;
  }

  async function refreshCashflowAndNotifications() {
    const [freshCashflow, freshNotifs] = await Promise.all([
      fetchInitialCashflowData(),
      fetchMobileNotificationsAction(),
    ]);
    hydrateFromServer(freshCashflow);
    setNotifications(freshNotifs);
  }

  async function handleApproveSingle(notif: MobileNotificationRecord) {
    const draft = getCardDraft(notif);
    const amount = parseDraftAmount(draft.amountStr);
    if (amount <= 0) {
      setExpandedEditIds((prev) => ({ ...prev, [notif.id]: true }));
      toast.error("Informe o valor antes de aprovar.");
      return;
    }

    setBusyIds((prev) => ({ ...prev, [notif.id]: true }));
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notif.id ? { ...item, status: "processed" } : item
      )
    );

    try {
      await approveNotificationAction({
        id: notif.id,
        amount,
        date: draft.date,
        targetMode: draft.targetMode,
        description: draft.description.trim() || undefined,
        paymentMethod: draft.paymentMethod,
        installments: 1,
      });

      await refreshCashflowAndNotifications();

      toast.success(
        `Aprovado: ${formatBRL(amount)} (${targetShortLabel(
          draft.targetMode
        )} em ${formatShortDate(draft.date)})`,
        {
          action: {
            label: "Estornar",
            onClick: () => handleRevertApproved(notif.id),
          },
        }
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar.");
      await loadNotifications(false);
    } finally {
      setBusyIds((prev) => ({ ...prev, [notif.id]: false }));
    }
  }

  async function handleRejectSingle(notif: MobileNotificationRecord) {
    setBusyIds((prev) => ({ ...prev, [notif.id]: true }));
    setNotifications((prev) =>
      prev.map((item) =>
        item.id === notif.id ? { ...item, status: "ignored" } : item
      )
    );

    try {
      await rejectNotificationAction(notif.id);
      await loadNotifications(false);
      toast("Notificação recusada.", {
        action: {
          label: "Desfazer",
          onClick: () => handleReopenSingle(notif.id),
        },
      });
    } catch (err) {
      console.error(err);
      toast.error("Erro ao recusar.");
      await loadNotifications(false);
    } finally {
      setBusyIds((prev) => ({ ...prev, [notif.id]: false }));
    }
  }

  async function handleReopenSingle(id: string) {
    setBusyIds((prev) => ({ ...prev, [id]: true }));
    try {
      await reopenNotificationAction(id);
      await loadNotifications(false);
      toast.success("Movida para Pendentes.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao restaurar.");
    } finally {
      setBusyIds((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleRevertApproved(id: string) {
    setBusyIds((prev) => ({ ...prev, [id]: true }));
    try {
      await revertApprovedNotificationAction(id);
      await refreshCashflowAndNotifications();
      toast.success("Lançamento estornado e devolvido para Pendentes.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao estornar lançamento.");
    } finally {
      setBusyIds((prev) => ({ ...prev, [id]: false }));
    }
  }

  async function handleApproveAll() {
    const validPayloads: ApproveNotificationInput[] = [];
    for (const notif of pendingNotifications) {
      const draft = getCardDraft(notif);
      const amount = parseDraftAmount(draft.amountStr);
      if (amount > 0) {
        validPayloads.push({
          id: notif.id,
          amount,
          date: draft.date,
          targetMode: draft.targetMode,
          description: draft.description.trim() || undefined,
          paymentMethod: draft.paymentMethod,
          installments: 1,
        });
      }
    }

    if (validPayloads.length === 0) {
      toast.error("Nenhuma notificação pendente possui valor válido.");
      return;
    }

    setIsApprovingAll(true);
    try {
      const totalValue = validPayloads.reduce((acc, p) => acc + p.amount, 0);
      await approveAllNotificationsAction(validPayloads);
      await refreshCashflowAndNotifications();
      toast.success(
        `${validPayloads.length} aprovada(s) • Total ${formatBRL(totalValue)}`
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar todas.");
      await loadNotifications(false);
    } finally {
      setIsApprovingAll(false);
    }
  }

  const totalPendingAmount = useMemo(() => {
    let sum = 0;
    for (const n of pendingNotifications) {
      const draft = getCardDraft(n);
      sum += parseDraftAmount(draft.amountStr);
    }
    return sum;
  }, [pendingNotifications, getCardDraft]);

  const displayedList =
    statusTab === "pending"
      ? pendingNotifications
      : statusTab === "processed"
      ? processedNotifications
      : ignoredNotifications;

  return (
    <div className="space-y-2.5">
      {/* Minimalist Top Bar */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] p-2.5 shadow-2xs space-y-2">
        <div className="flex items-center justify-between gap-2">
          {/* Status Filter Pills */}
          <div className="flex items-center gap-1 bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
            {(
              [
                {
                  id: "pending",
                  label: `Pendentes (${pendingNotifications.length})`,
                },
                {
                  id: "processed",
                  label: `Aprovadas (${processedNotifications.length})`,
                },
                {
                  id: "ignored",
                  label: `Recusadas (${ignoredNotifications.length})`,
                },
              ] as const
            ).map((tab) => {
              const active = statusTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setStatusTab(tab.id)}
                  className={`py-1 px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-white text-[#141f17] shadow-2xs"
                      : "text-[#4e6153] hover:text-[#141f17]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => loadNotifications(true)}
            disabled={isLoading}
            className="h-8 px-2.5 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-xs font-semibold text-[#141f17] flex items-center gap-1 cursor-pointer shrink-0"
            title="Atualizar lista"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 text-[#2d6a3e] ${
                isLoading ? "animate-spin" : ""
              }`}
            />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>

        {/* Approve All + Default Destination Row (only when there are pending notifications) */}
        {statusTab === "pending" && pendingNotifications.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#e4ebe6]">
            <div className="flex items-center gap-1 text-[11px]">
              <span className="font-semibold text-[#526657]">Destino:</span>
              {(
                [
                  { id: "daily_add", label: "Diário" },
                  { id: "expense_fixed", label: "Saída" },
                ] as const
              ).map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleChangeGlobalDefaultTarget(opt.id)}
                  className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors cursor-pointer ${
                    defaultOutgoingTarget === opt.id
                      ? "bg-[#2d6a3e] text-white"
                      : "bg-[#eff3f0] text-[#4e6153]"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={handleApproveAll}
              disabled={isApprovingAll}
              className="h-9 px-3.5 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              {isApprovingAll ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCheck className="w-3.5 h-3.5" />
              )}
              <span>
                Aprovar Tudo ({pendingNotifications.length})
                {totalPendingAmount > 0
                  ? ` • ${formatBRL(totalPendingAmount)}`
                  : ""}
              </span>
            </button>
          </div>
        )}
      </div>

      {/* Subtle Mobile-Only Swipe Hint */}
      {statusTab === "pending" && pendingNotifications.length > 0 && (
        <div className="flex lg:hidden items-center justify-between px-2 text-[11px] font-medium text-[#526657]">
          <span>← Arraste p/ recusar</span>
          <span>Arraste p/ aprovar →</span>
        </div>
      )}

      {/* Notifications List */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-[#cfd8d2] p-6 flex items-center justify-center gap-2 text-xs text-[#526657]">
          <Loader2 className="w-4 h-4 animate-spin text-[#2d6a3e]" />
          <span>Carregando...</span>
        </div>
      ) : displayedList.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#cfd8d2] p-6 text-center space-y-1.5">
          <Smartphone className="w-5 h-5 text-[#526657] mx-auto" />
          <div className="text-xs font-bold text-[#141f17]">
            {statusTab === "pending"
              ? "Nenhuma notificação pendente"
              : statusTab === "processed"
              ? "Nenhuma notificação aprovada"
              : "Nenhuma notificação recusada"}
          </div>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence mode="popLayout">
            {displayedList.map((notif) => {
              const draft = getCardDraft(notif);
              const parsedAmount = parseDraftAmount(draft.amountStr);
              const dayRow = allDaysMap[draft.date];
              const existingOv = dailyOverrides.find(
                (o) => o.date === draft.date
              );
              const currentDailyVal =
                dayRow?.dailyAmount ??
                existingOv?.amount ??
                settings.dailySpendingTarget;

              return (
                <SwipeableNotificationCard
                  key={notif.id}
                  notification={notif}
                  draft={draft}
                  parsedAmount={parsedAmount}
                  currentDailyVal={currentDailyVal}
                  isBusy={Boolean(busyIds[notif.id])}
                  isEditing={Boolean(expandedEditIds[notif.id])}
                  onToggleEdit={() =>
                    setExpandedEditIds((prev) => ({
                      ...prev,
                      [notif.id]: !prev[notif.id],
                    }))
                  }
                  onUpdateDraft={(patch) =>
                    updateCardDraft(notif.id, notif, patch)
                  }
                  onApprove={() => handleApproveSingle(notif)}
                  onReject={() => handleRejectSingle(notif)}
                  onReopen={() => handleReopenSingle(notif.id)}
                  onRevertApproved={() => handleRevertApproved(notif.id)}
                />
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

interface SwipeableNotificationCardProps {
  notification: MobileNotificationRecord;
  draft: CardDraftState;
  parsedAmount: number;
  currentDailyVal: number;
  isBusy: boolean;
  isEditing: boolean;
  onToggleEdit: () => void;
  onUpdateDraft: (patch: Partial<CardDraftState>) => void;
  onApprove: () => void;
  onReject: () => void;
  onReopen: () => void;
  onRevertApproved: () => void;
}

function SwipeableNotificationCard({
  notification,
  draft,
  parsedAmount,
  currentDailyVal,
  isBusy,
  isEditing,
  onToggleEdit,
  onUpdateDraft,
  onApprove,
  onReject,
  onReopen,
  onRevertApproved,
}: SwipeableNotificationCardProps) {
  const isPending = notification.status === "pending";
  const x = useMotionValue(0);

  const approveOpacity = useTransform(x, [15, SWIPE_THRESHOLD], [0, 1]);
  const rejectOpacity = useTransform(x, [-15, -SWIPE_THRESHOLD], [0, 1]);

  function handleDragEnd(
    _: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) {
    if (!isPending || isBusy) return;
    if (info.offset.x >= SWIPE_THRESHOLD) {
      onApprove();
    } else if (info.offset.x <= -SWIPE_THRESHOLD) {
      onReject();
    }
  }

  const impactSummary = useMemo(() => {
    const shortDate = formatShortDate(draft.date);
    if (draft.targetMode === "daily_add") {
      const after = Number((currentDailyVal + parsedAmount).toFixed(2));
      return `${shortDate} • Diário: ${formatBRL(currentDailyVal)} ➔ ${formatBRL(
        after
      )}`;
    }
    if (draft.targetMode === "daily_set") {
      return `${shortDate} • Diário: ${formatBRL(
        currentDailyVal
      )} ➔ ${formatBRL(parsedAmount)}`;
    }
    if (draft.targetMode === "income") {
      return `${shortDate} • Entrada: +${formatBRL(parsedAmount)}`;
    }
    return `${shortDate} • Saída: +${formatBRL(parsedAmount)}${
      draft.paymentMethod === "credit_card" ? " (Cartão)" : ""
    }`;
  }, [
    draft.date,
    draft.targetMode,
    draft.paymentMethod,
    currentDailyVal,
    parsedAmount,
  ]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.14 } }}
      className="relative rounded-xl overflow-hidden select-none"
    >
      {/* Background revealed during swipe on mobile */}
      {isPending && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-between px-4 pointer-events-none">
          <motion.div
            style={{ opacity: approveOpacity }}
            className="flex items-center gap-1.5 text-white font-bold text-xs bg-[#1b5e20] px-3 py-1.5 rounded-lg"
          >
            <Check className="w-4 h-4" />
            <span>APROVAR</span>
          </motion.div>

          <motion.div
            style={{ opacity: rejectOpacity }}
            className="flex items-center gap-1.5 text-white font-bold text-xs bg-[#9e1c1c] px-3 py-1.5 rounded-lg ml-auto"
          >
            <span>RECUSAR</span>
            <X className="w-4 h-4" />
          </motion.div>
        </div>
      )}

      {/* Card Body */}
      <motion.div
        style={{ x }}
        drag={isPending && !isBusy && !isEditing ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.55}
        onDragEnd={handleDragEnd}
        className={`relative bg-white rounded-xl border p-3 shadow-2xs ${
          notification.status === "processed"
            ? "border-[#a5d6a7]"
            : notification.status === "ignored"
            ? "border-[#e0e0e0] opacity-75"
            : "border-[#cfd8d2] touch-pan-y"
        }`}
      >
        {/* Row 1: App Badge + 1-Tap Quick Switch (+Diário | Saída) + Editable Amount */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="px-2 py-0.5 rounded bg-[#eff3f0] border border-[#d5ded8] text-[10px] font-bold text-[#141f17] uppercase shrink-0">
              {notification.appName || notification.appPackage || "App"}
            </span>
            {isPending && (
              <div
                onPointerDown={(e) => e.stopPropagation()}
                className="flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]"
              >
                <button
                  type="button"
                  onClick={() => onUpdateDraft({ targetMode: "daily_add" })}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                    draft.targetMode === "daily_add"
                      ? "bg-[#2d6a3e] text-white"
                      : "text-[#4e6153]"
                  }`}
                >
                  + Diário
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateDraft({ targetMode: "expense_fixed" })}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                    draft.targetMode === "expense_fixed"
                      ? "bg-[#2d6a3e] text-white"
                      : "text-[#4e6153]"
                  }`}
                >
                  Saída
                </button>
                <button
                  type="button"
                  onClick={() => onUpdateDraft({ targetMode: "income" })}
                  className={`px-2 py-0.5 rounded text-[11px] font-bold cursor-pointer ${
                    draft.targetMode === "income"
                      ? "bg-[#2d6a3e] text-white"
                      : "text-[#4e6153]"
                  }`}
                >
                  Entrada
                </button>
              </div>
            )}
          </div>

          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center gap-1.5 shrink-0"
          >
            <span
              className={`text-sm font-bold tabular-nums ${
                draft.targetMode === "income"
                  ? "text-[#1b5e20]"
                  : "text-[#9e1c1c]"
              }`}
            >
              {formatBRL(parsedAmount)}
            </span>
            {isPending && (
              <button
                type="button"
                onClick={onToggleEdit}
                className={`w-7 h-7 rounded-lg border flex items-center justify-center cursor-pointer ${
                  isEditing
                    ? "bg-[#2d6a3e] border-[#2d6a3e] text-white"
                    : "bg-[#f8faf8] border-[#d5ded8] text-[#4e6153] hover:bg-[#eff3f0]"
                }`}
                title="Editar valor ou data"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Compact Notification Text + Impact Preview */}
        <div className="mt-1.5 text-xs text-[#37473b] line-clamp-2">
          {notification.title ? (
            <strong className="text-[#141f17]">{notification.title}: </strong>
          ) : null}
          {notification.message}
        </div>
        {isPending && (
          <div className="mt-1 text-[11px] font-semibold text-[#526657]">
            {impactSummary}
          </div>
        )}

        {/* Optional Expandable Edit Drawer (only shown when Pencil is tapped) */}
        {isPending && isEditing && (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="mt-2.5 pt-2.5 border-t border-[#e4ebe6] space-y-2"
          >
            <div className="grid grid-cols-3 gap-1 bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
              {(
                [
                  { id: "daily_add", label: "Diário", icon: Plus },
                  { id: "expense_fixed", label: "Saída", icon: TrendingDown },
                  { id: "income", label: "Entrada", icon: TrendingUp },
                ] as const
              ).map((opt) => {
                const Icon = opt.icon;
                const active = draft.targetMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => onUpdateDraft({ targetMode: opt.id })}
                    className={`py-1 px-1.5 rounded text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer ${
                      active
                        ? "bg-white text-[#141f17] shadow-2xs"
                        : "text-[#4e6153]"
                    }`}
                  >
                    <Icon className="w-3 h-3 shrink-0" />
                    <span className="truncate">{opt.label}</span>
                  </button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
              <input
                type="text"
                inputMode="decimal"
                value={draft.amountStr}
                onChange={(e) => onUpdateDraft({ amountStr: e.target.value })}
                placeholder="Valor (R$)"
                className="h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-right text-xs font-bold text-[#141f17]"
              />
              <input
                type="date"
                value={draft.date}
                onChange={(e) => onUpdateDraft({ date: e.target.value })}
                className="h-9 px-2 rounded-lg border border-[#c5d1c8] text-xs font-semibold text-[#141f17]"
              />
              <div className="col-span-2 sm:col-span-1 flex items-center gap-1">
                <input
                  type="text"
                  value={draft.description}
                  onChange={(e) =>
                    onUpdateDraft({ description: e.target.value })
                  }
                  placeholder="Descrição"
                  className="flex-1 h-9 px-2.5 rounded-lg border border-[#c5d1c8] text-xs text-[#141f17]"
                />
                {draft.targetMode === "expense_fixed" && (
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateDraft({
                        paymentMethod:
                          draft.paymentMethod === "credit_card"
                            ? "cash"
                            : "credit_card",
                      })
                    }
                    className={`h-9 px-2 rounded-lg border text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer ${
                      draft.paymentMethod === "credit_card"
                        ? "bg-[#2d6a3e] text-white border-[#2d6a3e]"
                        : "bg-[#eff3f0] text-[#4e6153] border-[#d5ded8]"
                    }`}
                  >
                    <CreditCard className="w-3 h-3" />
                    <span>
                      {draft.paymentMethod === "credit_card" ? "Cartão" : "Pix"}
                    </span>
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Row 3: Explicit Action Buttons */}
        {isPending ? (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="grid grid-cols-2 gap-2 mt-2.5"
          >
            <button
              type="button"
              disabled={isBusy}
              onClick={onReject}
              className="h-9 px-3 rounded-lg border border-[#ef9a9a] bg-[#ffebee] hover:bg-[#ffcdd2] text-[#9e1c1c] text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
              <span>Recusar</span>
            </button>

            <button
              type="button"
              disabled={isBusy || parsedAmount <= 0}
              onClick={onApprove}
              className="h-9 px-3 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1 cursor-pointer"
            >
              {isBusy ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              <span>Aprovar</span>
            </button>
          </div>
        ) : (
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center justify-between mt-2 pt-2 border-t border-[#e4ebe6] text-xs"
          >
            <span
              className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                notification.status === "processed"
                  ? "bg-[#e8f5e9] text-[#1b5e20]"
                  : "bg-[#eeeeee] text-[#616161]"
              }`}
            >
              {notification.status === "processed"
                ? "✓ Aprovada e Lançada"
                : "✕ Recusada"}
            </span>

            {notification.status === "processed" ? (
              <button
                type="button"
                disabled={isBusy}
                onClick={onRevertApproved}
                className="px-2.5 py-1 rounded-lg border border-[#ef9a9a] bg-[#ffebee] hover:bg-[#ffcdd2] text-[11px] font-bold text-[#9e1c1c] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Estornar lançamento</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={onReopen}
                className="px-2.5 py-1 rounded-lg border border-[#cfd8d2] bg-white hover:bg-[#eff3f0] text-[11px] font-semibold text-[#4e6153] flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Mover p/ Pendentes</span>
              </button>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
