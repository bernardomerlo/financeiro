export type LiquidityTierKey = "excellent" | "safe" | "warning" | "critical" | "danger";

export interface LiquidityTierInfo {
  key: LiquidityTierKey;
  label: string;
  shortLabel: string;
  hex: string;
  bgClass: string;
  textClass: string;
  borderClass: string;
  badgeClass: string;
}

export interface CashflowSettings {
  initialBalance: number;
  initialBalanceDate: string; // 'YYYY-MM-DD'
  dailySpendingTarget: number;
  creditCardClosingDay: number;
  creditCardDueDay: number;
  referenceToday: string; // 'YYYY-MM-DD'
}

export interface TransactionRecord {
  id: string;
  date: string; // 'YYYY-MM-DD' (effective cash disbursement date)
  type: "income" | "expense_fixed" | "expense_daily";
  amount: number;
  description?: string | null;
  category?: string | null;
  paymentMethod: "cash" | "credit_card";
  purchaseDate?: string | null;
  isSimulation: boolean;
  isReconciled: boolean;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  installmentGroupId?: string | null;
  recurringRuleId?: string | null;
  isInMemory?: boolean;
}

export interface DailyOverrideRecord {
  date: string; // 'YYYY-MM-DD'
  amount: number;
  note?: string | null;
  isReconciled: boolean;
  isInMemory?: boolean;
}

export interface RecurringRuleRecord {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense_fixed";
  category?: string | null;
  dayOfMonth: number;
  paymentMethod: "cash" | "credit_card";
  isActive: boolean;
}

export interface RecurringOccurrenceRecord {
  id: string; // `${ruleId}_${yyyy-mm}`
  ruleId: string;
  yearMonth: string; // 'YYYY-MM'
  status: "confirmed" | "skipped" | "modified";
  modifiedAmount?: number | null;
}

export interface DayLineItem {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense_fixed" | "expense_daily";
  category?: string | null;
  source: "transaction" | "recurring" | "simulation";
  isReconciled: boolean;
  isInMemory?: boolean;
  installmentLabel?: string;
  recurringRuleId?: string;
  yearMonth?: string;
}

export interface ComputedDayRow {
  date: string; // 'YYYY-MM-DD'
  dayOfMonth: number;
  monthKey: string; // 'YYYY-MM'
  isToday: boolean;
  isPast: boolean;
  isFuture: boolean;
  incomeTotal: number;
  fixedExpenseTotal: number;
  simulatedExpenseTotal: number;
  simulatedIncomeTotal: number;
  dailyAmount: number;
  dailyTarget: number;
  dailyDeviation: number; // dailyAmount - dailyTarget (positive means spent more than target)
  isDailyOverridden: boolean;
  dailyNote?: string | null;
  isReconciled: boolean;
  realBalance: number;
  projectedBalance: number;
  liquidity: LiquidityTierInfo;
  realLiquidity: LiquidityTierInfo;
  items: DayLineItem[];
  hasSimulation: boolean;
}

export interface ComputedMonthColumn {
  yearMonth: string; // 'YYYY-MM'
  year: number;
  month: number; // 1-12
  title: string; // e.g., 'NOVEMBRO 2026'
  roleLabel: string; // 'MÊS ANTERIOR' | 'MÊS VIGENTE' | 'PRÓXIMO MÊS' | 'PROJEÇÃO'
  isCurrentMonth: boolean;
  days: ComputedDayRow[];
  totalIncome: number;
  totalFixedExpense: number;
  totalDailySpend: number;
  endingBalance: number;
  endingRealBalance: number;
  reconciledDaysCount: number;
  lowestBalanceDay: ComputedDayRow | null;
}

