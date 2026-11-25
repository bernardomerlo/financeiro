import { describe, it, expect } from "vitest";
import {
  calculateCashflowProjection,
  calculateCreditCardInstallmentDates,
  classifyLiquidity,
  type CashflowSettings,
} from "./cashflow-engine";

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
});
