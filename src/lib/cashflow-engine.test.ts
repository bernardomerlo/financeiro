import { describe, it, expect } from "vitest";
import {
  calculateCashflowProjection,
  calculateCreditCardInstallmentDates,
  classifyLiquidity,
  getLocalTodayIsoDate,
  getTodayIsoDate,
  type CashflowSettings,
} from "./cashflow-engine";
import {
  createSessionToken,
  verifyPassword,
  verifySessionToken,
  TWENTY_HOURS_MS,
} from "./auth";

const baseSettings: CashflowSettings = {
  initialBalance: 6095.16,
  initialBalanceDate: "2026-09-30",
  dailySpendingTarget: 50,
  creditCardClosingDay: 20,
  creditCardDueDay: 27,
  referenceToday: "2026-11-24",
};

describe("CashFlow Engine", () => {
  it("classifies liquidity thresholds strictly according to the business matrix", () => {
    expect(classifyLiquidity(3500).key).toBe("excellent");
    expect(classifyLiquidity(3000).key).toBe("safe");
    expect(classifyLiquidity(2000).key).toBe("safe");
    expect(classifyLiquidity(1999).key).toBe("warning");
    expect(classifyLiquidity(1500).key).toBe("warning");
    expect(classifyLiquidity(1499).key).toBe("critical");
    expect(classifyLiquidity(1000).key).toBe("critical");
    expect(classifyLiquidity(999).key).toBe("danger");
    expect(classifyLiquidity(-150).key).toBe("danger");
  });

  it("calculates credit card invoice due dates before and after closing day", () => {
    const beforeClosing = calculateCreditCardInstallmentDates("2026-11-15", 3, 20, 27);
    expect(beforeClosing).toEqual(["2026-11-27", "2026-12-27", "2027-01-27"]);

    const afterClosing = calculateCreditCardInstallmentDates("2026-11-22", 2, 20, 27);
    expect(afterClosing).toEqual(["2026-12-27", "2027-01-27"]);
  });

  it("calculates Oct 1 balance from Sept 30 initial balance of 6095.16", () => {
    const result = calculateCashflowProjection({
      settings: baseSettings,
      visibleYearMonths: ["2026-10", "2026-11", "2026-12"],
      transactions: [
        {
          id: "t1",
          date: "2026-10-01",
          type: "income",
          amount: 7.98,
          paymentMethod: "cash",
          isSimulation: false,
          isReconciled: true,
        },
        {
          id: "t2",
          date: "2026-10-01",
          type: "expense_fixed",
          amount: 2970.63,
          paymentMethod: "cash",
          isSimulation: false,
          isReconciled: true,
        },
      ],
      dailyOverrides: [
        {
          date: "2026-10-01",
          amount: 27.0,
          isReconciled: true,
        },
      ],
      recurringRules: [],
      recurringOccurrences: [],
      includeSimulations: true,
    });

    expect(result.allDaysMap["2026-10-01"].projectedBalance).toBe(3105.51);
  });

  it("validates password Churrascanca1@ and enforces 20-hour session cache expiry", () => {
    expect(verifyPassword("wrong")).toBe(false);
    expect(verifyPassword("Churrascanca1@")).toBe(true);

    const now = 1_700_000_000_000;
    const { token, expiresAt } = createSessionToken(now);
    expect(expiresAt - now).toBe(TWENTY_HOURS_MS);

    // Valid before 20h
    expect(verifySessionToken(token, now + 1000)).toBe(true);
    expect(verifySessionToken(token, now + TWENTY_HOURS_MS - 1)).toBe(true);

    // Expired at/after 20h
    expect(verifySessionToken(token, now + TWENTY_HOURS_MS)).toBe(false);
    expect(verifySessionToken(token, now + TWENTY_HOURS_MS + 60_000)).toBe(false);
  });

  it("computes dynamic current date respecting America/Sao_Paulo timezone", () => {
    // 2026-11-26 01:30 UTC is still 2026-11-25 22:30 in America/Sao_Paulo (UTC-3)
    const lateNightBr = new Date("2026-11-26T01:30:00Z");
    expect(getTodayIsoDate(lateNightBr, "America/Sao_Paulo")).toBe("2026-11-25");

    // 2026-11-26 03:00 UTC is 2026-11-26 00:00 in America/Sao_Paulo (UTC-3)
    const midnightBr = new Date("2026-11-26T03:00:00Z");
    expect(getTodayIsoDate(midnightBr, "America/Sao_Paulo")).toBe("2026-11-26");

    // Local helper formats YYYY-MM-DD cleanly
    const localDate = new Date(2026, 10, 5, 12, 0, 0);
    expect(getLocalTodayIsoDate(localDate)).toBe("2026-11-05");
  });

  it("dynamically shifts todayRow and past/today/future flags when referenceToday advances", () => {
    const day25 = calculateCashflowProjection({
      settings: { ...baseSettings, referenceToday: "2026-11-25" },
      visibleYearMonths: ["2026-10", "2026-11", "2026-12"],
      transactions: [],
      dailyOverrides: [],
      recurringRules: [],
      recurringOccurrences: [],
      includeSimulations: true,
    });

    expect(day25.todayRow?.date).toBe("2026-11-25");
    expect(day25.allDaysMap["2026-11-24"].isPast).toBe(true);
    expect(day25.allDaysMap["2026-11-25"].isToday).toBe(true);
    expect(day25.allDaysMap["2026-11-26"].isFuture).toBe(true);
  });

  it("sums individual expense_daily transactions per day and projects dailySpendingTarget on empty future days (RN-04, RN-06)", () => {
    const result = calculateCashflowProjection({
      settings: { ...baseSettings, referenceToday: "2026-11-25" },
      visibleYearMonths: ["2026-10", "2026-11", "2026-12"],
      transactions: [
        {
          id: "d1",
          date: "2026-11-25",
          type: "expense_daily",
          amount: 5,
          description: "pao de queijo",
          category: "Alimentação",
          paymentMethod: "cash",
          isSimulation: false,
          isReconciled: true,
        },
        {
          id: "d2",
          date: "2026-11-25",
          type: "expense_daily",
          amount: 25,
          description: "biscoito (sefaz)",
          category: "Alimentação",
          paymentMethod: "cash",
          isSimulation: false,
          isReconciled: true,
        },
      ],
      dailyOverrides: [],
      recurringRules: [],
      recurringOccurrences: [],
      includeSimulations: true,
    });

    // Today with 2 daily transactions (5 + 25 = 30), must NOT add the 50 target on top
    expect(result.allDaysMap["2026-11-25"].dailyAmount).toBe(30);
    // Past day without transactions has 0 dailyAmount
    expect(result.allDaysMap["2026-11-24"].dailyAmount).toBe(0);
    // Future day without transactions projects the 50.00 dailySpendingTarget
    expect(result.allDaysMap["2026-12-01"].dailyAmount).toBe(50);
  });

  it("supports moving and incrementing Diário, Saída, and Entrada across dates (RN-12)", () => {
    const result = calculateCashflowProjection({
      settings: { ...baseSettings, referenceToday: "2026-11-26" },
      visibleYearMonths: ["2026-10", "2026-11", "2026-12"],
      transactions: [
        // Future day 2026-11-27 had its Diário moved to 2026-11-28 (leaving a 0-amount marker on 27/11)
        {
          id: "tx_daily_zero_2026-11-27",
          date: "2026-11-27",
          type: "expense_daily",
          amount: 0,
          description: "Diário movido",
          paymentMethod: "cash",
          isSimulation: false,
          isReconciled: true,
        },
        {
          id: "tx_target_28",
          date: "2026-11-28",
          type: "expense_daily",
          amount: 50,
          description: "Meta Diária",
          paymentMethod: "cash",
          isSimulation: false,
          isReconciled: true,
        },
        {
          id: "tx_moved_from_27",
          date: "2026-11-28",
          type: "expense_daily",
          amount: 50,
          description: "Diário (27/11)",
          paymentMethod: "cash",
          isSimulation: false,
          isReconciled: true,
        },
      ],
      dailyOverrides: [],
      recurringRules: [],
      recurringOccurrences: [],
      includeSimulations: true,
    });

    // Source future day stays at 0 (and does not show dummy 0 item in items list)
    expect(result.allDaysMap["2026-11-27"].dailyAmount).toBe(0);
    expect(result.allDaysMap["2026-11-27"].items).toHaveLength(0);
    // Target future day is incremented to 50 + 50 = 100
    expect(result.allDaysMap["2026-11-28"].dailyAmount).toBe(100);
    expect(result.allDaysMap["2026-11-28"].items).toHaveLength(2);
  });
});
