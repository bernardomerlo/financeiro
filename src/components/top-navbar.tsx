"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Plus,
  FlaskConical,
  BarChart3,
  Table2,
  CalendarClock,
  SlidersHorizontal,
  Download,
  Command,
} from "lucide-react";
import { useCashflowStore } from "@/store/use-cashflow-store";
import { addMonthsToYearMonth, classifyLiquidity, formatMonthTitle } from "@/lib/cashflow-engine";
import { formatBRL } from "@/lib/format";
import { KeyboardShortcutsAndPalette } from "./keyboard-shortcuts-and-palette";

interface TopNavbarProps {
  currentBalance: number;
  projectedEndOfMonth: number;
  projectedQuarterEnd?: number;
  simulationImpact?: number;
  onExportCSV?: () => void;
}

export function TopNavbar({
  currentBalance,
  projectedEndOfMonth,
  projectedQuarterEnd,
  simulationImpact = 0,
  onExportCSV,
}: TopNavbarProps) {
  const pathname = usePathname();

  const {
    settings,
    centerYearMonth,
    navigateMonths,
    resetToCurrentQuarter,
    openLaunchModal,
    setSettingsModalOpen,
    setRecurringModalOpen,
    setCommandPaletteOpen,
    stagedTransactions,
    stagedOverrides,
  } = useCashflowStore();

  const prevYM = addMonthsToYearMonth(centerYearMonth, -1);
  const nextYM = addMonthsToYearMonth(centerYearMonth, 1);

  const shortMonth = (ym: string) => {
    const [mName] = formatMonthTitle(ym).split(" ");
    return mName.slice(0, 3);
  };
  const centerYear = centerYearMonth.split("-")[0];
  const quarterLabel = `${shortMonth(prevYM)} • ${shortMonth(centerYearMonth)} • ${shortMonth(nextYM)} ${centerYear}`;

  const todayLiquidity = classifyLiquidity(currentBalance);
  const endLiquidity = classifyLiquidity(projectedEndOfMonth);
  const pendingCount = stagedTransactions.length + stagedOverrides.length;

  return (
    <>
      <KeyboardShortcutsAndPalette />
      <header className="h-11 bg-white border-b border-[#d8e0da] px-3 flex items-center justify-between gap-2 select-none shrink-0 z-30">
        {/* Left: Animated Tabs (Aceternity layoutId style) & Quarter Navigator */}
        <div className="flex items-center gap-2">
          <nav className="relative flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
            {[
              { href: "/", label: "Fluxo", icon: Table2 },
              { href: "/insights", label: "Metas", icon: BarChart3 },
            ].map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`relative px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors z-10 ${
                    isActive ? "text-[#141f17]" : "text-[#4e6153] hover:text-[#141f17]"
                  }`}
                >
                  {isActive && (
                    <motion.span
                      layoutId="top-nav-active-pill"
                      transition={{ type: "spring", stiffness: 420, damping: 32 }}
                      className="absolute inset-0 bg-white rounded-md shadow-2xs border border-[#d5ded8]/80 -z-10"
                    />
                  )}
                  <Icon className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>{tab.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center bg-[#eff3f0] border border-[#d5ded8] rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => navigateMonths(-1)}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white text-[#4e6153] hover:text-[#141f17] transition-colors cursor-pointer"
              aria-label="Mês anterior"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={resetToCurrentQuarter}
              className="px-2.5 h-6 text-xs font-semibold text-[#141f17] hover:text-[#2d6a3e] transition-colors cursor-pointer"
            >
              {quarterLabel}
            </button>
            <button
              type="button"
              onClick={() => navigateMonths(1)}
              className="w-6 h-6 flex items-center justify-center rounded-md hover:bg-white text-[#4e6153] hover:text-[#141f17] transition-colors cursor-pointer"
              aria-label="Próximo mês"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Center: Live Balances with Untitled UI status rings */}
        <div className="hidden lg:flex items-center gap-2 text-xs tabular-nums">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8]">
            <span
              className="w-2 h-2 rounded-full ring-3 ring-current/15"
              style={{ backgroundColor: todayLiquidity.hex, color: todayLiquidity.hex }}
            />
            <span className="text-[#526657] font-medium">Hoje:</span>
            <span className="font-bold text-[#141f17]">{formatBRL(currentBalance)}</span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8]">
            <span
              className="w-2 h-2 rounded-full ring-3 ring-current/15"
              style={{ backgroundColor: endLiquidity.hex, color: endLiquidity.hex }}
            />
            <span className="text-[#526657] font-medium">Fim Mês:</span>
            <span className="font-bold text-[#141f17]">{formatBRL(projectedEndOfMonth)}</span>
            {simulationImpact !== 0 && (
              <span className="text-[11px] font-semibold text-[#7c5800] bg-[#fff3cd] px-1.5 py-0.2 rounded border border-[#ffe69c]">
                {formatBRL(simulationImpact, true)}
              </span>
            )}
          </div>

          {projectedQuarterEnd !== undefined && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8]">
              <span className="text-[#526657] font-medium">Fim Trimestre:</span>
              <span className="font-bold text-[#141f17]">{formatBRL(projectedQuarterEnd)}</span>
            </div>
          )}
        </div>

        {/* Right: Dev Command Palette + Actions with <kbd> badges */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setCommandPaletteOpen(true)}
            className="hidden md:flex h-7 px-2 rounded-lg border border-[#d5ded8] bg-[#f8faf8] hover:bg-[#eff3f0] text-[#4e6153] items-center gap-1.5 text-xs font-medium transition-colors cursor-pointer"
            title="Command Palette (Ctrl+K)"
          >
            <Command className="w-3 h-3 text-[#2d6a3e]" />
            <kbd className="text-[10px] font-semibold text-[#526657]">Ctrl K</kbd>
          </button>

          {onExportCSV && (
            <button
              type="button"
              onClick={onExportCSV}
              className="hidden xl:flex h-7 px-2 rounded-lg border border-[#d5ded8] bg-white hover:bg-[#eff3f0] text-[#141f17] items-center gap-1 text-xs font-medium cursor-pointer"
              title="Exportar CSV"
            >
              <Download className="w-3.5 h-3.5 text-[#4e6153]" />
              <span>CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setRecurringModalOpen(true)}
            className="h-7 px-2.5 rounded-lg border border-[#d5ded8] bg-white hover:bg-[#eff3f0] text-[#141f17] flex items-center gap-1 text-xs font-medium cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5 text-[#2d6a3e]" />
            <span className="hidden sm:inline">Fixos</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            className="h-7 px-2.5 rounded-lg border border-[#d5ded8] bg-white hover:bg-[#eff3f0] text-[#141f17] flex items-center gap-1 text-xs font-medium cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#4e6153]" />
            <span className="hidden sm:inline">Config</span>
          </button>

          <button
            type="button"
            onClick={() =>
              openLaunchModal({
                date: settings.referenceToday,
                isSimulation: true,
                type: "expense_fixed",
              })
            }
            className="h-7 px-2.5 rounded-lg border border-[#d9c27e] bg-[#fdf6e2] hover:bg-[#faeec9] text-[#5c4300] flex items-center gap-1 text-xs font-semibold cursor-pointer active:scale-[0.98] transition-transform"
          >
            <FlaskConical className="w-3.5 h-3.5" />
            <span>Simular</span>
            {pendingCount > 0 && (
              <span className="px-1.5 rounded-full bg-[#5c4300] text-white text-[10px]">
                {pendingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() =>
              openLaunchModal({
                date: settings.referenceToday,
                isSimulation: false,
                type: "expense_fixed",
              })
            }
            className="h-7 px-2.5 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] text-white flex items-center gap-1.5 text-xs font-semibold cursor-pointer active:scale-[0.98] transition-transform"
            title="Nova Saída Hoje (Ctrl+N)"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Lançar</span>
            <kbd className="hidden sm:inline-block px-1 py-0.2 text-[9px] rounded bg-white/15 text-white/90 border border-white/20">
              Ctrl N
            </kbd>
          </button>
        </div>
      </header>
    </>
  );
}
