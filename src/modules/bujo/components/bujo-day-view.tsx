"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Ban,
  BookOpen,
  CalendarCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  CornerDownRight,
  Dumbbell,
  Eye,
  Footprints,
  Link2,
  Loader2,
  Moon,
  Pencil,
  Pill,
  Plus,
  Save,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatFullDate, formatShortDate } from "@/lib/format";
import {
  formatDurationHoursMinutes,
  formatExerciseTypeLabel,
} from "@/modules/health/health-sync";
import {
  createBujoTaskAction,
  deleteBujoTaskAction,
  migrateBujoTaskToDateAction,
  saveBujoDayNoteAction,
  toggleBujoTaskStatusAction,
  updateBujoDayHabitsAction,
} from "@/modules/bujo/actions";
import { getMonthNamePt } from "@/modules/bujo/bujo-utils";
import type { BujoDayViewData, BujoTaskDTO, BujoTaskStatus } from "../types";
import { MarkdownWithLinks } from "./markdown-with-links";

interface BujoDayViewProps {
  data: BujoDayViewData;
  todayIso: string;
}

export function BujoDayView({ data, todayIso }: BujoDayViewProps) {
  const router = useRouter();
  const [todayNote, setTodayNote] = useState(data.todayNote);
  const [isSavingNote, setIsSavingNote] = useState(false);
  const [noteDirty, setNoteDirty] = useState(false);
  const [notePreviewMode, setNotePreviewMode] = useState(false);
  const [showYesterdayPanel, setShowYesterdayPanel] = useState(
    Boolean(data.yesterdayNote.trim())
  );

  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [addingTask, setAddingTask] = useState(false);
  const [subtaskParentId, setSubtaskParentId] = useState<string | null>(null);
  const [subtaskTitle, setSubtaskTitle] = useState("");
  const [busyHabit, setBusyHabit] = useState<string | null>(null);
  const [busyTaskIds, setBusyTaskIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setTodayNote(data.todayNote);
    setNoteDirty(false);
    setShowYesterdayPanel(Boolean(data.yesterdayNote.trim()));
  }, [data.date, data.todayNote, data.yesterdayNote]);

  const monthNumber = Number(data.date.slice(5, 7));
  const monthName = getMonthNamePt(monthNumber);
  const isToday = data.date === todayIso;

  async function handleSaveNote(silent = false) {
    setIsSavingNote(true);
    try {
      await saveBujoDayNoteAction({
        date: data.date,
        todayNote,
      });
      setNoteDirty(false);
      router.refresh();
      if (!silent) {
        toast.success("Considerações salvas e links atualizados.");
      }
    } catch {
      toast.error("Erro ao salvar considerações do dia.");
    } finally {
      setIsSavingNote(false);
    }
  }

  async function handleToggleGym() {
    setBusyHabit("gym");
    // Cycle: auto -> manual true -> manual false -> auto (or if auto is true: manual false -> auto)
    let nextOverride: number | null;
    if (data.gym.source === "auto") {
      nextOverride = data.gym.value ? 0 : 1;
    } else if (data.gym.value) {
      nextOverride = 0;
    } else {
      nextOverride = null;
    }
    try {
      await updateBujoDayHabitsAction({
        date: data.date,
        gymOverride: nextOverride,
      });
      router.refresh();
    } catch {
      toast.error("Erro ao atualizar Academia.");
    } finally {
      setBusyHabit(null);
    }
  }

  async function handleToggleCardio() {
    setBusyHabit("cardio");
    let nextOverride: number | null;
    if (data.cardio.source === "auto") {
      nextOverride = data.cardio.value ? 0 : 1;
    } else if (data.cardio.value) {
      nextOverride = 0;
    } else {
      nextOverride = null;
    }
    try {
      await updateBujoDayHabitsAction({
        date: data.date,
        cardioOverride: nextOverride,
      });
      router.refresh();
    } catch {
      toast.error("Erro ao atualizar Cardio.");
    } finally {
      setBusyHabit(null);
    }
  }

  async function handleToggleVitamin() {
    setBusyHabit("vitamin");
    try {
      await updateBujoDayHabitsAction({
        date: data.date,
        vitamin: !data.vitamin,
      });
      router.refresh();
    } catch {
      toast.error("Erro ao atualizar Vitamina.");
    } finally {
      setBusyHabit(null);
    }
  }

  async function handleToggleReading() {
    setBusyHabit("reading");
    const nextOverride = data.reading.value ? 0 : 1;
    try {
      await updateBujoDayHabitsAction({
        date: data.date,
        readingOverride: nextOverride,
      });
      router.refresh();
    } catch {
      toast.error("Erro ao atualizar Leitura.");
    } finally {
      setBusyHabit(null);
    }
  }

  async function handleAddTask(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = newTaskTitle.trim();
    if (!cleaned) return;
    setAddingTask(true);
    try {
      await createBujoTaskAction({
        date: data.date,
        title: cleaned,
        source: "daily",
      });
      setNewTaskTitle("");
      router.refresh();
    } catch {
      toast.error("Erro ao criar tarefa.");
    } finally {
      setAddingTask(false);
    }
  }

  async function handleAddSubtask(parentId: string, source: BujoTaskDTO["source"]) {
    const cleaned = subtaskTitle.trim();
    if (!cleaned) return;
    setBusyTaskIds((p) => ({ ...p, [parentId]: true }));
    try {
      await createBujoTaskAction({
        date: data.date,
        parentId,
        title: cleaned,
        source,
      });
      setSubtaskTitle("");
      setSubtaskParentId(null);
      router.refresh();
    } catch {
      toast.error("Erro ao adicionar subtarefa.");
    } finally {
      setBusyTaskIds((p) => ({ ...p, [parentId]: false }));
    }
  }

  async function handleTaskStatus(task: BujoTaskDTO, nextStatus: BujoTaskStatus) {
    setBusyTaskIds((p) => ({ ...p, [task.id]: true }));
    try {
      await toggleBujoTaskStatusAction({ id: task.id, status: nextStatus });
      router.refresh();
    } catch {
      toast.error("Erro ao atualizar tarefa.");
    } finally {
      setBusyTaskIds((p) => ({ ...p, [task.id]: false }));
    }
  }

  async function handleMigrateToToday(taskId: string) {
    setBusyTaskIds((p) => ({ ...p, [taskId]: true }));
    try {
      await migrateBujoTaskToDateAction({ id: taskId, targetDate: data.date });
      toast.success("Tarefa migrada para este dia.");
      router.refresh();
    } catch {
      toast.error("Erro ao migrar tarefa.");
    } finally {
      setBusyTaskIds((p) => ({ ...p, [taskId]: false }));
    }
  }

  async function handleDeleteTask(taskId: string) {
    setBusyTaskIds((p) => ({ ...p, [taskId]: true }));
    try {
      await deleteBujoTaskAction(taskId);
      router.refresh();
    } catch {
      toast.error("Erro ao excluir tarefa.");
    } finally {
      setBusyTaskIds((p) => ({ ...p, [taskId]: false }));
    }
  }

  function renderTaskRow(task: BujoTaskDTO, options?: { isRolledOver?: boolean }) {
    const busy = Boolean(busyTaskIds[task.id]);
    const isDone = task.status === "done";
    const isCancelled = task.status === "cancelled";

    return (
      <div
        key={task.id}
        className="rounded-lg border border-[#e4ebe6] bg-[#f8faf8] px-2.5 py-2 space-y-1.5"
      >
        <div className="flex items-start justify-between gap-2 text-xs">
          <div className="flex items-start gap-2 min-w-0 flex-1">
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                handleTaskStatus(task, isDone ? "todo" : "done")
              }
              className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center shrink-0 cursor-pointer transition-colors ${
                isDone
                  ? "bg-[#2d6a3e] border-[#2d6a3e] text-white"
                  : isCancelled
                    ? "bg-[#eeeeee] border-[#bdbdbd] text-[#757575]"
                    : "bg-white border-[#8fa395] hover:border-[#2d6a3e]"
              }`}
              title={isDone ? "Marcar como pendente" : "Concluir tarefa"}
            >
              {isDone ? (
                <Check className="w-3 h-3" />
              ) : isCancelled ? (
                <Ban className="w-2.5 h-2.5" />
              ) : null}
            </button>

            <div className="min-w-0 flex-1">
              <div
                className={`break-words ${
                  isDone || isCancelled
                    ? "line-through text-[#526657]"
                    : "text-[#141f17] font-medium"
                }`}
              >
                {task.title}
              </div>
              {task.url && (
                <a
                  href={task.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] text-[#0369a1] underline break-all"
                >
                  {task.url}
                </a>
              )}
              {options?.isRolledOver && task.date && (
                <Link
                  href={`/bujo/${task.date}`}
                  className="inline-block text-[10px] font-semibold text-[#7c5800] bg-[#fff3cd] px-1.5 py-0.2 rounded border border-[#ffe69c] mt-0.5"
                >
                  De {formatShortDate(task.date)}
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {options?.isRolledOver && (
              <button
                type="button"
                disabled={busy}
                onClick={() => handleMigrateToToday(task.id)}
                className="h-6 px-2 rounded bg-[#e8f5e9] border border-[#a5d6a7] text-[10px] font-bold text-[#1b5e20] flex items-center gap-0.5 cursor-pointer"
                title="Migrar esta tarefa para esta data"
              >
                <span>Migrar</span>
                <ArrowRight className="w-3 h-3" />
              </button>
            )}
            {!options?.isRolledOver && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setSubtaskParentId(
                    subtaskParentId === task.id ? null : task.id
                  );
                  setSubtaskTitle("");
                }}
                className="p-1 rounded text-[#526657] hover:text-[#2d6a3e] hover:bg-[#eff3f0] cursor-pointer"
                title="Adicionar subtarefa"
              >
                <CornerDownRight className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                handleTaskStatus(task, isCancelled ? "todo" : "cancelled")
              }
              className="p-1 rounded text-[#526657] hover:text-[#7c5800] hover:bg-[#fff3cd] cursor-pointer"
              title={isCancelled ? "Reabrir tarefa" : "Cancelar tarefa"}
            >
              <Ban className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => handleDeleteTask(task.id)}
              className="p-1 rounded text-[#526657] hover:text-[#9e1c1c] hover:bg-[#ffebee] cursor-pointer"
              title="Excluir"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Subtasks */}
        {task.subtasks.length > 0 && (
          <div className="pl-5 space-y-1 border-l-2 border-[#d5ded8] ml-2">
            {task.subtasks.map((sub) => {
              const subDone = sub.status === "done";
              return (
                <div
                  key={sub.id}
                  className="flex items-center justify-between gap-2 text-xs py-0.5"
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <button
                      type="button"
                      onClick={() =>
                        handleTaskStatus(sub, subDone ? "todo" : "done")
                      }
                      className={`w-3.5 h-3.5 rounded border flex items-center justify-center shrink-0 cursor-pointer ${
                        subDone
                          ? "bg-[#2d6a3e] border-[#2d6a3e] text-white"
                          : "bg-white border-[#8fa395]"
                      }`}
                    >
                      {subDone && <Check className="w-2.5 h-2.5" />}
                    </button>
                    <span
                      className={`truncate ${
                        subDone ? "line-through text-[#526657]" : "text-[#141f17]"
                      }`}
                    >
                      {sub.title}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteTask(sub.id)}
                    className="p-0.5 text-[#526657] hover:text-[#9e1c1c] cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Inline add subtask */}
        {subtaskParentId === task.id && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleAddSubtask(task.id, task.source);
            }}
            className="pl-5 flex items-center gap-1.5 pt-1"
          >
            <input
              type="text"
              autoFocus
              value={subtaskTitle}
              onChange={(e) => setSubtaskTitle(e.target.value)}
              placeholder="Nova subtarefa..."
              className="flex-1 h-7 px-2 rounded border border-[#2d6a3e] bg-white text-xs"
            />
            <button
              type="submit"
              className="h-7 px-2.5 rounded bg-[#2d6a3e] text-white text-xs font-bold cursor-pointer"
            >
              Add
            </button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Day Header & Navigation */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/bujo/${data.prevDate}`}
            className="w-8 h-8 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] flex items-center justify-center"
            title={`Dia anterior (${data.prevDate})`}
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-extrabold text-[#141f17] capitalize">
                {formatFullDate(data.date)}
              </h1>
              {isToday && (
                <span className="px-2 py-0.5 rounded-full bg-[#e8f5e9] border border-[#a5d6a7] text-[10px] font-bold text-[#1b5e20]">
                  Hoje
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-[11px] text-[#526657]">
              <span>{data.date}</span>
              <span>•</span>
              <Link
                href={`/bujo/mes/${data.yearMonth}`}
                className="font-semibold text-[#2d6a3e] hover:underline"
              >
                [[{monthName}]]
              </Link>
              <span>•</span>
              <Link
                href={`/bujo/anual/${data.year}`}
                className="font-semibold text-[#2d6a3e] hover:underline"
              >
                [[Log Anual {data.year}]]
              </Link>
            </div>
          </div>

          <Link
            href={`/bujo/${data.nextDate}`}
            className="w-8 h-8 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] flex items-center justify-center"
            title={`Próximo dia (${data.nextDate})`}
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Integrated Signals Strip: Sleep + Habits + Finance */}
        <div className="flex flex-wrap items-center gap-1.5">
          {/* Sleep badge (Auto from Samsung Health) */}
          <Link
            href="/saude"
            className="h-8 px-2.5 rounded-lg border border-[#d5ded8] bg-[#f8faf8] hover:bg-[#eff3f0] flex items-center gap-1.5 text-xs"
            title="Dados vindos do Samsung Health"
          >
            <Moon className="w-3.5 h-3.5 text-[#0284c7]" />
            <span className="font-bold text-[#141f17] tabular-nums">
              {data.sleep.minutes != null
                ? formatDurationHoursMinutes(data.sleep.minutes)
                : "Sem sono"}
            </span>
            {data.sleep.score != null && (
              <span
                className={`px-1.5 py-0.2 rounded text-[10px] font-extrabold ${
                  data.sleep.score >= 75
                    ? "bg-[#e8f5e9] text-[#1b5e20]"
                    : "bg-[#ffebee] text-[#9e1c1c]"
                }`}
              >
                {data.sleep.score}
              </span>
            )}
          </Link>

          {/* Habit Toggles */}
          <button
            type="button"
            disabled={busyHabit === "gym"}
            onClick={handleToggleGym}
            className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              data.gym.value
                ? "bg-[#e8f5e9] border-[#a5d6a7] text-[#1b5e20]"
                : "bg-white border-[#d5ded8] text-[#526657] hover:bg-[#f8faf8]"
            }`}
            title={`Academia (${
              data.gym.source === "auto" ? "Automático Saúde" : "Manual"
            }) — clique para alternar`}
          >
            <Dumbbell className="w-3.5 h-3.5" />
            <span>Academia</span>
            {data.gym.source === "auto" && data.gym.value && (
              <span className="text-[9px] uppercase opacity-75">Auto</span>
            )}
          </button>

          <button
            type="button"
            disabled={busyHabit === "cardio"}
            onClick={handleToggleCardio}
            className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              data.cardio.value
                ? "bg-[#e0f2fe] border-[#bae6fd] text-[#0369a1]"
                : "bg-white border-[#d5ded8] text-[#526657] hover:bg-[#f8faf8]"
            }`}
            title={`Cardio (${
              data.cardio.source === "auto" ? "Automático Saúde" : "Manual"
            }) — clique para alternar`}
          >
            <Footprints className="w-3.5 h-3.5" />
            <span>Cardio</span>
            {data.cardio.source === "auto" && data.cardio.value && (
              <span className="text-[9px] uppercase opacity-75">Auto</span>
            )}
          </button>

          <button
            type="button"
            disabled={busyHabit === "vitamin"}
            onClick={handleToggleVitamin}
            className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              data.vitamin
                ? "bg-[#f3e8ff] border-[#d8b4fe] text-[#6b21a8]"
                : "bg-white border-[#d5ded8] text-[#526657] hover:bg-[#f8faf8]"
            }`}
          >
            <Pill className="w-3.5 h-3.5" />
            <span>Vitamina</span>
          </button>

          <button
            type="button"
            disabled={busyHabit === "reading"}
            onClick={handleToggleReading}
            className={`h-8 px-2.5 rounded-lg border text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors ${
              data.reading.value
                ? "bg-[#fff3cd] border-[#ffe69c] text-[#7c5800]"
                : "bg-white border-[#d5ded8] text-[#526657] hover:bg-[#f8faf8]"
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Leitura</span>
          </button>
        </div>
      </div>

      {/* Main Two-Column Grid: Left (Tasks + Linked Health/Finance) | Right (Considerações Ontem & Hoje) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        {/* Left 5 Cols: Tasks & Daily Context */}
        <div className="lg:col-span-5 space-y-3">
          {/* Tasks Card */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
                <CalendarCheck className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Tarefas do Dia</span>
              </h2>
              <span className="text-[11px] font-semibold text-[#526657]">
                {data.dayTasks.filter((t) => t.status === "done").length}/
                {data.dayTasks.length} concluídas
              </span>
            </div>

            {/* Quick Add Task */}
            <form onSubmit={handleAddTask} className="flex items-center gap-1.5">
              <input
                type="text"
                value={newTaskTitle}
                onChange={(e) => setNewTaskTitle(e.target.value)}
                placeholder="Nova tarefa para hoje (suporta [[links]])..."
                className="flex-1 h-8 px-2.5 rounded-lg border border-[#c5d1c8] bg-white text-xs text-[#141f17]"
              />
              <button
                type="submit"
                disabled={addingTask || !newTaskTitle.trim()}
                className="h-8 px-3 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] disabled:opacity-50 text-white text-xs font-bold flex items-center gap-1 cursor-pointer shrink-0"
              >
                {addingTask ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
                <span>Add</span>
              </button>
            </form>

            {/* 1. Compromissos vindos do Log Anual para esta data */}
            {data.annualCommitments.length > 0 && (
              <div className="space-y-1.5 pt-1">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#2d6a3e]">
                  Compromissos do Log Anual ({data.annualCommitments.length})
                </div>
                <div className="space-y-1.5">
                  {data.annualCommitments.map((t) => renderTaskRow(t))}
                </div>
              </div>
            )}

            {/* 2. Tarefas de Hoje */}
            <div className="space-y-1.5">
              {data.dayTasks.length === 0 ? (
                <div className="text-xs text-[#526657] py-2 text-center border border-dashed border-[#d5ded8] rounded-lg">
                  Nenhuma tarefa criada neste dia ainda.
                </div>
              ) : (
                data.dayTasks.map((t) => renderTaskRow(t))
              )}
            </div>

            {/* 3. Tarefas Pendentes Roladas de Dias Anteriores */}
            {data.rolledOverTasks.length > 0 && (
              <div className="space-y-1.5 pt-2 border-t border-[#e4ebe6]">
                <div className="text-[10px] font-extrabold uppercase tracking-wider text-[#7c5800]">
                  Pendentes de Dias Anteriores ({data.rolledOverTasks.length})
                </div>
                <div className="space-y-1.5">
                  {data.rolledOverTasks.map((t) =>
                    renderTaskRow(t, { isRolledOver: true })
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Finance + Health Context Cards */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-[#2d6a3e]" />
                <span>Resumo Financeiro do Dia</span>
              </h2>
              <Link
                href="/financeiro"
                className="text-[11px] font-bold text-[#2d6a3e] hover:underline"
              >
                Abrir Planilha →
              </Link>
            </div>

            <div className="grid grid-cols-3 gap-2 text-xs tabular-nums">
              <div className="p-2 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                <div className="text-[10px] text-[#526657]">Diário</div>
                <div className="font-extrabold text-[#141f17]">
                  {formatBRL(data.financeSummary.dailySpent)}
                </div>
                <div className="text-[10px] text-[#526657]">
                  Meta {formatBRL(data.financeSummary.dailyTarget)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                <div className="text-[10px] text-[#526657]">Saídas</div>
                <div className="font-extrabold text-[#9e1c1c]">
                  {formatBRL(data.financeSummary.fixedOut)}
                </div>
              </div>
              <div className="p-2 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                <div className="text-[10px] text-[#526657]">Entradas</div>
                <div className="font-extrabold text-[#1b5e20]">
                  {formatBRL(data.financeSummary.income)}
                </div>
              </div>
            </div>
          </div>

          {/* Exercises synced on this day */}
          {data.exerciseRecords.length > 0 && (
            <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
                  <Dumbbell className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>Treinos do Dia (Samsung Health)</span>
                </h2>
                <Link
                  href="/saude"
                  className="text-[11px] font-bold text-[#2d6a3e] hover:underline"
                >
                  Detalhes →
                </Link>
              </div>
              <div className="space-y-1.5">
                {data.exerciseRecords.map((ex) => (
                  <div
                    key={ex.uid}
                    className="p-2 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] text-xs flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-[#141f17]">
                        {formatExerciseTypeLabel(ex.exerciseType)}
                      </div>
                      <div className="text-[11px] text-[#526657]">
                        {ex.caloriesKcal != null
                          ? `${Math.round(ex.caloriesKcal)} kcal`
                          : ""}
                        {ex.distanceMeters != null && ex.distanceMeters > 0
                          ? ` • ${(ex.distanceMeters / 1000).toFixed(2)} km`
                          : ""}
                        {ex.notes ? ` • ${ex.notes}` : ""}
                      </div>
                    </div>
                    <span className="font-extrabold text-[#2d6a3e] tabular-nums">
                      {formatDurationHoursMinutes(ex.durationMinutes)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right 7 Cols: Considerações do Dia (Ontem + Hoje Markdown + Links) */}
        <div className="lg:col-span-7 space-y-3">
          {/* Ontem (Automatic from prevDate!) */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                  Ontem ({formatShortDate(data.prevDate)})
                </h2>
                {data.yesterdayNoteFromPreviousDay && (
                  <span className="px-1.5 py-0.2 rounded bg-[#eff3f0] text-[10px] font-semibold text-[#526657]">
                    Herdado automaticamente
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setShowYesterdayPanel((v) => !v)}
                className="text-[11px] font-semibold text-[#2d6a3e] hover:underline cursor-pointer"
              >
                {showYesterdayPanel ? "Ocultar" : "Mostrar"}
              </button>
            </div>

            {showYesterdayPanel && (
              <div className="p-2.5 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                <MarkdownWithLinks
                  content={data.yesterdayNote}
                  emptyText="Nenhuma anotação registrada ontem."
                />
              </div>
            )}
          </div>

          {/* Hoje (Markdown Editor + Preview + Save + Extracted Links) */}
          <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
                  Considerações de Hoje
                </h2>
                {noteDirty && (
                  <span className="px-1.5 py-0.2 rounded bg-[#fff3cd] border border-[#ffe69c] text-[10px] font-bold text-[#7c5800]">
                    Não salvo
                  </span>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <div className="flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
                  <button
                    type="button"
                    onClick={() => setNotePreviewMode(false)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                      !notePreviewMode
                        ? "bg-white text-[#141f17] shadow-2xs"
                        : "text-[#4e6153]"
                    }`}
                  >
                    <Pencil className="w-3 h-3" />
                    <span>Escrever</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setNotePreviewMode(true)}
                    className={`px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                      notePreviewMode
                        ? "bg-white text-[#141f17] shadow-2xs"
                        : "text-[#4e6153]"
                    }`}
                  >
                    <Eye className="w-3 h-3" />
                    <span>Visualizar</span>
                  </button>
                </div>

                <button
                  type="button"
                  disabled={isSavingNote}
                  onClick={() => handleSaveNote(false)}
                  className="h-7 px-2.5 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
                >
                  {isSavingNote ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Save className="w-3.5 h-3.5" />
                  )}
                  <span>Salvar</span>
                </button>
              </div>
            </div>

            {notePreviewMode ? (
              <div className="min-h-[260px] p-3 rounded-lg bg-[#f8faf8] border border-[#e4ebe6]">
                <MarkdownWithLinks
                  content={todayNote}
                  emptyText="Nada escrito para hoje ainda. Clique em 'Escrever' para começar."
                />
              </div>
            ) : (
              <textarea
                value={todayNote}
                onChange={(e) => {
                  setTodayNote(e.target.value);
                  setNoteDirty(true);
                }}
                onKeyDown={(e) => {
                  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
                    e.preventDefault();
                    handleSaveNote(false);
                  }
                }}
                placeholder="Escreva como foi o seu dia, estudos, trabalho, ideias... Use [[Nota]] ou [[YYYY-MM-DD]] para criar conexões!"
                rows={12}
                className="w-full p-3 rounded-lg border border-[#c5d1c8] bg-white text-xs font-mono text-[#141f17] leading-relaxed focus:outline-none focus:ring-2 focus:ring-[#2d6a3e] resize-y"
              />
            )}

            {/* Extracted [[Wikilinks]] & Backlinks */}
            {(data.outgoingLinks.length > 0 || data.backlinks.length > 0) && (
              <div className="pt-2 border-t border-[#e4ebe6] space-y-2">
                {data.outgoingLinks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-bold text-[#526657] flex items-center gap-1">
                      <Link2 className="w-3 h-3 text-[#2d6a3e]" />
                      Links neste dia:
                    </span>
                    {data.outgoingLinks.map((lnk) =>
                      /^\d{4}-\d{2}-\d{2}$/.test(lnk.targetSlug) ? (
                        <Link
                          key={lnk.id}
                          href={`/bujo/${lnk.targetSlug}`}
                          className="px-2 py-0.5 rounded bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] font-semibold"
                        >
                          [[{lnk.targetRaw}]]
                        </Link>
                      ) : (
                        <span
                          key={lnk.id}
                          className="px-2 py-0.5 rounded bg-[#eff3f0] border border-[#d5ded8] text-[#141f17] font-semibold"
                        >
                          [[{lnk.targetRaw}]]
                        </span>
                      )
                    )}
                  </div>
                )}

                {data.backlinks.length > 0 && (
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="font-bold text-[#526657]">
                      Citado por:
                    </span>
                    {data.backlinks.map((bl) => (
                      <Link
                        key={bl.id}
                        href={
                          bl.sourceType === "bujo_day"
                            ? `/bujo/${bl.sourceId}`
                            : "/bujo"
                        }
                        className="px-2 py-0.5 rounded bg-[#fff3cd] border border-[#ffe69c] text-[#7c5800] font-semibold"
                      >
                        {bl.sourceId}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
