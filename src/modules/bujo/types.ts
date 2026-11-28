import type { FinanceDailySummary } from "@/modules/finance/summary";
import type { HealthDailySummary } from "@/modules/health/summary";

export type BujoTaskStatus = "todo" | "done" | "cancelled";
export type BujoTaskSource = "daily" | "annual_log" | "goal";

export interface BujoTaskDTO {
  id: string;
  date: string | null;
  year: number;
  month: number | null;
  parentId: string | null;
  title: string;
  url: string | null;
  status: BujoTaskStatus;
  source: BujoTaskSource;
  sortOrder: number;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
  subtasks: BujoTaskDTO[];
}

export interface BujoEntityLinkDTO {
  id: string;
  sourceType: string;
  sourceId: string;
  targetRaw: string;
  targetSlug: string;
}

export interface ResolvedHabitState {
  value: boolean;
  source: "auto" | "manual";
  autoValue: boolean;
}

export interface ResolvedSleepState {
  minutes: number | null;
  score: number | null;
  source: "health_sync" | "manual" | "none";
}

export interface BujoDayExerciseItem {
  uid: string;
  exerciseType: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  caloriesKcal: number | null;
  distanceMeters: number | null;
  notes: string | null;
  isManualOverride: boolean;
}

export interface BujoDaySleepItem {
  uid: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  sleepScore: number | null;
  notes: string | null;
  isManualOverride: boolean;
}

export interface BujoDayViewData {
  date: string;
  prevDate: string;
  nextDate: string;
  yearMonth: string;
  year: number;
  yesterdayNote: string;
  yesterdayNoteFromPreviousDay: boolean;
  todayNote: string;
  sleep: ResolvedSleepState;
  gym: ResolvedHabitState;
  cardio: ResolvedHabitState;
  vitamin: boolean;
  reading: ResolvedHabitState;
  sleepRecords: BujoDaySleepItem[];
  exerciseRecords: BujoDayExerciseItem[];
  financeSummary: FinanceDailySummary;
  annualCommitments: BujoTaskDTO[];
  rolledOverTasks: BujoTaskDTO[];
  dayTasks: BujoTaskDTO[];
  outgoingLinks: BujoEntityLinkDTO[];
  backlinks: BujoEntityLinkDTO[];
}

export interface BujoMonthDayRow {
  date: string;
  dayNumber: number;
  weekdayShort: string;
  sleepMinutes: number | null;
  sleepScore: number | null;
  didGym: boolean;
  didCardio: boolean;
  didVitamin: boolean;
  didReading: boolean;
  dailySpent: number;
  fixedOut: number;
  income: number;
  hasNote: boolean;
  pendingTasks: BujoTaskDTO[];
  doneTasksCount: number;
}

export interface BujoMonthViewData {
  yearMonth: string;
  year: number;
  monthNumber: number;
  monthName: string;
  prevYearMonth: string;
  nextYearMonth: string;
  considerationsMarkdown: string;
  calendarWeeks: Array<Array<{ date: string | null; dayNumber: number | null }>>;
  days: BujoMonthDayRow[];
  annualCommitments: BujoTaskDTO[];
  stats: {
    avgSleepMinutes: number | null;
    avgSleepScore: number | null;
    gymDays: number;
    cardioDays: number;
    vitaminDays: number;
    readingDays: number;
    totalDailySpent: number;
  };
}

export interface BujoAnnualHeatmapDay {
  date: string;
  month: number;
  day: number;
  weekday: number; // 0 = Sun .. 6 = Sat
  sleepMinutes: number | null;
  sleepScore: number | null;
  didGym: boolean;
  didCardio: boolean;
  didVitamin: boolean;
  didReading: boolean;
  dailySpent: number;
  hasNote: boolean;
  color: "green" | "red" | "empty";
  intensity: number; // 0..100
}

export interface BujoAnnualMonthSection {
  monthNumber: number;
  monthName: string;
  yearMonth: string;
  commitments: BujoTaskDTO[];
}

export interface BujoAnnualViewData {
  year: number;
  goals: BujoTaskDTO[];
  heatmapDays: BujoAnnualHeatmapDay[];
  monthlySections: BujoAnnualMonthSection[];
  summary: {
    daysWithSleep: number;
    avgSleepScore: number | null;
    gymDays: number;
    cardioDays: number;
    vitaminDays: number;
    readingDays: number;
  };
}

export type DaySourceRecord = {
  date: string;
  yesterdayNote: string | null;
  todayNote: string;
  gymOverride: number | null;
  cardioOverride: number | null;
  vitamin: number;
  readingOverride: number | null;
  sleepMinutesOverride: number | null;
  sleepScoreOverride: number | null;
};

export type DayExternalSummaries = {
  health?: HealthDailySummary;
  finance?: FinanceDailySummary;
};
