"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Moon,
  Save,
} from "lucide-react";
import { toast } from "sonner";
import { formatBRL, formatShortDate } from "@/lib/format";
import { formatDurationHoursMinutes } from "@/modules/health/health-sync";
import { saveBujoMonthConsiderationsAction } from "@/modules/bujo/actions";
import { WEEKDAY_NAMES_PT } from "@/modules/bujo/bujo-utils";
import type { BujoMonthViewData } from "../types";

interface BujoMonthViewProps {
  data: BujoMonthViewData;
  todayIso: string;
}

function SleepSvgChart({
  title,
  unit,
  points,
  minY,
  maxY,
  idealMinY,
  idealMaxY,
}: {
  title: string;
  unit: string;
  points: Array<{ label: string; value: number | null }>;
  minY: number;
  maxY: number;
  idealMinY: number;
  idealMaxY: number;
}) {
  const validPoints = points.filter((p) => p.value != null) as Array<{
    label: string;
    value: number;
  }>;

  const w = 640;
  const h = 180;
  const padL = 34;
  const padR = 14;
  const padT = 14;
  const padB = 24;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const yPos = (val: number) => {
    const clamped = Math.max(minY, Math.min(maxY, val));
    const ratio = (clamped - minY) / (maxY - minY || 1);
    return padT + plotH - ratio * plotH;
  };

  const xPos = (idx: number, total: number) => {
    if (total <= 1) return padL + plotW / 2;
    return padL + (idx / (total - 1)) * plotW;
  };

  const idealTop = yPos(idealMaxY);
  const idealBottom = yPos(idealMinY);

  const polyline = validPoints
    .map((pt, idx) => `${xPos(idx, validPoints.length)},${yPos(pt.value)}`)
    .join(" ");

  return (
    <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="font-extrabold text-[#141f17]">{title}</span>
        <span className="text-[11px] text-[#526657]">
          Faixa ideal: {idealMinY}–{idealMaxY} {unit}
        </span>
      </div>

      {validPoints.length === 0 ? (
        <div className="h-36 flex items-center justify-center text-xs text-[#526657] border border-dashed border-[#d5ded8] rounded-lg">
          Sem dados de sono neste mês ainda.
        </div>
      ) : (
        <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-44 overflow-visible">
          {/* Ideal green band */}
          <rect
            x={padL}
            y={idealTop}
            width={plotW}
            height={Math.max(2, idealBottom - idealTop)}
            fill="rgba(45, 106, 62, 0.12)"
          />
          {/* Horizontal grid lines */}
          {[minY, Math.round((minY + maxY) / 2), maxY].map((tick) => (
            <g key={tick}>
              <line
                x1={padL}
                x2={w - padR}
                y1={yPos(tick)}
                y2={yPos(tick)}
                stroke="#e4ebe6"
                strokeDasharray="3 3"
              />
              <text
                x={padL - 6}
                y={yPos(tick) + 3}
                textAnchor="end"
                fontSize="10"
                fill="#526657"
              >
                {tick}
              </text>
            </g>
          ))}

          <polyline
            fill="none"
            stroke="#0284c7"
            strokeWidth="2.2"
            points={polyline}
          />

          {validPoints.map((pt, idx) => (
            <g key={`${pt.label}-${idx}`}>
              <circle
                cx={xPos(idx, validPoints.length)}
                cy={yPos(pt.value)}
                r="3.2"
                fill={pt.value >= idealMinY ? "#2d6a3e" : "#e11d48"}
                stroke="#ffffff"
                strokeWidth="1"
              >
                <title>
                  {pt.label}: {pt.value} {unit}
                </title>
              </circle>
            </g>
          ))}
        </svg>
      )}
    </div>
  );
}

