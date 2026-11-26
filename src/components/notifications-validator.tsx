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
  Bell,
  Check,
  CheckCheck,
  X,
  RefreshCw,
  ArrowLeftRight,
  Plus,
  Equal,
  TrendingDown,
  TrendingUp,
  RotateCcw,
  Loader2,
  Calendar,
  CreditCard,
  Smartphone,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import type {
  CashflowSettings,
  ComputedDayRow,
  DailyOverrideRecord,
} from "@/lib/cashflow-engine";
import { formatBRL, formatFullDate, formatShortDate } from "@/lib/format";
import {
  approveAllNotificationsAction,
  approveNotificationAction,
  fetchInitialCashflowData,
  fetchMobileNotificationsAction,
  rejectNotificationAction,
  reopenNotificationAction,
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

const SWIPE_THRESHOLD = 88;

function formatPaymentBadge(method: string | null): string {
  switch (method) {
    case "pix":
      return "PIX";
    case "debit":
      return "DÉBITO";
    case "credit_card":
      return "CRÉDITO";
    case "bill":
      return "BOLETO";
    case "transfer":
      return "TED/DOC";
    default:
      return "BANCO";
  }
}

function formatTimeFromIso(isoStr: string): string {
  try {
    const d = new Date(isoStr);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
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
  const [statusTab, setStatusTab] = useState<
    "pending" | "processed" | "ignored"
  >("pending");
  const [defaultOutgoingTarget, setDefaultOutgoingTarget] =
    useState<NotificationApprovalTarget>("daily_add");

  // Per-card local edits
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
    // Also update any pending outgoing card draft that hasn't been manually locked
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
      toast.error("Informe um valor maior que zero antes de aprovar.");
      return;
    }

    setBusyIds((prev) => ({ ...prev, [notif.id]: true }));
    // Optimistically mark as processed for instant swipe feel
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

      const targetLabel =
        draft.targetMode === "daily_add"
          ? `Somado no Diário (${formatShortDate(draft.date)})`
          : draft.targetMode === "daily_set"
          ? `Diário definido (${formatShortDate(draft.date)})`
          : draft.targetMode === "income"
          ? `Entrada lançada (${formatShortDate(draft.date)})`
          : `Saída lançada (${formatShortDate(draft.date)})`;

      toast.success(`Aprovado: ${formatBRL(amount)} • ${targetLabel}`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar notificação.");
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
      toast.error("Erro ao recusar notificação.");
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
      toast.success("Notificação movida para Pendentes.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao restaurar notificação.");
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
      toast.error(
        "Nenhuma notificação pendente possui valor válido (> R$ 0,00)."
      );
      return;
    }

    setIsApprovingAll(true);
    try {
      const totalValue = validPayloads.reduce((acc, p) => acc + p.amount, 0);
      await approveAllNotificationsAction(validPayloads);
      await refreshCashflowAndNotifications();
      toast.success(
        `${validPayloads.length} notificação(ões) aprovada(s) • Total ${formatBRL(
          totalValue
        )}`
      );
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar todas as notificações.");
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
    <div className="space-y-3">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] flex items-center justify-center shrink-0">
              <Bell className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-bold text-[#141f17]">
                  Validação de Notificações
                </h2>
                {pendingNotifications.length > 0 && (
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-[#1b5e20] text-white tabular-nums">
                    {pendingNotifications.length} pendente
                    {pendingNotifications.length > 1 ? "s" : ""}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#526657]">
                Aprove ou recuse os gastos capturados pelo celular antes de
                lançar na planilha
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={() => loadNotifications(true)}
              disabled={isLoading}
              className="min-h-[42px] sm:min-h-[36px] px-3 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-xs font-semibold text-[#141f17] flex items-center gap-1.5 cursor-pointer"
              title="Buscar novas notificações"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#2d6a3e] ${
                  isLoading ? "animate-spin" : ""
                }`}
              />
              <span>Atualizar</span>
            </button>

            {pendingNotifications.length > 0 && (
              <button
                type="button"
                onClick={handleApproveAll}
                disabled={isApprovingAll}
                className="flex-1 sm:flex-initial min-h-[42px] sm:min-h-[36px] px-4 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] active:scale-[0.99] text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
              >
                {isApprovingAll ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCheck className="w-4 h-4" />
                )}
                <span>
                  Aprovar Tudo ({pendingNotifications.length})
                  {totalPendingAmount > 0
                    ? ` • ${formatBRL(totalPendingAmount)}`
                    : ""}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Status Filter Tabs & Global Default Destination */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1 border-t border-[#e4ebe6]">
          <div className="grid grid-cols-3 gap-1 bg-[#eff3f0] p-1 rounded-lg border border-[#d5ded8]">
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
                  className={`py-1.5 px-2.5 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    active
                      ? "bg-white text-[#141f17] shadow-2xs border border-[#d5ded8]/80"
                      : "text-[#4e6153] hover:text-[#141f17]"
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          {statusTab === "pending" && pendingNotifications.length > 0 && (
            <div className="flex items-center gap-1.5 text-[11px]">
              <span className="font-semibold text-[#526657] shrink-0">
                Padrão p/ saídas:
              </span>
              <div className="flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
                {(
                  [
                    { id: "daily_add", label: "+ Somar Diário" },
                    { id: "expense_fixed", label: "Coluna Saída" },
                    { id: "daily_set", label: "= Definir Diário" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleChangeGlobalDefaultTarget(opt.id)}
                    className={`px-2 py-1 rounded-md text-[11px] font-semibold transition-colors cursor-pointer ${
                      defaultOutgoingTarget === opt.id
                        ? "bg-[#2d6a3e] text-white"
                        : "text-[#4e6153] hover:text-[#141f17]"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Mobile Swipe Gesture Instructions Bar */}
      {statusTab === "pending" && pendingNotifications.length > 0 && (
        <div className="bg-[#e8f5e9] border border-[#a5d6a7] rounded-xl px-3 py-2 flex items-center justify-between text-[11px] font-semibold text-[#1b5e20]">
          <span className="flex items-center gap-1 text-[#9e1c1c]">
            <span>← Arraste p/ esquerda:</span>
            <strong>Recusar</strong>
          </span>
          <ArrowLeftRight className="w-3.5 h-3.5 text-[#2d6a3e] shrink-0 mx-1" />
          <span className="flex items-center gap-1 text-[#1b5e20]">
            <span>Arraste p/ direita:</span>
            <strong>Aprovar →</strong>
          </span>
        </div>
      )}

      {/* List of Notifications */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-[#cfd8d2] p-8 flex flex-col items-center justify-center gap-2 text-xs text-[#526657]">
          <Loader2 className="w-5 h-5 animate-spin text-[#2d6a3e]" />
          <span>Carregando notificações...</span>
        </div>
      ) : displayedList.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#cfd8d2] p-8 text-center space-y-2">
          <div className="w-10 h-10 rounded-full bg-[#eff3f0] text-[#526657] flex items-center justify-center mx-auto">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="text-sm font-bold text-[#141f17]">
            {statusTab === "pending"
              ? "Nenhuma notificação pendente"
              : statusTab === "processed"
              ? "Nenhuma notificação aprovada ainda"
              : "Nenhuma notificação recusada"}
          </div>
          <p className="text-xs text-[#526657] max-w-md mx-auto">
            {statusTab === "pending"
              ? "Quando o MacroDroid enviar novas notificações de compra ou Pix para /api/notifications, elas aparecerão aqui para sua aprovação."
              : "Você pode alternar entre as abas acima para consultar o histórico."}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
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
                  onUpdateDraft={(patch) =>
                    updateCardDraft(notif.id, notif, patch)
                  }
                  onApprove={() => handleApproveSingle(notif)}
                  onReject={() => handleRejectSingle(notif)}
                  onReopen={() => handleReopenSingle(notif.id)}
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
  onUpdateDraft: (patch: Partial<CardDraftState>) => void;
  onApprove: () => void;
  onReject: () => void;
  onReopen: () => void;
}

function SwipeableNotificationCard({
  notification,
  draft,
  parsedAmount,
  currentDailyVal,
  isBusy,
  onUpdateDraft,
  onApprove,
  onReject,
  onReopen,
}: SwipeableNotificationCardProps) {
  const isPending = notification.status === "pending";
  const x = useMotionValue(0);

  // Visual feedback transforms during horizontal drag
  const approveOpacity = useTransform(x, [15, SWIPE_THRESHOLD], [0, 1]);
  const rejectOpacity = useTransform(x, [-15, -SWIPE_THRESHOLD], [0, 1]);
  const approveScale = useTransform(x, [0, SWIPE_THRESHOLD], [0.85, 1.05]);
  const rejectScale = useTransform(x, [0, -SWIPE_THRESHOLD], [0.85, 1.05]);

  function handleDragEnd(_: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) {
    if (!isPending || isBusy) return;
    if (info.offset.x >= SWIPE_THRESHOLD) {
      onApprove();
    } else if (info.offset.x <= -SWIPE_THRESHOLD) {
      onReject();
    }
  }

  const timeLabel = formatTimeFromIso(notification.originalTimestamp);
  const paymentBadge = formatPaymentBadge(notification.parsedPaymentMethod);

  // Live impact preview string so user sees exactly how the spreadsheet changes
  const impactPreview = useMemo(() => {
    const shortDate = formatFullDate(draft.date);
    if (draft.targetMode === "daily_add") {
      const after = Number((currentDailyVal + parsedAmount).toFixed(2));
      return `${shortDate} • Coluna Diário: ${formatBRL(
        currentDailyVal
      )} ➔ ${formatBRL(after)}`;
    }
    if (draft.targetMode === "daily_set") {
      return `${shortDate} • Coluna Diário: ${formatBRL(
        currentDailyVal
      )} ➔ ${formatBRL(parsedAmount)}`;
    }
    if (draft.targetMode === "income") {
      return `${shortDate} • Coluna Entrada: +${formatBRL(parsedAmount)}`;
    }
    return `${shortDate} • Coluna Saída: +${formatBRL(parsedAmount)}${
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
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      className="relative rounded-xl overflow-hidden select-none"
    >
      {/* Background layer revealed while swiping on mobile */}
      {isPending && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-between px-5 pointer-events-none">
          {/* Left side revealed when swiping RIGHT -> Approve */}
          <motion.div
            style={{ opacity: approveOpacity, scale: approveScale }}
            className="flex items-center gap-2 text-white font-bold text-xs bg-[#1b5e20] px-3.5 py-2 rounded-lg shadow-sm"
          >
            <Check className="w-4 h-4" />
            <span>APROVAR</span>
          </motion.div>

          {/* Right side revealed when swiping LEFT -> Reject */}
          <motion.div
            style={{ opacity: rejectOpacity, scale: rejectScale }}
            className="flex items-center gap-2 text-white font-bold text-xs bg-[#9e1c1c] px-3.5 py-2 rounded-lg shadow-sm ml-auto"
          >
            <span>RECUSAR</span>
            <X className="w-4 h-4" />
          </motion.div>
        </div>
      )}

      {/* Foreground Draggable Card */}
      <motion.div
        style={{ x }}
        drag={isPending && !isBusy ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.6}
        onDragEnd={handleDragEnd}
        className={`relative bg-white rounded-xl border p-3.5 shadow-2xs transition-colors ${
          notification.status === "processed"
            ? "border-[#a5d6a7] bg-[#f9fcf9]"
            : notification.status === "ignored"
            ? "border-[#e0e0e0] bg-[#fafafa] opacity-80"
            : "border-[#cfd8d2] touch-pan-y cursor-grab active:cursor-grabbing"
        }`}
      >
        {/* Top Row: Bank App Badge + Payment Method + Original Date/Time */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="px-2 py-0.5 rounded-md bg-[#eff3f0] border border-[#d5ded8] text-[11px] font-bold text-[#141f17] uppercase">
              {notification.appName || notification.appPackage || "Celular"}
            </span>
            <span
              className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase ${
                notification.detectedType === "incoming"
                  ? "bg-[#e8f5e9] text-[#1b5e20] border border-[#a5d6a7]"
                  : "bg-[#ffebee] text-[#9e1c1c] border border-[#ef9a9a]"
              }`}
            >
              {notification.detectedType === "incoming" ? "Entrada" : "Saída"} •{" "}
              {paymentBadge}
            </span>
          </div>

          <div className="text-[11px] font-semibold text-[#526657] flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            <span>{formatFullDate(notification.eventDate)}</span>
            {timeLabel && <span>às {timeLabel}</span>}
          </div>
        </div>

        {/* Raw Notification Title & Message */}
        <div className="mb-3 bg-[#f8faf8] border border-[#e4ebe6] rounded-lg p-2.5">
          {notification.title && (
            <div className="text-xs font-bold text-[#141f17] mb-0.5">
              {notification.title}
            </div>
          )}
          <div className="text-xs text-[#37473b] leading-relaxed break-words">
            {notification.message}
          </div>
        </div>

        {isPending ? (
          <>
            {/* Destination Mode Selector + Editable Amount & Date */}
            <div
              onPointerDown={(e) => e.stopPropagation()}
              className="space-y-2.5 pt-1"
            >
              {/* Target Column Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 bg-[#eff3f0] p-1 rounded-lg border border-[#d5ded8]">
                {(
                  [
                    {
                      id: "daily_add",
                      label: "+ Somar Diário",
                      icon: Plus,
                    },
                    {
                      id: "expense_fixed",
                      label: "Coluna Saída",
                      icon: TrendingDown,
                    },
                    {
                      id: "daily_set",
                      label: "= Definir Diário",
                      icon: Equal,
                    },
                    {
                      id: "income",
                      label: "Coluna Entrada",
                      icon: TrendingUp,
                    },
                  ] as const
                ).map((opt) => {
                  const Icon = opt.icon;
                  const active = draft.targetMode === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onUpdateDraft({ targetMode: opt.id })}
                      className={`py-1.5 px-2 rounded-md text-[11px] font-bold flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                        active
                          ? "bg-white text-[#141f17] shadow-2xs border border-[#cfd8d2]"
                          : "text-[#4e6153] hover:text-[#141f17]"
                      }`}
                    >
                      <Icon className="w-3 h-3 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Editable Value, Date, and Description */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-[#526657] uppercase mb-0.5">
                    Valor (R$)
                  </label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={draft.amountStr}
                    onChange={(e) =>
                      onUpdateDraft({ amountStr: e.target.value })
                    }
                    placeholder="0,00"
                    className="w-full h-10 sm:h-8 px-2.5 rounded-lg border border-[#c5d1c8] bg-white text-right text-sm font-bold text-[#141f17] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
                  />
                </div>

                <div className="sm:col-span-3">
                  <label className="block text-[10px] font-bold text-[#526657] uppercase mb-0.5">
                    Data na Planilha
                  </label>
                  <input
                    type="date"
                    value={draft.date}
                    onChange={(e) => onUpdateDraft({ date: e.target.value })}
                    className="w-full h-10 sm:h-8 px-2.5 rounded-lg border border-[#c5d1c8] bg-white text-xs font-semibold text-[#141f17]"
                  />
                </div>

                <div className="sm:col-span-6">
                  <label className="block text-[10px] font-bold text-[#526657] uppercase mb-0.5">
                    Descrição / Estabelecimento
                  </label>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="text"
                      value={draft.description}
                      onChange={(e) =>
                        onUpdateDraft({ description: e.target.value })
                      }
                      placeholder="Descrição"
                      className="flex-1 h-10 sm:h-8 px-2.5 rounded-lg border border-[#c5d1c8] bg-white text-xs text-[#141f17]"
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
                        className={`h-10 sm:h-8 px-2.5 rounded-lg border text-[11px] font-semibold flex items-center gap-1 shrink-0 cursor-pointer ${
                          draft.paymentMethod === "credit_card"
                            ? "bg-[#2d6a3e] text-white border-[#2d6a3e]"
                            : "bg-[#eff3f0] text-[#4e6153] border-[#d5ded8]"
                        }`}
                        title="Alternar entre À Vista e Cartão de Crédito"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>
                          {draft.paymentMethod === "credit_card"
                            ? "Cartão"
                            : "À Vista"}
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Live Impact Preview */}
              <div className="px-2.5 py-1.5 rounded-lg bg-[#eff3f0] border border-[#d5ded8] flex items-center justify-between text-[11px]">
                <span className="font-semibold text-[#4e6153]">
                  Impacto ao aprovar:
                </span>
                <span className="font-bold text-[#141f17] tabular-nums">
                  {impactPreview}
                </span>
              </div>

              {/* Explicit Action Buttons (Recusar / Aprovar) */}
              <div className="grid grid-cols-2 gap-2 pt-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={onReject}
                  className="min-h-[44px] sm:min-h-[38px] px-3 rounded-xl border border-[#ef9a9a] bg-[#ffebee] hover:bg-[#ffcdd2] active:scale-[0.99] text-[#9e1c1c] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all"
                >
                  <X className="w-4 h-4 shrink-0" />
                  <span>Recusar</span>
                  <span className="text-[10px] font-normal opacity-75 hidden xs:inline">
                    (← arraste)
                  </span>
                </button>

                <button
                  type="button"
                  disabled={isBusy || parsedAmount <= 0}
                  onClick={onApprove}
                  className="min-h-[44px] sm:min-h-[38px] px-3 rounded-xl bg-[#2d6a3e] hover:bg-[#204f2d] active:scale-[0.99] disabled:opacity-50 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer transition-all"
                >
                  {isBusy ? (
                    <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                  ) : (
                    <Check className="w-4 h-4 shrink-0" />
                  )}
                  <span>
                    Aprovar {parsedAmount > 0 ? formatBRL(parsedAmount) : ""}
                  </span>
                  <span className="text-[10px] font-normal opacity-80 hidden xs:inline">
                    (arraste →)
                  </span>
                </button>
              </div>
            </div>
          </>
        ) : (
          /* Processed or Ignored Footer with Reopen option */
          <div
            onPointerDown={(e) => e.stopPropagation()}
            className="flex items-center justify-between pt-2 border-t border-[#e4ebe6] text-xs"
          >
            <div className="flex items-center gap-2">
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
              {notification.parsedAmount != null && (
                <span className="font-bold text-[#141f17]">
                  {formatBRL(notification.parsedAmount)}
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={isBusy}
              onClick={onReopen}
              className="px-2.5 py-1 rounded-lg border border-[#cfd8d2] bg-white hover:bg-[#eff3f0] text-[11px] font-semibold text-[#4e6153] flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Mover p/ Pendentes</span>
            </button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}
