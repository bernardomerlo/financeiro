"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity,
  Award,
  Check,
  Clock,
  Copy,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Loader2,
  Moon,
  RefreshCw,
  Send,
  Smartphone,
  Sparkles,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  addMonthsToYearMonth,
  calculateCashflowProjection,
  type CashflowSettings,
  type DailyOverrideRecord,
  type RecurringOccurrenceRecord,
  type RecurringRuleRecord,
  type TransactionRecord,
} from "@/lib/cashflow-engine";
import { formatShortDate } from "@/lib/format";
import {
  formatDurationHoursMinutes,
  formatExerciseTypeLabel,
} from "@/lib/health-sync";
import {
  deleteHealthExerciseAction,
  deleteHealthSleepAction,
  fetchHealthDashboardDataAction,
  type HealthDashboardData,
} from "@/app/actions";
import { TopNavbar } from "./top-navbar";

interface HealthDashboardClientProps {
  initialCashflowData: {
    settings: CashflowSettings;
    transactions: TransactionRecord[];
    dailyOverrides: DailyOverrideRecord[];
    recurringRules: RecurringRuleRecord[];
    recurringOccurrences: RecurringOccurrenceRecord[];
  };
  initialHealthData: HealthDashboardData;
}

type HealthTab = "overview" | "sleeps" | "exercises" | "setup";

function formatLocalTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return "--:--";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(11, 16);
  }
}

function formatLocalDateTime(isoStr: string): string {
  const d = new Date(isoStr);
  if (Number.isNaN(d.getTime())) return isoStr;
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 16).replace("T", " ");
  }
}

function classifySleepScore(score: number | null): {
  label: string;
  badgeClass: string;
  barColor: string;
} {
  if (score == null) {
    return {
      label: "Sem Score",
      badgeClass: "bg-[#eff3f0] text-[#526657] border-[#d5ded8]",
      barColor: "#8fa395",
    };
  }
  if (score >= 85) {
    return {
      label: "Excelente",
      badgeClass: "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]",
      barColor: "#2d6a3e",
    };
  }
  if (score >= 70) {
    return {
      label: "Bom",
      badgeClass: "bg-[#e0f2fe] text-[#0369a1] border-[#bae6fd]",
      barColor: "#0284c7",
    };
  }
  if (score >= 55) {
    return {
      label: "Regular",
      badgeClass: "bg-[#fff3cd] text-[#7c5800] border-[#ffe69c]",
      barColor: "#d97706",
    };
  }
  return {
    label: "Baixo",
    badgeClass: "bg-[#ffebee] text-[#9e1c1c] border-[#ef9a9a]",
    barColor: "#e11d48",
  };
}

