"use client";

import React, { useState } from "react";
import { FlaskConical, Check, RotateCcw, Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useCashflowStore } from "@/store/use-cashflow-store";
import { commitStagedChangesAction, fetchInitialCashflowData } from "@/app/actions";
import { formatBRL } from "@/lib/format";

interface SimulationFloatingBarProps {
  simulationImpact: number;
}

export function SimulationFloatingBar({ simulationImpact }: SimulationFloatingBarProps) {
  const [isSaving, setIsSaving] = useState(false);
  const {
    stagedTransactions,
    stagedOverrides,
    stagedDeletedTxIds,
    includeSimulations,
    toggleIncludeSimulations,
    discardAllStagedChanges,
    hydrateFromServer,
  } = useCashflowStore();

  const totalPending =
    stagedTransactions.length + stagedOverrides.length + stagedDeletedTxIds.length;

  if (totalPending === 0) return null;

  async function handleCommit() {
    setIsSaving(true);
    try {
      await commitStagedChangesAction({
        stagedTransactions,
        stagedOverrides,
        stagedDeletedTxIds,
      });
      const fresh = await fetchInitialCashflowData();
      discardAllStagedChanges();
      hydrateFromServer(fresh);
      toast.success("Alterações salvas.");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleDiscard() {
    discardAllStagedChanges();
    toast.info("Simulação descartada.");
  }

  return (
    <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-40 max-w-[95vw]">
      <div className="bg-[#141f17] text-white px-3.5 py-2 rounded-lg shadow-lg border border-[#2d4a35] flex items-center gap-3 text-xs tabular-nums">
        <div className="flex items-center gap-2">
          <FlaskConical className="w-3.5 h-3.5 text-[#ffd966]" />
          <span className="font-semibold">
            Simulação ({totalPending}): {formatBRL(simulationImpact, true)}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={toggleIncludeSimulations}
            className="h-7 px-2 rounded bg-white/10 hover:bg-white/20 text-white flex items-center gap-1 cursor-pointer"
          >
            {includeSimulations ? (
              <Eye className="w-3.5 h-3.5 text-[#93c47d]" />
            ) : (
              <EyeOff className="w-3.5 h-3.5 text-[#ffd966]" />
            )}
          </button>

          <button
            type="button"
            onClick={handleDiscard}
            disabled={isSaving}
            className="h-7 px-2.5 rounded bg-white/10 hover:bg-[#cc0000] text-white flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Descartar</span>
          </button>

          <button
            type="button"
            onClick={handleCommit}
            disabled={isSaving}
            className="h-7 px-3 rounded bg-[#38761d] hover:bg-[#2b5c16] text-white font-semibold flex items-center gap-1 cursor-pointer"
          >
            {isSaving ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Check className="w-3.5 h-3.5" />
            )}
            <span>Salvar Alterações</span>
          </button>
        </div>
      </div>
    </div>
  );
}
