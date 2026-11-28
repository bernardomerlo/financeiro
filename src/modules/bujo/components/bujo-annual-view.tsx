"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Ban,
  CalendarPlus,
  Check,
  ChevronLeft,
  ChevronRight,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { formatShortDate } from "@/lib/format";
import { formatDurationHoursMinutes } from "@/modules/health/health-sync";
import {
  createBujoTaskAction,
  deleteBujoTaskAction,
  toggleBujoTaskStatusAction,
} from "@/modules/bujo/actions";
import type { BujoAnnualHeatmapDay, BujoAnnualViewData } from "../types";

interface BujoAnnualViewProps {
  data: BujoAnnualViewData;
  todayIso: string;
}

function getHeatmapSquareColor(day: BujoAnnualHeatmapDay): string {
  if (day.color === "green") {
    if (day.intensity >= 92) return "#196127";
    if (day.intensity >= 85) return "#2e8840";
    if (day.intensity >= 80) return "#49af5d";
    return "#7bc96f";
  }
  if (day.color === "red") {
    if (day.intensity >= 40) return "#bd2a00";
    if (day.intensity >= 30) return "#e73400";
    if (day.intensity >= 20) return "#ff4d1a";
    return "#ff9e82";
  }
  return "#ebedf0";
}

export function BujoAnnualView({ data, todayIso }: BujoAnnualViewProps) {
  const router = useRouter();
  const [newGoalTitle, setNewGoalTitle] = useState("");
  const [newCommitmentDate, setNewCommitmentDate] = useState(todayIso);
  const [newCommitmentTitle, setNewCommitmentTitle] = useState("");
  const [hoveredDay, setHoveredDay] = useState<BujoAnnualHeatmapDay | null>(
    null
  );

  // Build 53-week columns aligned Sunday..Saturday for the Heatmap
  const heatmapWeeks = useMemo(() => {
    if (data.heatmapDays.length === 0) return [];
    const firstWeekday = data.heatmapDays[0].weekday;
    const padded: Array<BujoAnnualHeatmapDay | null> = [
      ...Array.from({ length: firstWeekday }, () => null),
      ...data.heatmapDays,
    ];
    while (padded.length % 7 !== 0) {
      padded.push(null);
    }
    const weeks: Array<Array<BujoAnnualHeatmapDay | null>> = [];
    for (let i = 0; i < padded.length; i += 7) {
      weeks.push(padded.slice(i, i + 7));
    }
    return weeks;
  }, [data.heatmapDays]);

  async function handleAddGoal(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = newGoalTitle.trim();
    if (!cleaned) return;
    try {
      await createBujoTaskAction({
        year: data.year,
        title: cleaned,
        source: "goal",
      });
      setNewGoalTitle("");
      router.refresh();
    } catch {
      toast.error("Erro ao adicionar objetivo anual.");
    }
  }

  async function handleAddCommitment(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = newCommitmentTitle.trim();
    if (!cleaned || !newCommitmentDate) return;
    try {
      await createBujoTaskAction({
        date: newCommitmentDate,
        year: Number(newCommitmentDate.slice(0, 4)),
        month: Number(newCommitmentDate.slice(5, 7)),
        title: cleaned,
        source: "annual_log",
      });
      setNewCommitmentTitle("");
      toast.success(
        `Compromisso agendado para ${formatShortDate(newCommitmentDate)}.`
      );
      router.refresh();
    } catch {
      toast.error("Erro ao adicionar compromisso.");
    }
  }

  async function handleToggle(id: string, nextStatus: "todo" | "done" | "cancelled") {
    try {
      await toggleBujoTaskStatusAction({ id, status: nextStatus });
      router.refresh();
    } catch {
      toast.error("Erro ao atualizar status.");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteBujoTaskAction(id);
      router.refresh();
    } catch {
      toast.error("Erro ao excluir item.");
    }
  }

  const completedGoalsCount = data.goals.filter(
    (g) => g.status === "done"
  ).length;

  return (
    <div className="space-y-3">
      {/* Year Header */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/bujo/anual/${data.year - 1}`}
            className="w-8 h-8 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-extrabold text-[#141f17]">
              Log Anual {data.year}
            </h1>
            <p className="text-[11px] text-[#526657]">
              Objetivos anuais, Heatmap de hábitos & sono e compromissos mensais
            </p>
          </div>
          <Link
            href={`/bujo/anual/${data.year + 1}`}
            className="w-8 h-8 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
          <span className="px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8] font-semibold">
            Score médio: <strong>{data.summary.avgSleepScore ?? "--"}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] font-bold">
            💪 {data.summary.gymDays} • 🚴 {data.summary.cardioDays} • 💊{" "}
            {data.summary.vitaminDays} • 📖 {data.summary.readingDays}
          </span>
        </div>
      </div>

      {/* Annual Heatmap (exact match to Log Anual.md heatmap-calendar!) */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
              Rastreador de Hábitos e Sono — {data.year}
            </h2>
            <p className="text-[11px] text-[#526657]">
              Verde = Nota Sono ≥ 75 • Vermelho = Nota Sono &lt; 75 • Clique em
              qualquer dia para abrir
            </p>
          </div>

          <div className="text-[11px] font-semibold text-[#141f17] min-h-[20px]">
            {hoveredDay ? (
              <span className="px-2 py-0.5 rounded bg-[#eff3f0] border border-[#d5ded8]">
                {hoveredDay.date} •{" "}
                {hoveredDay.sleepMinutes != null
                  ? formatDurationHoursMinutes(hoveredDay.sleepMinutes)
                  : "Sem sono"}{" "}
                {hoveredDay.sleepScore != null
                  ? `(Score ${hoveredDay.sleepScore})`
                  : ""}{" "}
                {hoveredDay.didGym ? "💪" : ""}
                {hoveredDay.didVitamin ? "💊" : ""}
                {hoveredDay.didCardio ? "🚴" : ""}
                {hoveredDay.didReading ? "📖" : ""}
              </span>
            ) : (
              <span className="text-[#526657]">
                Passe o mouse sobre um dia para ver os detalhes
              </span>
            )}
          </div>
        </div>

        <div className="overflow-x-auto pb-1">
          <div className="inline-flex gap-1">
            {heatmapWeeks.map((week, wIdx) => (
              <div key={wIdx} className="flex flex-col gap-1">
                {week.map((day, dIdx) => {
                  if (!day) {
                    return (
                      <div
                        key={`pad-${wIdx}-${dIdx}`}
                        className="w-3.5 h-3.5"
                      />
                    );
                  }
                  const bg = getHeatmapSquareColor(day);
                  const isToday = day.date === todayIso;
                  return (
                    <Link
                      key={day.date}
                      href={`/bujo/${day.date}`}
                      onMouseEnter={() => setHoveredDay(day)}
                      style={{ backgroundColor: bg }}
                      className={`w-3.5 h-3.5 rounded-[3px] flex items-center justify-center text-[7px] leading-none transition-transform hover:scale-125 ${
                        isToday ? "ring-2 ring-[#141f17]" : ""
                      }`}
                      title={`${day.date}${
                        day.sleepScore != null ? ` • Score ${day.sleepScore}` : ""
                      }`}
                    >
                      {day.didGym ? "•" : ""}
                    </Link>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Objetivos Anuais + Log Mensal */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Objetivos Anuais */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2.5 h-fit">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
              <Target className="w-3.5 h-3.5 text-[#2d6a3e]" />
              <span>Objetivos Anuais</span>
            </h2>
            <span className="text-[11px] font-bold text-[#2d6a3e]">
              {completedGoalsCount}/{data.goals.length}
            </span>
          </div>

          <form onSubmit={handleAddGoal} className="flex items-center gap-1.5">
            <input
              type="text"
              value={newGoalTitle}
              onChange={(e) => setNewGoalTitle(e.target.value)}
              placeholder="Novo objetivo do ano..."
              className="flex-1 h-8 px-2.5 rounded-lg border border-[#c5d1c8] text-xs"
            />
            <button
              type="submit"
              disabled={!newGoalTitle.trim()}
              className="h-8 px-2.5 rounded-lg bg-[#2d6a3e] text-white text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Add</span>
            </button>
          </form>

          <div className="space-y-1.5">
            {data.goals.length === 0 ? (
              <div className="text-xs text-[#526657] py-4 text-center">
                Nenhum objetivo cadastrado para {data.year}.
              </div>
            ) : (
              data.goals.map((goal) => {
                const done = goal.status === "done";
                return (
                  <div
                    key={goal.id}
                    className="flex items-center justify-between gap-2 p-2 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggle(goal.id, done ? "todo" : "done")
                        }
                        className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                          done
                            ? "bg-[#2d6a3e] border-[#2d6a3e] text-white"
                            : "bg-white border-[#8fa395]"
                        }`}
                      >
                        {done && <Check className="w-3 h-3" />}
                      </button>
                      <span
                        className={
                          done
                            ? "line-through text-[#526657]"
                            : "font-medium text-[#141f17]"
                        }
                      >
                        {goal.title}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleDelete(goal.id)}
                      className="p-1 text-[#526657] hover:text-[#9e1c1c] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Log Mensal (Compromissos Futuros por Mês) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
              <CalendarPlus className="w-3.5 h-3.5 text-[#2d6a3e]" />
              <span>Log Mensal (Compromissos & Prazos)</span>
            </h2>
          </div>

          <form
            onSubmit={handleAddCommitment}
            className="grid grid-cols-1 sm:grid-cols-12 gap-1.5"
          >
            <input
              type="date"
              value={newCommitmentDate}
              onChange={(e) => setNewCommitmentDate(e.target.value)}
              className="sm:col-span-4 h-8 px-2 rounded-lg border border-[#c5d1c8] text-xs font-semibold"
            />
            <input
              type="text"
              value={newCommitmentTitle}
              onChange={(e) => setNewCommitmentTitle(e.target.value)}
              placeholder="Ex.: ENADE - [[Tópicos Especiais II]]..."
              className="sm:col-span-6 h-8 px-2.5 rounded-lg border border-[#c5d1c8] text-xs"
            />
            <button
              type="submit"
              disabled={!newCommitmentTitle.trim()}
              className="sm:col-span-2 h-8 px-2.5 rounded-lg bg-[#2d6a3e] text-white text-xs font-bold cursor-pointer disabled:opacity-50"
            >
              Agendar
            </button>
          </form>

          <div className="space-y-2.5">
            {data.monthlySections.map((sec) => (
              <div
                key={sec.monthNumber}
                className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <Link
                    href={`/bujo/mes/${sec.yearMonth}`}
                    className="text-xs font-extrabold text-[#2d6a3e] hover:underline"
                  >
                    {sec.monthName}
                  </Link>
                  <span className="text-[10px] font-semibold text-[#526657]">
                    {sec.commitments.length} item(ns)
                  </span>
                </div>

                {sec.commitments.length === 0 ? (
                  <div className="text-[11px] text-[#526657] italic">
                    Nenhum compromisso agendado.
                  </div>
                ) : (
                  <div className="space-y-1">
                    {sec.commitments.map((item) => {
                      const done = item.status === "done";
                      const cancelled = item.status === "cancelled";
                      return (
                        <div
                          key={item.id}
                          className="space-y-1 bg-white rounded border border-[#e4ebe6] px-2 py-1.5"
                        >
                          <div className="flex items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2 min-w-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggle(item.id, done ? "todo" : "done")
                                }
                                className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                                  done
                                    ? "bg-[#2d6a3e] border-[#2d6a3e] text-white"
                                    : "bg-white border-[#8fa395]"
                                }`}
                              >
                                {done && <Check className="w-2.5 h-2.5" />}
                              </button>
                              {item.date && (
                                <Link
                                  href={`/bujo/${item.date}`}
                                  className="text-[10px] font-bold text-[#2d6a3e] bg-[#e8f5e9] px-1.5 py-0.2 rounded shrink-0"
                                >
                                  {formatShortDate(item.date)}
                                </Link>
                              )}
                              <span
                                className={
                                  done || cancelled
                                    ? "line-through text-[#526657]"
                                    : "text-[#141f17]"
                                }
                              >
                                {item.title}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <button
                                type="button"
                                onClick={() =>
                                  handleToggle(
                                    item.id,
                                    cancelled ? "todo" : "cancelled"
                                  )
                                }
                                className="p-0.5 text-[#526657] hover:text-[#7c5800] cursor-pointer"
                                title="Cancelar"
                              >
                                <Ban className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDelete(item.id)}
                                className="p-0.5 text-[#526657] hover:text-[#9e1c1c] cursor-pointer"
                                title="Excluir"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            </div>
                          </div>

                          {item.subtasks.length > 0 && (
                            <div className="pl-5 space-y-0.5 border-l-2 border-[#d5ded8] ml-1.5">
                              {item.subtasks.map((sub) => (
                                <div
                                  key={sub.id}
                                  className="flex items-center gap-1.5 text-[11px]"
                                >
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleToggle(
                                        sub.id,
                                        sub.status === "done" ? "todo" : "done"
                                      )
                                    }
                                    className={`w-3 h-3 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                                      sub.status === "done"
                                        ? "bg-[#2d6a3e] border-[#2d6a3e] text-white"
                                        : "bg-white border-[#8fa395]"
                                    }`}
                                  >
                                    {sub.status === "done" && (
                                      <Check className="w-2 h-2" />
                                    )}
                                  </button>
                                  <span
                                    className={
                                      sub.status === "done"
                                        ? "line-through text-[#526657]"
                                        : ""
                                    }
                                  >
                                    {sub.title}
                                  </span>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