export const LIQUIDITY_TIERS: Record<LiquidityTierKey, LiquidityTierInfo> = {
  excellent: {
    key: "excellent",
    label: "> R$ 3.000",
    shortLabel: "> 3.000",
    hex: "#38761d",
    bgClass: "bg-[#6aa84f] text-white",
    textClass: "text-white",
    borderClass: "border-[#568e3d]",
    badgeClass: "bg-[#e8f5e9] text-[#1b5e20] border-[#a5d6a7]",
  },
  safe: {
    key: "safe",
    label: "R$ 2k - 3k",
    shortLabel: "2k - 3k",
    hex: "#6aa84f",
    bgClass: "bg-[#93c47d] text-[#122b0a]",
    textClass: "text-[#122b0a]",
    borderClass: "border-[#7eb368]",
    badgeClass: "bg-[#f1f8e9] text-[#33691e] border-[#c5e1a5]",
  },
  warning: {
    key: "warning",
    label: "R$ 1,5k - 2k",
    shortLabel: "1.5k - 2k",
    hex: "#ffd966",
    bgClass: "bg-[#ffd966] text-[#473500]",
    textClass: "text-[#473500]",
    borderClass: "border-[#f1c232]",
    badgeClass: "bg-[#fffde7] text-[#7f5f00] border-[#fff176]",
  },
  critical: {
    key: "critical",
    label: "R$ 1k - 1,5k",
    shortLabel: "1k - 1.5k",
    hex: "#ff9900",
    bgClass: "bg-[#ff9900] text-[#331f00]",
    textClass: "text-[#331f00]",
    borderClass: "border-[#e68a00]",
    badgeClass: "bg-[#fff3e0] text-[#8c3d00] border-[#ffcc80]",
  },
  danger: {
    key: "danger",
    label: "< R$ 1.000",
    shortLabel: "< 999",
    hex: "#cc0000",
    bgClass: "bg-[#e06666] text-white",
    textClass: "text-white",
    borderClass: "border-[#cc0000]",
    badgeClass: "bg-[#ffebee] text-[#8e1414] border-[#ef9a9a]",
  },
};

export function classifyLiquidity(balance: number): LiquidityTierInfo {
  if (balance > 3000) return LIQUIDITY_TIERS.excellent;
  if (balance >= 2000) return LIQUIDITY_TIERS.safe;
  if (balance >= 1500) return LIQUIDITY_TIERS.warning;
  if (balance >= 1000) return LIQUIDITY_TIERS.critical;
  return LIQUIDITY_TIERS.danger;
}

export function getDaysInMonth(year: number, month1To12: number): number {
  return new Date(year, month1To12, 0).getDate();
}

export const DEFAULT_TIMEZONE = "America/Sao_Paulo";

export function formatIsoDate(year: number, month1To12: number, day: number): string {
  const m = String(month1To12).padStart(2, "0");
  const d = String(day).padStart(2, "0");
  return `${year}-${m}-${d}`;
}

export function getLocalTodayIsoDate(date: Date = new Date()): string {
  return formatIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
}

export function getTodayIsoDate(
  date: Date = new Date(),
  timeZone: string = DEFAULT_TIMEZONE
): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    if (year && month && day) {
      return `${year}-${month}-${day}`;
    }
  } catch {
    // Fallback to runtime local date if timezone formatting is unavailable
  }
  return getLocalTodayIsoDate(date);
}

export function addMonthsToYearMonth(yearMonth: string, deltaMonths: number): string {
  const [yStr, mStr] = yearMonth.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  const totalMonths = y * 12 + (m - 1) + deltaMonths;
  const newY = Math.floor(totalMonths / 12);
  const newM = (totalMonths % 12) + 1;
  return `${newY}-${String(newM).padStart(2, "0")}`;
}

const MONTH_NAMES_PT = [
  "JANEIRO",
  "FEVEREIRO",
  "MARÇO",
  "ABRIL",
  "MAIO",
  "JUNHO",
  "JULHO",
  "AGOSTO",
  "SETEMBRO",
  "OUTUBRO",
  "NOVEMBRO",
  "DEZEMBRO",
];

export function formatMonthTitle(yearMonth: string): string {
  const [yStr, mStr] = yearMonth.split("-");
  const mIdx = Number(mStr) - 1;
  return `${MONTH_NAMES_PT[mIdx] || mStr} ${yStr}`;
}

/**
 * Calculates the exact invoice disbursement dates for a credit card purchase.
 * If purchase day <= closingDay: first installment hits the due date of the current cycle.
 * If purchase day > closingDay: first installment shifts to the next billing cycle (+1 month).
 */
