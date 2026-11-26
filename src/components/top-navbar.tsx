"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  BarChart3,
  Table2,
  CalendarClock,
  SlidersHorizontal,
  Bell,
} from "lucide-react";
import { useCashflowStore } from "@/store/use-cashflow-store";
import {
  addMonthsToYearMonth,
  classifyLiquidity,
  formatMonthTitle,
  getLocalTodayIsoDate,
} from "@/lib/cashflow-engine";
import { formatBRL, formatFullDate, formatShortDate } from "@/lib/format";
import { fetchMobileNotificationsAction } from "@/app/actions";

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
}: TopNavbarProps) {
  const pathname = usePathname();

  const {
    settings,
    centerYearMonth,
    navigateMonths,
    resetToCurrentQuarter,
    syncCurrentDate,
    setSettingsModalOpen,
    setRecurringModalOpen,
  } = useCashflowStore();

  React.useEffect(() => {
    const syncToday = () => {
      syncCurrentDate(getLocalTodayIsoDate());
    };
    syncToday();
    const interval = window.setInterval(syncToday, 60_000);
    return () => window.clearInterval(interval);
  }, [syncCurrentDate]);

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
  const [pendingNotifCount, setPendingNotifCount] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    const checkPendingNotifs = () => {
      fetchMobileNotificationsAction()
        .then((list) => {
          if (active) {
            setPendingNotifCount(
              list.filter((n) => n.status === "pending").length
            );
          }
        })
        .catch(() => {
          // ignore
        });
    };
    checkPendingNotifs();
    const timer = window.setInterval(checkPendingNotifs, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [pathname]);

  return (
    <>
      {/* MOBILE HEADER: Minimalist */}
      <header className="flex lg:hidden h-12 bg-white border-b border-[#d8e0da] px-3 items-center justify-between gap-2 select-none shrink-0 z-30 sticky top-0">
        <Link href="/" className="flex items-center gap-2 min-w-0">
          <span className="w-7 h-7 rounded-lg bg-[#2d6a3e] text-white flex items-center justify-center shrink-0">
            <Table2 className="w-3.5 h-3.5" />
          </span>
          <div className="min-w-0 leading-tight">
            <div className="text-sm font-bold text-[#141f17] truncate">
              CashFlow
            </div>
            <div className="text-[11px] font-medium text-[#526657]">
              Hoje • {formatShortDate(settings.referenceToday)}
            </div>
          </div>
        </Link>

        <div className="flex items-center gap-1.5 shrink-0">
          <Link
            href="/notificacoes"
            className={`w-9 h-9 rounded-lg border flex items-center justify-center relative ${
              pathname === "/notificacoes"
                ? "border-[#2d6a3e] bg-[#e8f5e9] text-[#1b5e20]"
                : "border-[#d5ded8] bg-[#f8faf8] active:bg-[#eff3f0] text-[#4e6153]"
            }`}
            aria-label="Notificações"
            title="Notificações"
          >
            <Bell className="w-4 h-4 text-[#2d6a3e]" />
            {pendingNotifCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-[#1b5e20] text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                {pendingNotifCount}
              </span>
            )}
          </Link>

          <Link
            href={pathname === "/insights" ? "/" : "/insights"}
            className="w-9 h-9 rounded-lg border border-[#d5ded8] bg-[#f8faf8] active:bg-[#eff3f0] text-[#4e6153] flex items-center justify-center"
            aria-label="Metas"
            title="Metas"
          >
            <BarChart3 className="w-4 h-4 text-[#2d6a3e]" />
          </Link>

          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            className="w-9 h-9 rounded-lg border border-[#d5ded8] bg-white active:bg-[#eff3f0] text-[#4e6153] flex items-center justify-center cursor-pointer"
            aria-label="Configurações"
            title="Configurações"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* DESKTOP HEADER: Clean & direct without extra clutter */}
      <header className="hidden lg:flex h-11 bg-white border-b border-[#d8e0da] px-3 items-center justify-between gap-2 select-none shrink-0 z-30">
        {/* Left: Main Navigation + Quarter Selector */}
        <div className="flex items-center gap-2">
          <nav className="flex items-center bg-[#eff3f0] p-0.5 rounded-lg border border-[#d5ded8]">
            {[
              { href: "/", label: "Fluxo", icon: Table2 },
              { href: "/insights", label: "Dashboards", icon: BarChart3 },
              { href: "/notificacoes", label: "Notificações", icon: Bell },
            ].map((tab) => {
              const isActive = pathname === tab.href;
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-colors ${
                    isActive
                      ? "bg-white text-[#141f17] shadow-2xs border border-[#d5ded8]/80"
                      : "text-[#4e6153] hover:text-[#141f17]"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 text-[#2d6a3e]" />
                  <span>{tab.label}</span>
                  {tab.href === "/notificacoes" && pendingNotifCount > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-[#1b5e20] text-white text-[10px] font-bold tabular-nums">
                      {pendingNotifCount}
                    </span>
                  )}
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

        {/* Center: Live Balances */}
        <div className="hidden lg:flex items-center gap-2 text-xs tabular-nums">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8]"
            title={`Dia atual: ${formatFullDate(settings.referenceToday)}`}
          >
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: todayLiquidity.hex }}
            />
            <span className="text-[#526657] font-medium">Hoje:</span>
            <span className="font-bold text-[#141f17]">
              {formatBRL(currentBalance)}
            </span>
          </div>

          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8]">
            <span
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: endLiquidity.hex }}
            />
            <span className="text-[#526657] font-medium">Fim Mês:</span>
            <span className="font-bold text-[#141f17]">
              {formatBRL(projectedEndOfMonth)}
            </span>
            {simulationImpact !== 0 && (
              <span className="text-[11px] font-semibold text-[#7c5800] bg-[#fff3cd] px-1.5 py-0.2 rounded border border-[#ffe69c]">
                {formatBRL(simulationImpact, true)}
              </span>
            )}
          </div>

          {projectedQuarterEnd !== undefined && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#eff3f0] border border-[#d5ded8]">
              <span className="text-[#526657] font-medium">Fim Trimestre:</span>
              <span className="font-bold text-[#141f17]">
                {formatBRL(projectedQuarterEnd)}
              </span>
            </div>
          )}
        </div>

        {/* Right: Only Essential Actions (Fixos, Config) - RN-01/RN-02 */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setRecurringModalOpen(true)}
            className="h-7 px-2.5 rounded-lg border border-[#d5ded8] bg-white hover:bg-[#eff3f0] text-[#141f17] flex items-center gap-1 text-xs font-medium cursor-pointer"
          >
            <CalendarClock className="w-3.5 h-3.5 text-[#2d6a3e]" />
            <span>Fixos</span>
          </button>

          <button
            type="button"
            onClick={() => setSettingsModalOpen(true)}
            className="h-7 px-2.5 rounded-lg border border-[#d5ded8] bg-white hover:bg-[#eff3f0] text-[#141f17] flex items-center gap-1 text-xs font-medium cursor-pointer"
          >
            <SlidersHorizontal className="w-3.5 h-3.5 text-[#4e6153]" />
            <span>Config</span>
          </button>
        </div>
      </header>
    </>
  );
}