export function HealthDashboardClient({
  initialCashflowData,
  initialHealthData,
}: HealthDashboardClientProps) {
  const {
    isHydrated,
    hydrateFromServer,
    settings,
    centerYearMonth,
    dbTransactions,
    dbDailyOverrides,
    recurringRules,
    recurringOccurrences,
    stagedTransactions,
    stagedOverrides,
    stagedDeletedTxIds,
    includeSimulations,
  } = useCashflowStore();

  useEffect(() => {
    hydrateFromServer(initialCashflowData);
  }, [initialCashflowData, hydrateFromServer]);

  const [healthData, setHealthData] =
    useState<HealthDashboardData>(initialHealthData);
  const [activeTab, setActiveTab] = useState<HealthTab>("overview");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSendingTest, setIsSendingTest] = useState(false);
  const [originUrl, setOriginUrl] = useState("");
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOriginUrl(window.location.origin);
    }
  }, []);

  const endpointUrl = originUrl
    ? `${originUrl}/api/health/sync`
    : "https://<seu-dominio>/api/health/sync";

  const refreshHealthData = useCallback(async (showSpinner = true) => {
    if (showSpinner) setIsRefreshing(true);
    try {
      const fresh = await fetchHealthDashboardDataAction();
      setHealthData(fresh);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao atualizar dados de saúde.");
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const activeSettings = isHydrated ? settings : initialCashflowData.settings;
  const activeCenterYM = isHydrated
    ? centerYearMonth
    : initialCashflowData.settings.referenceToday.slice(0, 7);

  const visibleYearMonths: [string, string, string] = useMemo(
    () => [
      addMonthsToYearMonth(activeCenterYM, -1),
      activeCenterYM,
      addMonthsToYearMonth(activeCenterYM, 1),
    ],
    [activeCenterYM]
  );

  const mergedTransactions = useMemo(() => {
    const base = isHydrated
      ? dbTransactions
      : initialCashflowData.transactions;
    const deletedSet = new Set(stagedDeletedTxIds);
    return [
      ...base.filter((t) => !deletedSet.has(t.id)),
      ...stagedTransactions,
    ];
  }, [
    isHydrated,
    dbTransactions,
    initialCashflowData.transactions,
    stagedDeletedTxIds,
    stagedTransactions,
  ]);

  const mergedOverrides = useMemo(() => {
    const base = isHydrated
      ? dbDailyOverrides
      : initialCashflowData.dailyOverrides;
    const map = new Map<string, DailyOverrideRecord>();
    for (const o of base) map.set(o.date, o);
    if (includeSimulations) {
      for (const st of stagedOverrides) map.set(st.date, st);
    }
    return Array.from(map.values());
  }, [
    isHydrated,
    dbDailyOverrides,
    initialCashflowData.dailyOverrides,
    stagedOverrides,
    includeSimulations,
  ]);

  const projection = useMemo(
    () =>
      calculateCashflowProjection({
        settings: activeSettings,
        visibleYearMonths,
        transactions: mergedTransactions,
        dailyOverrides: mergedOverrides,
        recurringRules: isHydrated
          ? recurringRules
          : initialCashflowData.recurringRules,
        recurringOccurrences: isHydrated
          ? recurringOccurrences
          : initialCashflowData.recurringOccurrences,
        includeSimulations,
      }),
    [
      activeSettings,
      visibleYearMonths,
      mergedTransactions,
      mergedOverrides,
      isHydrated,
      recurringRules,
      initialCashflowData.recurringRules,
      recurringOccurrences,
      initialCashflowData.recurringOccurrences,
      includeSimulations,
    ]
  );

  const currentBalance =
    projection.todayRow?.projectedBalance ?? activeSettings.initialBalance;
  const centerMonthCol = projection.months[1];
  const endOfCenterMonthRow =
    centerMonthCol.days[centerMonthCol.days.length - 1] ?? null;
  const projectedEndOfMonth =
    endOfCenterMonthRow?.projectedBalance ?? currentBalance;

  // Health Metrics Summary
  const metrics = useMemo(() => {
    const sleeps = healthData.sleeps;
    const exercises = healthData.exercises;
    const latestSleep = sleeps[0] ?? null;

    const recentSleeps7 = sleeps.slice(0, 7);
    const avgSleepMinutes7 =
      recentSleeps7.length > 0
        ? Math.round(
            recentSleeps7.reduce((acc, s) => acc + s.durationMinutes, 0) /
              recentSleeps7.length
          )
        : 0;

    const scoredSleeps = recentSleeps7.filter((s) => s.sleepScore != null);
    const avgSleepScore7 =
      scoredSleeps.length > 0
        ? Math.round(
            scoredSleeps.reduce((acc, s) => acc + (s.sleepScore ?? 0), 0) /
              scoredSleeps.length
          )
        : null;

    const totalExerciseMinutes = exercises.reduce(
      (acc, e) => acc + e.durationMinutes,
      0
    );
    const totalCalories = Math.round(
      exercises.reduce((acc, e) => acc + (e.caloriesKcal ?? 0), 0)
    );
    const totalDistanceKm = Number(
      (
        exercises.reduce((acc, e) => acc + (e.distanceMeters ?? 0), 0) / 1000
      ).toFixed(2)
    );

    // Group exercises by modality
    const byModalityMap = new Map<
      string,
      {
        type: string;
        label: string;
        count: number;
        totalMinutes: number;
        totalCalories: number;
        totalDistanceMeters: number;
      }
    >();

    for (const ex of exercises) {
      const key = ex.exerciseType;
      const existing = byModalityMap.get(key) ?? {
        type: key,
        label: formatExerciseTypeLabel(key),
        count: 0,
        totalMinutes: 0,
        totalCalories: 0,
        totalDistanceMeters: 0,
      };
      existing.count += 1;
      existing.totalMinutes += ex.durationMinutes;
      existing.totalCalories += ex.caloriesKcal ?? 0;
      existing.totalDistanceMeters += ex.distanceMeters ?? 0;
      byModalityMap.set(key, existing);
    }

    const modalities = Array.from(byModalityMap.values()).sort(
      (a, b) => b.totalMinutes - a.totalMinutes
    );

    const lastSync = healthData.syncLogs[0] ?? null;

    return {
      latestSleep,
      avgSleepMinutes7,
      avgSleepScore7,
      totalWorkouts: exercises.length,
      totalExerciseMinutes,
      totalCalories,
      totalDistanceKm,
      modalities,
      lastSync,
    };
  }, [healthData]);

  async function handleCopy(text: string, fieldId: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(fieldId);
      toast.success("Copiado para a área de transferência.");
      window.setTimeout(() => setCopiedField(null), 2000);
    } catch {
      toast.error("Não foi possível copiar.");
    }
  }

  async function handleDeleteSleep(uid: string) {
    try {
      await deleteHealthSleepAction(uid);
      await refreshHealthData(false);
      toast.success("Registro de sono removido.");
    } catch {
      toast.error("Erro ao remover registro.");
    }
  }

  async function handleDeleteExercise(uid: string) {
    try {
      await deleteHealthExerciseAction(uid);
      await refreshHealthData(false);
      toast.success("Registro de exercício removido.");
    } catch {
      toast.error("Erro ao remover exercício.");
    }
  }

  async function handleTestApiConnection() {
    setIsSendingTest(true);
    try {
      const res = await fetch("/api/health/sync", {
        method: "GET",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success(
          `Endpoint /api/health/sync ativo! (${data.sleeps?.length ?? 0} sonos, ${data.exercises?.length ?? 0} exercícios salvos)`
        );
      } else {
        toast.error(data.error || "Falha ao validar endpoint.");
      }
    } catch {
      toast.error("Erro de conexão com /api/health/sync.");
    } finally {
      setIsSendingTest(false);
    }
  }

  return (
    <div className="min-h-dvh flex flex-col bg-[#f4f6f4] text-[#141f17]">
      <TopNavbar
        currentBalance={currentBalance}
        projectedEndOfMonth={projectedEndOfMonth}
        projectedQuarterEnd={projection.quarterEndRow?.projectedBalance}
        simulationImpact={projection.totalSimulationImpactOnCurrentMonth}
      />

      <main className="flex-1 max-w-6xl w-full mx-auto px-3 py-4 pb-16 space-y-3">
        {/* Header Bar */}
        <div className="bg-white rounded-xl border border-[#cfd8d2] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] flex items-center justify-center shrink-0">
              <HeartPulse className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm font-extrabold text-[#141f17]">
                  Samsung Health • Sono & Exercícios
                </h1>
                <span className="px-2 py-0.5 rounded-full bg-[#e8f5e9] border border-[#a5d6a7] text-[10px] font-bold text-[#1b5e20]">
                  HealthSync API
                </span>
              </div>
              <p className="text-[11px] text-[#526657]">
                {metrics.lastSync
                  ? `Última sincronização recebida em ${formatLocalDateTime(
                      metrics.lastSync.syncedAt
                    )} (${metrics.lastSync.device})`
                  : "Aguardando primeiro envio do app Android HealthSync"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {/* Navigation Tabs */}
            <div className="flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
              {(
                [
                  { id: "overview", label: "Visão Geral" },
                  {
                    id: "sleeps",
                    label: `Sono (${healthData.sleeps.length})`,
                  },
                  {
                    id: "exercises",
                    label: `Exercícios (${healthData.exercises.length})`,
                  },
                  { id: "setup", label: "Instalar no Celular" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors cursor-pointer ${
                    activeTab === tab.id
                      ? "bg-white text-[#141f17] shadow-2xs"
                      : "text-[#4e6153] hover:text-[#141f17]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => refreshHealthData(true)}
              disabled={isRefreshing}
              className="h-8 px-2.5 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] text-xs font-semibold text-[#141f17] flex items-center gap-1 cursor-pointer"
              title="Atualizar dados"
            >
              <RefreshCw
                className={`w-3.5 h-3.5 text-[#2d6a3e] ${
                  isRefreshing ? "animate-spin" : ""
                }`}
              />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {/* Card 1: Último Sono */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#526657]">
              <span>Último Sono</span>
              <Moon className="w-3.5 h-3.5 text-[#2d6a3e]" />
            </div>
            <div className="text-lg font-extrabold text-[#141f17] tabular-nums">
              {metrics.latestSleep
                ? formatDurationHoursMinutes(metrics.latestSleep.durationMinutes)
                : "--"}
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#526657]">
                {metrics.latestSleep
                  ? formatShortDate(metrics.latestSleep.date)
                  : "Sem registros"}
              </span>
              {metrics.latestSleep?.sleepScore != null && (
                <span
                  className={`px-1.5 py-0.2 rounded border text-[10px] font-bold ${
                    classifySleepScore(metrics.latestSleep.sleepScore)
                      .badgeClass
                  }`}
                >
                  Score {metrics.latestSleep.sleepScore}
                </span>
              )}
            </div>
          </div>

          {/* Card 2: Média de Sono (7 registros) */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#526657]">
              <span>Média de Sono (7 noites)</span>
              <Award className="w-3.5 h-3.5 text-[#0284c7]" />
            </div>
            <div className="text-lg font-extrabold text-[#141f17] tabular-nums">
              {metrics.avgSleepMinutes7 > 0
                ? formatDurationHoursMinutes(metrics.avgSleepMinutes7)
                : "--"}
            </div>
            <div className="text-[11px] text-[#526657]">
              {metrics.avgSleepScore7 != null
                ? `Sleep Score médio: ${metrics.avgSleepScore7}/100`
                : "Aguardando scores do Samsung Health"}
            </div>
          </div>

          {/* Card 3: Exercícios & Tempo Ativo */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#526657]">
              <span>Treinos Sincronizados</span>
              <Dumbbell className="w-3.5 h-3.5 text-[#2d6a3e]" />
            </div>
            <div className="text-lg font-extrabold text-[#141f17] tabular-nums">
              {metrics.totalWorkouts} treino(s)
            </div>
            <div className="text-[11px] text-[#526657]">
              Tempo total:{" "}
              <strong className="text-[#141f17]">
                {formatDurationHoursMinutes(metrics.totalExerciseMinutes)}
              </strong>
            </div>
          </div>

          {/* Card 4: Calorias & Distância */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3 shadow-2xs space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-[#526657]">
              <span>Gasto & Distância</span>
              <Flame className="w-3.5 h-3.5 text-[#ea580c]" />
            </div>
            <div className="text-lg font-extrabold text-[#141f17] tabular-nums">
              {metrics.totalCalories.toLocaleString("pt-BR")} kcal
            </div>
            <div className="text-[11px] text-[#526657]">
              Distância acumulada:{" "}
              <strong className="text-[#141f17]">
                {metrics.totalDistanceKm.toLocaleString("pt-BR")} km
              </strong>
            </div>
          </div>
        </div>

        {/* TAB 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
            {/* Left 7 Cols: Recent Sleep History & Score Bars */}
            <div className="lg:col-span-7 bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-[#2d6a3e]" />
                    <span>Histórico Recente de Sono & Sleep Score</span>
                  </h2>
                  <p className="text-[11px] text-[#526657]">
                    Duração e pontuação consolidada pelo Samsung Health
                  </p>
                </div>
                {healthData.sleeps.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setActiveTab("sleeps")}
                    className="text-[11px] font-bold text-[#2d6a3e] hover:underline cursor-pointer"
                  >
                    Ver todos ({healthData.sleeps.length})
                  </button>
                )}
              </div>

              {healthData.sleeps.length === 0 ? (
                <div className="rounded-xl border border-dashed border-[#cfd8d2] bg-[#f8faf8] p-6 text-center space-y-2">
                  <Moon className="w-5 h-5 text-[#526657] mx-auto" />
                  <div className="text-xs font-bold text-[#141f17]">
                    Nenhum registro de sono recebido ainda
                  </div>
                  <p className="text-[11px] text-[#526657] max-w-md mx-auto">
                    Configure a URL{" "}
                    <code className="px-1.5 py-0.5 rounded bg-white border border-[#d5ded8] font-mono text-[10px]">
                      {endpointUrl}
                    </code>{" "}
                    no app Android <strong>HealthSync</strong> e toque em{" "}
                    <em>Sincronizar Agora</em>.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab("setup")}
                    className="h-8 px-3 rounded-lg bg-[#2d6a3e] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Smartphone className="w-3.5 h-3.5" />
                    <span>Ver Guia de Instalação no Celular</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  {healthData.sleeps.slice(0, 10).map((sleep) => {
                    const scoreMeta = classifySleepScore(sleep.sleepScore);
                    const durationPct = Math.min(
                      100,
                      Math.round((sleep.durationMinutes / 480) * 100)
                    );
                    return (
                      <div
                        key={sleep.uid}
                        className="p-2.5 rounded-lg border border-[#e4ebe6] bg-[#f8faf8] space-y-1.5"
                      >
                        <div className="flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[#141f17]">
                              {formatShortDate(sleep.date)}
                            </span>
                            <span className="text-[11px] text-[#526657]">
                              {formatLocalTime(sleep.startTime)} →{" "}
                              {formatLocalTime(sleep.endTime)}
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded border text-[10px] font-bold ${scoreMeta.badgeClass}`}
                            >
                              {sleep.sleepScore != null
                                ? `Score ${sleep.sleepScore} • ${scoreMeta.label}`
                                : "Sem Score"}
                            </span>
                            <span className="font-extrabold text-[#141f17] tabular-nums">
                              {formatDurationHoursMinutes(sleep.durationMinutes)}
                            </span>
                          </div>
                        </div>

                        <div className="w-full h-1.5 rounded-full bg-[#e4ebe6] overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all"
                            style={{
                              width: `${durationPct}%`,
                              backgroundColor: scoreMeta.barColor,
                            }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Right 5 Cols: Exercises by Modality + Recent Workouts */}
            <div className="lg:col-span-5 space-y-3">
              {/* Modalities Summary */}
              <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
                    <Activity className="w-3.5 h-3.5 text-[#2d6a3e]" />
                    <span>Modalidades de Exercício</span>
                  </h2>
                  {healthData.exercises.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setActiveTab("exercises")}
                      className="text-[11px] font-bold text-[#2d6a3e] hover:underline cursor-pointer"
                    >
                      Ver todos ({healthData.exercises.length})
                    </button>
                  )}
                </div>

                {metrics.modalities.length === 0 ? (
                  <div className="text-xs text-[#526657] py-4 text-center">
                    Nenhum exercício sincronizado ainda.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {metrics.modalities.map((mod) => (
                      <div
                        key={mod.type}
                        className="flex items-center justify-between p-2 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] text-xs"
                      >
                        <div>
                          <div className="font-bold text-[#141f17]">
                            {mod.label}
                          </div>
                          <div className="text-[11px] text-[#526657]">
                            {mod.count} sessão(ões) •{" "}
                            {Math.round(mod.totalCalories)} kcal
                            {mod.totalDistanceMeters > 0
                              ? ` • ${(mod.totalDistanceMeters / 1000).toFixed(
                                  2
                                )} km`
                              : ""}
                          </div>
                        </div>
                        <span className="font-extrabold text-[#2d6a3e] tabular-nums">
                          {formatDurationHoursMinutes(mod.totalMinutes)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recent Sync Logs */}
              <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2">
                <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>Últimos Envios do Celular</span>
                </h2>

                {healthData.syncLogs.length === 0 ? (
                  <div className="text-xs text-[#526657] py-2">
                    Nenhum lote recebido em{" "}
                    <code className="font-mono text-[11px]">
                      /api/health/sync
                    </code>
                    .
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {healthData.syncLogs.slice(0, 5).map((log) => (
                      <div
                        key={log.id}
                        className="flex items-center justify-between text-[11px] p-2 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]"
                      >
                        <span className="font-semibold text-[#141f17]">
                          {formatLocalDateTime(log.syncedAt)}
                        </span>
                        <span className="text-[#526657]">
                          +{log.sleepsUpserted} sono(s) • +
                          {log.exercisesUpserted} treino(s)
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SLEEPS LIST */}
        {activeTab === "sleeps" && (
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2.5">
            <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
              Todos os Registros de Sono ({healthData.sleeps.length})
            </h2>
            {healthData.sleeps.length === 0 ? (
              <div className="text-xs text-[#526657] py-6 text-center">
                Nenhum registro de sono sincronizado.
              </div>
            ) : (
              <div className="divide-y divide-[#e4ebe6]">
                {healthData.sleeps.map((sleep) => {
                  const scoreMeta = classifySleepScore(sleep.sleepScore);
                  return (
                    <div
                      key={sleep.uid}
                      className="py-2.5 flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-[#141f17]">
                            {formatShortDate(sleep.date)}
                          </span>
                          <span className="text-[#526657]">
                            Dormiu {formatLocalTime(sleep.startTime)} • Acordou{" "}
                            {formatLocalTime(sleep.endTime)}
                          </span>
                        </div>
                        <div className="text-[10px] text-[#526657] font-mono">
                          UID: {sleep.uid}
                        </div>
                      </div>

                      <div className="flex items-center gap-2.5">
                        <span
                          className={`px-2 py-0.5 rounded border text-[11px] font-bold ${scoreMeta.badgeClass}`}
                        >
                          {sleep.sleepScore != null
                            ? `Score ${sleep.sleepScore}`
                            : "Sem Score"}
                        </span>
                        <span className="font-extrabold text-[#141f17] tabular-nums">
                          {formatDurationHoursMinutes(sleep.durationMinutes)}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleDeleteSleep(sleep.uid)}
                          className="p-1.5 rounded-lg text-[#526657] hover:text-[#9e1c1c] hover:bg-[#ffebee] cursor-pointer"
                          title="Excluir registro de sono"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: EXERCISES LIST */}
        {activeTab === "exercises" && (
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2.5">
            <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
              Todos os Exercícios Sincronizados ({healthData.exercises.length})
            </h2>
            {healthData.exercises.length === 0 ? (
              <div className="text-xs text-[#526657] py-6 text-center">
                Nenhum registro de exercício sincronizado.
              </div>
            ) : (
              <div className="divide-y divide-[#e4ebe6]">
                {healthData.exercises.map((ex) => (
                  <div
                    key={ex.uid}
                    className="py-2.5 flex items-center justify-between gap-2 text-xs"
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2">
                        <span className="px-2 py-0.5 rounded bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] font-bold text-[11px]">
                          {formatExerciseTypeLabel(ex.exerciseType)}
                        </span>
                        <span className="font-bold text-[#141f17]">
                          {formatShortDate(ex.date)}
                        </span>
                        <span className="text-[#526657]">
                          {formatLocalTime(ex.startTime)} →{" "}
                          {formatLocalTime(ex.endTime)}
                        </span>
                      </div>
                      <div className="text-[11px] text-[#526657] flex items-center gap-3">
                        {ex.caloriesKcal != null && (
                          <span className="inline-flex items-center gap-1">
                            <Flame className="w-3 h-3 text-[#ea580c]" />
                            {Math.round(ex.caloriesKcal)} kcal
                          </span>
                        )}
                        {ex.distanceMeters != null && ex.distanceMeters > 0 && (
                          <span className="inline-flex items-center gap-1">
                            <Footprints className="w-3 h-3 text-[#2d6a3e]" />
                            {(ex.distanceMeters / 1000).toFixed(2)} km
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5">
                      <span className="font-extrabold text-[#141f17] tabular-nums">
                        {formatDurationHoursMinutes(ex.durationMinutes)}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleDeleteExercise(ex.uid)}
                        className="p-1.5 rounded-lg text-[#526657] hover:text-[#9e1c1c] hover:bg-[#ffebee] cursor-pointer"
                        title="Excluir exercício"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: ANDROID APP SETUP & CONFIGURATION */}
        {activeTab === "setup" && (
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-4 shadow-2xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#e4ebe6] pb-3">
              <div>
                <h2 className="text-sm font-extrabold text-[#141f17] flex items-center gap-1.5">
                  <Smartphone className="w-4 h-4 text-[#2d6a3e]" />
                  <span>
                    Configuração do App Android (automacao_samsung_health /
                    HealthSync)
                  </span>
                </h2>
                <p className="text-xs text-[#526657]">
                  Contrato validado com o repositório{" "}
                  <code className="font-mono text-[11px]">
                    bernardomerlo/automacao_samsung_health
                  </code>
                </p>
              </div>

              <button
                type="button"
                onClick={handleTestApiConnection}
                disabled={isSendingTest}
                className="h-8 px-3 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {isSendingTest ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                <span>Testar Endpoint Agora</span>
              </button>
            </div>

            {/* Step 1: Endpoint URL & Auth Header for MainActivity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="p-3 rounded-xl bg-[#f8faf8] border border-[#d5ded8] space-y-1.5">
                <div className="text-xs font-bold text-[#141f17]">
                  1. URL do Endpoint (campo &quot;URL do endpoint (POST)&quot; no
                  app)
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value={endpointUrl}
                    className="flex-1 h-8 px-2.5 rounded-lg border border-[#c5d1c8] bg-white font-mono text-xs text-[#141f17]"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(endpointUrl, "url")}
                    className="h-8 px-2.5 rounded-lg bg-[#2d6a3e] text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedField === "url" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copiar</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#526657]">
                  Aceita <code className="font-mono">POST /api/health/sync</code>{" "}
                  (ou <code className="font-mono">POST /api/health</code>) com o{" "}
                  <code className="font-mono">SyncBatchPayload</code>.
                </p>
              </div>

              <div className="p-3 rounded-xl bg-[#f8faf8] border border-[#d5ded8] space-y-1.5">
                <div className="text-xs font-bold text-[#141f17]">
                  2. Header de Autorização (campo &quot;Header de autorização&quot;
                  no app)
                </div>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    readOnly
                    value="Bearer <SUA_SENHA_OU_WEBHOOK_SECRET>"
                    className="flex-1 h-8 px-2.5 rounded-lg border border-[#c5d1c8] bg-white font-mono text-xs text-[#141f17]"
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy("Bearer ", "auth")}
                    className="h-8 px-2.5 rounded-lg border border-[#cfd8d2] bg-white text-xs font-bold text-[#141f17] flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    {copiedField === "auth" ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                    <span>Copiar Prefixo</span>
                  </button>
                </div>
                <p className="text-[11px] text-[#526657]">
                  Você pode informar <code className="font-mono">Bearer SUA_SENHA</code>,{" "}
                  <code className="font-mono">x-api-key: SUA_SENHA</code> ou
                  deixar em branco caso <code className="font-mono">WEBHOOK_SECRET</code>{" "}
                  não esteja ativo.
                </p>
              </div>
            </div>

            {/* Step 2: Samsung Health Developer Mode & One UI Battery Checklist */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
              <div className="p-3 rounded-xl border border-[#e4ebe6] bg-[#f8faf8] space-y-1.5">
                <div className="font-extrabold text-[#141f17] flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>A. Ativar Modo Desenvolvedor no Samsung Health</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#37473b]">
                  <li>
                    Abra o app <strong>Samsung Health</strong> no celular.
                  </li>
                  <li>
                    Toque em <strong>Menu (⋮) → Configurações → Sobre o Samsung Health</strong>.
                  </li>
                  <li>
                    Toque <strong>10 vezes seguidas</strong> no número da versão
                    até aparecer <em>&quot;Developer modeFp / Modo de desenvolvedor ativado&quot;</em>.
                  </li>
                </ol>
              </div>

              <div className="p-3 rounded-xl border border-[#e4ebe6] bg-[#f8faf8] space-y-1.5">
                <div className="font-extrabold text-[#141f17] flex items-center gap-1.5">
                  <Check className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>B. Conceder Permissões no HealthSync</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#37473b]">
                  <li>
                    Abra o app <strong>HealthSync</strong> instalado no celular.
                  </li>
                  <li>
                    Toque em <strong>&quot;Pedir Permissões Samsung Health&quot;</strong> e
                    autorize a leitura de <strong>Sono</strong> e{" "}
                    <strong>Exercícios</strong>.
                  </li>
                  <li>
                    Cole a URL acima, ative o switch de{" "}
                    <strong>Sync Periódico (1h)</strong> e toque em{" "}
                    <strong>&quot;Sincronizar Agora&quot;</strong>.
                  </li>
                </ol>
              </div>

              <div className="p-3 rounded-xl border border-[#e4ebe6] bg-[#f8faf8] space-y-1.5">
                <div className="font-extrabold text-[#141f17] flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>C. Bateria Irrestrita na One UI</span>
                </div>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#37473b]">
                  <li>
                    No Android, abra{" "}
                    <strong>Configurações → Aplicativos → HealthSync</strong>.
                  </li>
                  <li>
                    Toque em <strong>Bateria</strong> e selecione{" "}
                    <strong>Irrestrito (Unrestricted)</strong>.
                  </li>
                  <li>
                    Isso garante que a One UI não bloqueie o{" "}
                    <code className="font-mono">WorkManager</code> em segundo
                    plano.
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