export function calculateCreditCardInstallmentDates(
  purchaseDateIso: string,
  installments: number,
  closingDay: number,
  dueDay: number
): string[] {
  const [yStr, mStr, dStr] = purchaseDateIso.split("-");
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  // Base cycle offset: if dueDay < closingDay, the due date for a cycle closing in month M is in month M+1.
  const baseDueOffset = dueDay < closingDay ? 1 : 0;
  // If purchase happened after closingDay, it enters the next cycle (+1 month).
  const afterClosingOffset = day > closingDay ? 1 : 0;
  const firstInstallmentMonthOffset = baseDueOffset + afterClosingOffset;

  const baseYearMonth = `${year}-${String(month).padStart(2, "0")}`;
  const dates: string[] = [];

  for (let i = 0; i < Math.max(1, installments); i++) {
    const targetYM = addMonthsToYearMonth(baseYearMonth, firstInstallmentMonthOffset + i);
    const [tY, tM] = targetYM.split("-").map(Number);
    const maxDay = getDaysInMonth(tY, tM);
    const clampedDueDay = Math.min(dueDay, maxDay);
    dates.push(formatIsoDate(tY, tM, clampedDueDay));
  }

  return dates;
}

export interface CalculateCashflowInput {
  settings: CashflowSettings;
  visibleYearMonths: [string, string, string]; // e.g. ['2026-10', '2026-11', '2026-12']
  transactions: TransactionRecord[];
  dailyOverrides: DailyOverrideRecord[];
  recurringRules: RecurringRuleRecord[];
  recurringOccurrences: RecurringOccurrenceRecord[];
  includeSimulations: boolean;
}

export interface CalculateCashflowOutput {
  months: [ComputedMonthColumn, ComputedMonthColumn, ComputedMonthColumn];
  allDaysMap: Record<string, ComputedDayRow>;
  todayRow: ComputedDayRow | null;
  currentMonthEndRow: ComputedDayRow | null;
  quarterEndRow: ComputedDayRow | null;
  totalSimulationImpactOnCurrentMonth: number;
  totalSimulationImpactOnQuarter: number;
}

