"use client";

import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#f6f9f7] p-4">
      <div className="max-w-md w-full bg-white p-6 rounded-xl border border-[#dce4df] shadow-lg text-center space-y-4">
        <div className="w-10 h-10 rounded-full bg-[#ffebee] text-[#b71c1c] flex items-center justify-center mx-auto">
          <AlertTriangle className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-base font-bold text-[#0f1f14]">
            Falha ao sincronizar com o banco Turso
          </h2>
          <p className="text-xs text-[#5c7063] mt-1">
            {error.message || "Não foi possível carregar os lançamentos do fluxo de caixa."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => reset()}
          className="h-9 px-4 rounded-lg bg-[#1b6b3a] hover:bg-[#14532d] text-white text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Tentar Novamente</span>
        </button>
      </div>
    </div>
  );
}
