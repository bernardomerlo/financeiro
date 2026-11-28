import type {
  BujoTaskDTO,
  BujoTaskSource,
  BujoTaskStatus,
  DaySourceRecord,
  ResolvedHabitState,
  ResolvedSleepState,
} from "./types";
import type { HealthDailySummary } from "@/modules/health/summary";

export const MONTH_NAMES_PT = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
] as const;

export const WEEKDAY_NAMES_PT = [
  "Dom",
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
] as const;

export function getMonthNamePt(monthNumber1To12: number): string {
  return MONTH_NAMES_PT[monthNumber1To12 - 1] ?? "Mês";
}

export function isValidIsoDate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false;
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return (
    dt.getUTCFullYear() === y &&
    dt.getUTCMonth() + 1 === m &&
    dt.getUTCDate() === d
  );
}

export function isValidYearMonth(ym: string): boolean {
  if (!/^\d{4}-\d{2}$/.test(ym)) return false;
  const [, m] = ym.split("-").map(Number);
  return m >= 1 && m <= 12;
}

export function shiftIsoDate(dateStr: string, deltaDays: number): string {
  const [y, m, d] = dateStr.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + deltaDays, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function shiftYearMonth(ym: string, deltaMonths: number): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1 + deltaMonths, 1, 12, 0, 0));
  return dt.toISOString().slice(0, 7);
}

export function getDaysCountInMonth(year: number, month1To12: number): number {
  return new Date(Date.UTC(year, month1To12, 0)).getUTCDate();
}

export function getWeekdayForIsoDate(dateStr: string): number {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12, 0, 0)).getUTCDay();
}

export function normalizeWikilinkSlug(rawTarget: string): string {
  const withoutSection = rawTarget.split("#")[0] ?? rawTarget;
  const withoutAlias = withoutSection.split("|")[0] ?? withoutSection;
  return withoutAlias
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

/**
 * Extracts unique `[[wikilink]]` references from markdown text,
 * ignoring image embeds `![[...]]`.
 */
export function extractWikilinks(
  markdown: string
): Array<{ targetRaw: string; targetSlug: string }> {
  if (!markdown) return [];
  const regex = /(!)?\[\[([^\]]+)\]\]/g;
  const seen = new Set<string>();
  const results: Array<{ targetRaw: string; targetSlug: string }> = [];

  let match: RegExpExecArray | null;
  while ((match = regex.exec(markdown)) !== null) {
    if (match[1] === "!") continue; // ignore ![[image.png]] or ![[Log Anual#Novembro]]
    const raw = match[2].trim();
    if (!raw) continue;
    const slug = normalizeWikilinkSlug(raw);
    if (!slug || seen.has(slug)) continue;
    seen.add(slug);
    results.push({ targetRaw: raw, targetSlug: slug });
  }
  return results;
}

export function resolveSleepState(
  bujoDay: DaySourceRecord | undefined,
  health?: HealthDailySummary
): ResolvedSleepState {
  if (
    bujoDay?.sleepMinutesOverride != null ||
    bujoDay?.sleepScoreOverride != null
  ) {
    return {
      minutes: bujoDay.sleepMinutesOverride ?? health?.sleepMinutes ?? null,
      score: bujoDay.sleepScoreOverride ?? health?.sleepScore ?? null,
      source: "manual",
    };
  }
  if (health && (health.sleepMinutes != null || health.sleepScore != null)) {
    return {
      minutes: health.sleepMinutes,
      score: health.sleepScore,
      source: "health_sync",
    };
  }
  return {
    minutes: null,
    score: null,
    source: "none",
  };
}

export function resolveHabitBoolean(
  manualOverride: number | null | undefined,
  autoValue: boolean
): ResolvedHabitState {
  if (manualOverride === 1) {
    return { value: true, source: "manual", autoValue };
  }
  if (manualOverride === 0) {
    return { value: false, source: "manual", autoValue };
  }
  return { value: autoValue, source: "auto", autoValue };
}

/**
 * Mirrors the Log Anual.md heatmap color algorithm:
 * - sleepScore >= 75: green, intensity = sleepScore
 * - 0 < sleepScore < 75: red, intensity = 100 - sleepScore
 * - otherwise: empty
 */
export function computeHeatmapColorAndIntensity(
  sleepScore: number | null
): { color: "green" | "red" | "empty"; intensity: number } {
  if (sleepScore == null || sleepScore <= 0) {
    return { color: "empty", intensity: 0 };
  }
  if (sleepScore >= 75) {
    return { color: "green", intensity: Math.min(100, Math.round(sleepScore)) };
  }
  return {
    color: "red",
    intensity: Math.min(100, Math.max(10, Math.round(100 - sleepScore))),
  };
}

export interface FlatBujoTaskRow {
  id: string;
  date: string | null;
  year: number;
  month: number | null;
  parentId: string | null;
  title: string;
  url: string | null;
  status: string;
  source: string;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function nestTasksWithSubtasks(rows: FlatBujoTaskRow[]): BujoTaskDTO[] {
  const byId = new Map<string, BujoTaskDTO>();
  const roots: BujoTaskDTO[] = [];

  const normalized: BujoTaskDTO[] = rows.map((r) => ({
    id: r.id,
    date: r.date,
    year: r.year,
    month: r.month,
    parentId: r.parentId,
    title: r.title,
    url: r.url,
    status: (r.status as BujoTaskStatus) || "todo",
    source: (r.source as BujoTaskSource) || "daily",
    sortOrder: r.sortOrder,
    completedAt: r.completedAt,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    subtasks: [],
  }));

  for (const item of normalized) {
    byId.set(item.id, item);
  }

  for (const item of normalized) {
    if (item.parentId && byId.has(item.parentId)) {
      byId.get(item.parentId)!.subtasks.push(item);
    } else {
      roots.push(item);
    }
  }

  return roots;
}

export function buildMonthCalendarGrid(
  yearMonth: string
): Array<Array<{ date: string | null; dayNumber: number | null }>> {
  const [year, month] = yearMonth.split("-").map(Number);
  const firstWeekday = new Date(Date.UTC(year, month - 1, 1, 12, 0, 0)).getUTCDay();
  const totalDays = getDaysCountInMonth(year, month);

  const cells: Array<{ date: string | null; dayNumber: number | null }> = [];
  for (let i = 0; i < firstWeekday; i++) {
    cells.push({ date: null, dayNumber: null });
  }
  for (let day = 1; day <= totalDays; day++) {
    const date = `${yearMonth}-${String(day).padStart(2, "0")}`;
    cells.push({ date, dayNumber: day });
  }
  while (cells.length % 7 !== 0) {
    cells.push({ date: null, dayNumber: null });
  }

  const weeks: Array<Array<{ date: string | null; dayNumber: number | null }>> = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }
  return weeks;
}