export function calculateCashflowProjection(input: CalculateCashflowInput): CalculateCashflowOutput {
  const {
    settings,
    visibleYearMonths,
    transactions,
    dailyOverrides,
    recurringRules,
    recurringOccurrences,
    includeSimulations,
  } = input;

  const todayIso = settings.referenceToday;
  const todayYM = todayIso.slice(0, 7);

  // Determine full chronological range of months from earliest of initialBalanceDate or visibleYearMonths[0]
  // to latest of visibleYearMonths[2] or todayYM
  const anchorYM = settings.initialBalanceDate.slice(0, 7);
  const startYM = [anchorYM, visibleYearMonths[0], todayYM].sort()[0];
  const endYM = [anchorYM, visibleYearMonths[2], todayYM].sort()[2];

  // Index transactions by date
  const txByDate = new Map<string, TransactionRecord[]>();
  for (const tx of transactions) {
    const list = txByDate.get(tx.date) || [];
    list.push(tx);
    txByDate.set(tx.date, list);
  }

  // Index daily overrides by date
  const overridesByDate = new Map<string, DailyOverrideRecord>();
  for (const ov of dailyOverrides) {
    overridesByDate.set(ov.date, ov);
  }

  // Index recurring occurrences by `${ruleId}_${yearMonth}`
  const occByKey = new Map<string, RecurringOccurrenceRecord>();
  for (const occ of recurringOccurrences) {
    occByKey.set(`${occ.ruleId}_${occ.yearMonth}`, occ);
  }

  const activeRules = recurringRules.filter((r) => r.isActive);

  let runningRealBalance = settings.initialBalance;
  let runningProjectedBalance = settings.initialBalance;

  const allDaysMap: Record<string, ComputedDayRow> = {};
  const computedMonthsMap = new Map<string, ComputedMonthColumn>();

  let cursorYM = startYM;
  while (cursorYM <= endYM) {
    const [y, m] = cursorYM.split("-").map(Number);
    const daysCount = getDaysInMonth(y, m);
    const monthDays: ComputedDayRow[] = [];

    let monthIncome = 0;
    let monthFixedOut = 0;
    let monthDailyOut = 0;
    let reconciledCount = 0;
    let lowestBalanceDay: ComputedDayRow | null = null;

    for (let d = 1; d <= daysCount; d++) {
      const dateIso = formatIsoDate(y, m, d);
      const isOnOrBeforeAnchor = dateIso <= settings.initialBalanceDate;
      const isToday = dateIso === todayIso;
      const isPast = dateIso < todayIso;
      const isFuture = dateIso > todayIso;

      const items: DayLineItem[] = [];
      let realIncome = 0;
      let realFixedOut = 0;
      let simIncome = 0;
      let simFixedOut = 0;
      let extraRealDaily = 0;
      let extraSimDaily = 0;

      if (!isOnOrBeforeAnchor) {
        // 1. Recurring rules for this day of month
        for (const rule of activeRules) {
          const effectiveRuleDay = Math.min(rule.dayOfMonth, daysCount);
          if (effectiveRuleDay === d) {
            const occKey = `${rule.id}_${cursorYM}`;
            const occ = occByKey.get(occKey);
            if (occ?.status === "skipped") {
              continue;
            }
            const amount = occ?.status === "modified" && occ.modifiedAmount != null ? occ.modifiedAmount : rule.amount;
            if (rule.type === "income") {
              realIncome += amount;
            } else {
              realFixedOut += amount;
            }
            items.push({
              id: `rec_${rule.id}_${dateIso}`,
              title: rule.title,
              amount,
              type: rule.type,
              category: rule.category,
              source: "recurring",
              isReconciled: isPast || isToday || occ?.status === "confirmed",
              recurringRuleId: rule.id,
              yearMonth: cursorYM,
            });
          }
        }

        // 2. Direct & Credit Card Transactions
        const dayTxs = txByDate.get(dateIso) || [];
        for (const tx of dayTxs) {
          const installmentLabel =
            tx.installmentTotal && tx.installmentTotal > 1
              ? `${tx.installmentCurrent}/${tx.installmentTotal}`
              : undefined;

          if (tx.isSimulation) {
            if (tx.type === "income") {
              simIncome += tx.amount;
            } else if (tx.type === "expense_daily") {
              extraSimDaily += tx.amount;
            } else {
              simFixedOut += tx.amount;
            }
            items.push({
              id: tx.id,
              title: tx.description || tx.category || "Simulação",
              amount: tx.amount,
              type: tx.type,
              category: tx.category,
              source: "simulation",
              isReconciled: false,
              isInMemory: tx.isInMemory,
              installmentLabel,
            });
          } else {
            if (tx.type === "income") {
              realIncome += tx.amount;
            } else if (tx.type === "expense_daily") {
              extraRealDaily += tx.amount;
            } else {
              realFixedOut += tx.amount;
            }
            items.push({
              id: tx.id,
              title: tx.description || tx.category || (tx.type === "income" ? "Entrada" : "Saída"),
              amount: tx.amount,
              type: tx.type,
              category: tx.category,
              source: "transaction",
              isReconciled: tx.isReconciled,
              isInMemory: tx.isInMemory,
              installmentLabel,
            });
          }
        }
      }

      // 3. Daily spending (DIÁRIO column)
      const override = overridesByDate.get(dateIso);
      const baseDaily = isOnOrBeforeAnchor
        ? 0
        : override !== undefined
        ? override.amount
        : settings.dailySpendingTarget;

      const realDailyAmount = baseDaily + extraRealDaily;
      const effectiveDailyAmount = realDailyAmount + (includeSimulations ? extraSimDaily : 0);

      // 4. Cascade running balance
      if (!isOnOrBeforeAnchor) {
        runningRealBalance = Number(
          (runningRealBalance + realIncome - realFixedOut - realDailyAmount).toFixed(2)
        );
        const activeSimIn = includeSimulations ? simIncome : 0;
        const activeSimOut = includeSimulations ? simFixedOut + extraSimDaily : 0;
        runningProjectedBalance = Number(
          (runningProjectedBalance + realIncome + activeSimIn - realFixedOut - activeSimOut - realDailyAmount).toFixed(2)
        );
      }

      const displayIncome = realIncome + (includeSimulations ? simIncome : 0);
      const displayFixedOut = realFixedOut + (includeSimulations ? simFixedOut : 0);
      const isDayReconciled = isPast || (isToday && override !== undefined);

      if (isDayReconciled) {
        reconciledCount++;
      }

      const row: ComputedDayRow = {
        date: dateIso,
        dayOfMonth: d,
        monthKey: cursorYM,
        isToday,
        isPast,
        isFuture,
        incomeTotal: Number(displayIncome.toFixed(2)),
        fixedExpenseTotal: Number(displayFixedOut.toFixed(2)),
        simulatedExpenseTotal: Number((simFixedOut + extraSimDaily).toFixed(2)),
        simulatedIncomeTotal: Number(simIncome.toFixed(2)),
        dailyAmount: Number(effectiveDailyAmount.toFixed(2)),
        dailyTarget: settings.dailySpendingTarget,
        dailyDeviation: Number((effectiveDailyAmount - settings.dailySpendingTarget).toFixed(2)),
        isDailyOverridden: override !== undefined || extraRealDaily > 0 || extraSimDaily > 0,
        dailyNote: override?.note,
        isReconciled: isDayReconciled,
        realBalance: runningRealBalance,
        projectedBalance: runningProjectedBalance,
        liquidity: classifyLiquidity(runningProjectedBalance),
        realLiquidity: classifyLiquidity(runningRealBalance),
        items,
        hasSimulation: simIncome > 0 || simFixedOut > 0 || extraSimDaily > 0 || Boolean(override?.isInMemory),
      };

      allDaysMap[dateIso] = row;
      monthDays.push(row);

      monthIncome += row.incomeTotal;
      monthFixedOut += row.fixedExpenseTotal;
      monthDailyOut += row.dailyAmount;

      if (!lowestBalanceDay || row.projectedBalance < lowestBalanceDay.projectedBalance) {
        lowestBalanceDay = row;
      }
    }

    const isCurrentMonth = cursorYM === todayYM;
    let roleLabel = "PROJEÇÃO";
    if (cursorYM === addMonthsToYearMonth(todayYM, -1)) roleLabel = "MÊS ANTERIOR";
    else if (isCurrentMonth) roleLabel = "MÊS VIGENTE";
    else if (cursorYM === addMonthsToYearMonth(todayYM, 1)) roleLabel = "PRÓXIMO MÊS";
    else if (cursorYM < todayYM) roleLabel = "HISTÓRICO";

    const lastDay = monthDays[monthDays.length - 1];
    computedMonthsMap.set(cursorYM, {
      yearMonth: cursorYM,
      year: y,
      month: m,
      title: formatMonthTitle(cursorYM),
      roleLabel,
      isCurrentMonth,
      days: monthDays,
      totalIncome: Number(monthIncome.toFixed(2)),
      totalFixedExpense: Number(monthFixedOut.toFixed(2)),
      totalDailySpend: Number(monthDailyOut.toFixed(2)),
      endingBalance: lastDay ? lastDay.projectedBalance : runningProjectedBalance,
      endingRealBalance: lastDay ? lastDay.realBalance : runningRealBalance,
      reconciledDaysCount: reconciledCount,
      lowestBalanceDay,
    });

    cursorYM = addMonthsToYearMonth(cursorYM, 1);
  }

  const visibleColumns = visibleYearMonths.map((ym) => {
    const col = computedMonthsMap.get(ym);
    if (!col) {
      throw new Error(`Month ${ym} was not computed in range ${startYM}..${endYM}`);
    }
    return col;
  }) as [ComputedMonthColumn, ComputedMonthColumn, ComputedMonthColumn];

  const todayRow = allDaysMap[todayIso] || null;
  const currentMonthCol = computedMonthsMap.get(todayYM) || visibleColumns[1];
  const currentMonthEndRow =
    currentMonthCol.days[currentMonthCol.days.length - 1] || null;
  const quarterEndCol = visibleColumns[2];
  const quarterEndRow =
    quarterEndCol.days[quarterEndCol.days.length - 1] || null;

  const totalSimulationImpactOnCurrentMonth = currentMonthEndRow
    ? Number((currentMonthEndRow.projectedBalance - currentMonthEndRow.realBalance).toFixed(2))
    : 0;

  const totalSimulationImpactOnQuarter = quarterEndRow
    ? Number((quarterEndRow.projectedBalance - quarterEndRow.realBalance).toFixed(2))
    : 0;

  return {
    months: visibleColumns,
    allDaysMap,
    todayRow,
    currentMonthEndRow,
    quarterEndRow,
    totalSimulationImpactOnCurrentMonth,
    totalSimulationImpactOnQuarter,
  };
}