export function BujoMonthView({ data, todayIso }: BujoMonthViewProps) {
  const router = useRouter();
  const [considerations, setConsiderations] = useState(
    data.considerationsMarkdown
  );
  const [isSaving, setIsSaving] = useState(false);

  const dayByDate = useMemo(
    () => new Map(data.days.map((d) => [d.date, d])),
    [data.days]
  );

  async function handleSaveConsiderations() {
    setIsSaving(true);
    try {
      await saveBujoMonthConsiderationsAction({
        yearMonth: data.yearMonth,
        considerationsMarkdown: considerations,
      });
      toast.success("Considerações do mês salvas.");
      router.refresh();
    } catch {
      toast.error("Erro ao salvar considerações mensais.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      {/* Month Header */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] p-3 shadow-2xs flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Link
            href={`/bujo/mes/${data.prevYearMonth}`}
            className="w-8 h-8 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] flex items-center justify-center"
          >
            <ChevronLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-base font-extrabold text-[#141f17]">
              {data.monthName} de {data.year}
            </h1>
            <p className="text-[11px] text-[#526657]">
              Agregação automática de tarefas, sono, hábitos e gastos do mês
            </p>
          </div>
          <Link
            href={`/bujo/mes/${data.nextYearMonth}`}
            className="w-8 h-8 rounded-lg border border-[#cfd8d2] bg-[#f8faf8] hover:bg-[#eff3f0] flex items-center justify-center"
          >
            <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Monthly Stats Pills */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs tabular-nums">
          <span className="px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8] font-semibold">
            Sono médio:{" "}
            <strong>
              {data.stats.avgSleepMinutes != null
                ? formatDurationHoursMinutes(data.stats.avgSleepMinutes)
                : "--"}
            </strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8] font-semibold">
            Score médio:{" "}
            <strong>{data.stats.avgSleepScore ?? "--"}</strong>
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#e8f5e9] border border-[#a5d6a7] text-[#1b5e20] font-bold">
            💪 {data.stats.gymDays} • 🚴 {data.stats.cardioDays} • 💊{" "}
            {data.stats.vitaminDays} • 📖 {data.stats.readingDays}
          </span>
          <span className="px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8] font-semibold">
            Diário Mês: <strong>{formatBRL(data.stats.totalDailySpent)}</strong>
          </span>
        </div>
      </div>

      {/* Calendar Grid (exact match to Novembro.md dataviewjs!) */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2">
        <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
          Calendário do Mês & Compromissos Pendentes
        </h2>

        <div className="grid grid-cols-7 gap-1">
          {WEEKDAY_NAMES_PT.map((dow) => (
            <div
              key={dow}
              className="text-center text-[11px] font-bold text-[#526657] py-1"
            >
              {dow}
            </div>
          ))}

          {data.calendarWeeks.flat().map((cell, idx) => {
            if (!cell.date || !cell.dayNumber) {
              return <div key={`empty-${idx}`} className="min-h-[76px]" />;
            }
            const dayRow = dayByDate.get(cell.date);
            const isToday = cell.date === todayIso;
            const isPast = cell.date < todayIso;

            return (
              <Link
                key={cell.date}
                href={`/bujo/${cell.date}`}
                className={`min-h-[76px] rounded-lg border p-1.5 flex flex-col justify-between transition-colors ${
                  isToday
                    ? "border-2 border-[#2d6a3e] bg-[#e8f5e9]/60"
                    : isPast
                      ? "border-[#e4ebe6] bg-[#f8faf8]/70 hover:bg-[#eff3f0]"
                      : "border-[#cfd8d2] bg-white hover:bg-[#f8faf8]"
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={`text-[11px] font-extrabold tabular-nums ${
                      isToday ? "text-[#1b5e20]" : "text-[#141f17]"
                    }`}
                  >
                    {cell.dayNumber}
                  </span>
                  <span className="text-[10px]">
                    {dayRow?.didGym ? "💪" : ""}
                    {dayRow?.didCardio ? "🚴" : ""}
                    {dayRow?.didVitamin ? "💊" : ""}
                    {dayRow?.didReading ? "📖" : ""}
                  </span>
                </div>

                <div className="space-y-0.5 my-1">
                  {dayRow?.pendingTasks.slice(0, 2).map((task) => (
                    <div
                      key={task.id}
                      className="text-[10px] leading-tight font-medium text-[#2d6a3e] truncate"
                      title={task.title}
                    >
                      • {task.title}
                    </div>
                  ))}
                  {dayRow && dayRow.pendingTasks.length > 2 && (
                    <div className="text-[9px] font-bold text-[#526657]">
                      +{dayRow.pendingTasks.length - 2} mais
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between text-[9px] text-[#526657] tabular-nums">
                  <span>
                    {dayRow?.sleepScore != null ? `💤${dayRow.sleepScore}` : ""}
                  </span>
                  <span>
                    {dayRow && dayRow.dailySpent > 0
                      ? `R$${Math.round(dayRow.dailySpent)}`
                      : ""}
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Sleep Charts (exact match to Novembro.md charts!) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        <SleepSvgChart
          title="Horas de Sono"
          unit="h"
          minY={3}
          maxY={12}
          idealMinY={7}
          idealMaxY={10}
          points={data.days.map((d) => ({
            label: formatShortDate(d.date),
            value:
              d.sleepMinutes != null
                ? Number((d.sleepMinutes / 60).toFixed(2))
                : null,
          }))}
        />

        <SleepSvgChart
          title="Nota Sono (Sleep Score)"
          unit="pts"
          minY={30}
          maxY={100}
          idealMinY={75}
          idealMaxY={100}
          points={data.days.map((d) => ({
            label: formatShortDate(d.date),
            value: d.sleepScore,
          }))}
        />
      </div>

      {/* Monthly Considerations + Log Anual Commitments */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
        <div className="lg:col-span-6 bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
              Considerações de {data.monthName}
            </h2>
            <button
              type="button"
              disabled={isSaving}
              onClick={handleSaveConsiderations}
              className="h-7 px-2.5 rounded-lg bg-[#2d6a3e] text-white text-xs font-bold flex items-center gap-1 cursor-pointer"
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Save className="w-3.5 h-3.5" />
              )}
              <span>Salvar</span>
            </button>
          </div>
          <textarea
            value={considerations}
            onChange={(e) => setConsiderations(e.target.value)}
            rows={4}
            placeholder="Resumo e considerações gerais do mês..."
            className="w-full p-2.5 rounded-lg border border-[#c5d1c8] text-xs text-[#141f17] focus:outline-none focus:ring-2 focus:ring-[#2d6a3e]"
          />
        </div>

        <div className="lg:col-span-6 bg-white rounded-xl border border-[#cfd8d2] p-3.5 shadow-2xs space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider">
              Compromissos do Log Anual ({data.annualCommitments.length})
            </h2>
            <Link
              href={`/bujo/anual/${data.year}`}
              className="text-[11px] font-bold text-[#2d6a3e] hover:underline"
            >
              Gerenciar no Log Anual →
            </Link>
          </div>

          {data.annualCommitments.length === 0 ? (
            <div className="text-xs text-[#526657] py-4 text-center">
              Nenhum marco registrado no Log Anual para {data.monthName}.
            </div>
          ) : (
            <div className="space-y-1.5 max-h-40 overflow-y-auto thin-scroll">
              {data.annualCommitments.map((c) => (
                <div
                  key={c.id}
                  className="p-2 rounded-lg bg-[#f8faf8] border border-[#e4ebe6] text-xs flex items-center justify-between gap-2"
                >
                  <span
                    className={
                      c.status !== "todo"
                        ? "line-through text-[#526657]"
                        : "font-medium text-[#141f17]"
                    }
                  >
                    {c.title}
                  </span>
                  {c.date && (
                    <Link
                      href={`/bujo/${c.date}`}
                      className="text-[10px] font-bold text-[#2d6a3e] bg-[#e8f5e9] px-1.5 py-0.5 rounded shrink-0"
                    >
                      {formatShortDate(c.date)}
                    </Link>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Consolidated Daily Table (exact match to Novembro.md dataview table!) */}
      <div className="bg-white rounded-xl border border-[#cfd8d2] shadow-2xs overflow-hidden">
        <div className="px-3.5 py-2.5 border-b border-[#e4ebe6] flex items-center justify-between">
          <h2 className="text-xs font-extrabold text-[#141f17] uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-[#2d6a3e]" />
            <span>Tabela Consolidada do Mês</span>
          </h2>
          <Moon className="w-3.5 h-3.5 text-[#526657]" />
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-[#eff3f0] text-[#4e6153] font-bold">
              <tr>
                <th className="py-2 px-3">Data</th>
                <th className="py-2 px-2">Sono</th>
                <th className="py-2 px-2">Nota Sono</th>
                <th className="py-2 px-2 text-center">Academia</th>
                <th className="py-2 px-2 text-center">Cardio</th>
                <th className="py-2 px-2 text-center">Vitamina</th>
                <th className="py-2 px-2 text-center">Leitura</th>
                <th className="py-2 px-3 text-right">Diário (R$)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e4ebe6] tabular-nums">
              {data.days.map((row) => (
                <tr
                  key={row.date}
                  className={`hover:bg-[#f8faf8] ${
                    row.date === todayIso ? "bg-[#e8f5e9]/40 font-semibold" : ""
                  }`}
                >
                  <td className="py-1.5 px-3">
                    <Link
                      href={`/bujo/${row.date}`}
                      className="text-[#2d6a3e] font-semibold hover:underline"
                    >
                      {row.date} ({row.weekdayShort})
                    </Link>
                  </td>
                  <td className="py-1.5 px-2">
                    {row.sleepMinutes != null
                      ? formatDurationHoursMinutes(row.sleepMinutes)
                      : "—"}
                  </td>
                  <td className="py-1.5 px-2">
                    {row.sleepScore != null ? (
                      <span
                        className={`px-1.5 py-0.2 rounded text-[11px] font-bold ${
                          row.sleepScore >= 75
                            ? "bg-[#e8f5e9] text-[#1b5e20]"
                            : "bg-[#ffebee] text-[#9e1c1c]"
                        }`}
                      >
                        {row.sleepScore}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {row.didGym ? "✅" : "❌"}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {row.didCardio ? "✅" : "❌"}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {row.didVitamin ? "✅" : "❌"}
                  </td>
                  <td className="py-1.5 px-2 text-center">
                    {row.didReading ? "✅" : "❌"}
                  </td>
                  <td className="py-1.5 px-3 text-right font-semibold">
                    {row.dailySpent > 0 ? formatBRL(row.dailySpent) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
