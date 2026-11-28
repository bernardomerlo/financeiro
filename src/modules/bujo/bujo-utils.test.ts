import { describe, expect, it } from "vitest";
import {
  buildMonthCalendarGrid,
  computeHeatmapColorAndIntensity,
  extractWikilinks,
  nestTasksWithSubtasks,
  resolveHabitBoolean,
  resolveSleepState,
  shiftIsoDate,
  shiftYearMonth,
} from "./bujo-utils";

describe("bujo-utils", () => {
  it("extracts unique wikilinks while ignoring embeds and preserving aliases", () => {
    const md = `
      Trabalhei em [[Agência Virtual]] e mexi no [[CSharp|C#]] e [[Kanban#Desenvolvimento]].
      Veja ![[Pasted image 20261028104646.png]] e ![[Log Anual#Novembro]].
      De novo citei [[Agência Virtual]] e [[2026-11-28]].
    `;
    const links = extractWikilinks(md);
    expect(links).toEqual([
      { targetRaw: "Agência Virtual", targetSlug: "agência virtual" },
      { targetRaw: "CSharp|C#", targetSlug: "csharp" },
      { targetRaw: "Kanban#Desenvolvimento", targetSlug: "kanban" },
      { targetRaw: "2026-11-28", targetSlug: "2026-11-28" },
    ]);
  });

  it("computes heatmap green/red colors matching Log Anual.md thresholds", () => {
    expect(computeHeatmapColorAndIntensity(84)).toEqual({
      color: "green",
      intensity: 84,
    });
    expect(computeHeatmapColorAndIntensity(75)).toEqual({
      color: "green",
      intensity: 75,
    });
    expect(computeHeatmapColorAndIntensity(59)).toEqual({
      color: "red",
      intensity: 41,
    });
    expect(computeHeatmapColorAndIntensity(null)).toEqual({
      color: "empty",
      intensity: 0,
    });
  });

  it("combines Samsung Health auto values with manual overrides cleanly", () => {
    const autoHealth = {
      date: "2026-11-28",
      sleepMinutes: 460,
      sleepScore: 83,
      didGym: true,
      didCardio: false,
      exerciseCount: 1,
      exerciseMinutes: 55,
      caloriesKcal: 310,
      exerciseLabels: ["WEIGHT_MACHINE"],
    };

    expect(resolveSleepState(undefined, autoHealth)).toEqual({
      minutes: 460,
      score: 83,
      source: "health_sync",
    });

    expect(resolveHabitBoolean(null, autoHealth.didGym)).toEqual({
      value: true,
      source: "auto",
      autoValue: true,
    });

    expect(resolveHabitBoolean(1, autoHealth.didCardio)).toEqual({
      value: true,
      source: "manual",
      autoValue: false,
    });
  });

  it("nests subtasks under parent tasks and builds Sun..Sat month calendar grid", () => {
    const nested = nestTasksWithSubtasks([
      {
        id: "p1",
        date: "2026-11-04",
        year: 2026,
        month: 11,
        parentId: null,
        title: "Curriculo",
        url: null,
        status: "done",
        source: "daily",
        sortOrder: 0,
        completedAt: null,
        createdAt: "2026-11-04",
        updatedAt: "2026-11-04",
      },
      {
        id: "c1",
        date: "2026-11-04",
        year: 2026,
        month: 11,
        parentId: "p1",
        title: "Modo inglês",
        url: null,
        status: "done",
        source: "daily",
        sortOrder: 1,
        completedAt: null,
        createdAt: "2026-11-04",
        updatedAt: "2026-11-04",
      },
    ]);

    expect(nested).toHaveLength(1);
    expect(nested[0].subtasks).toHaveLength(1);
    expect(nested[0].subtasks[0].title).toBe("Modo inglês");

    const novGrid = buildMonthCalendarGrid("2026-11");
    // 2026-11-01 is Sunday (index 0) and November has 30 days -> 5 weeks
    expect(novGrid[0][0]).toEqual({ date: "2026-11-01", dayNumber: 1 });
    expect(novGrid.length).toBe(5);
    expect(shiftIsoDate("2026-11-01", -1)).toBe("2026-10-31");
    expect(shiftYearMonth("2026-01", -1)).toBe("2025-12");
  });
});
