import React from "react";

export default function Loading() {
  return (
    <div className="h-dvh flex flex-col bg-[#f6f9f7] p-4 gap-3 overflow-hidden">
      <div className="h-12 bg-white rounded-lg border border-[#dce4df] animate-pulse" />
      <div className="h-14 grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-[#dce4df] animate-pulse" />
        <div className="bg-white rounded-lg border border-[#dce4df] animate-pulse" />
        <div className="bg-white rounded-lg border border-[#dce4df] animate-pulse" />
      </div>
      <div className="flex-1 bg-white rounded-xl border border-[#dce4df] grid grid-cols-3 divide-x divide-[#dce4df] overflow-hidden">
        {[0, 1, 2].map((col) => (
          <div key={col} className="p-3 space-y-2">
            <div className="h-6 bg-[#edf2ee] rounded animate-pulse" />
            <div className="space-y-1.5">
              {Array.from({ length: 16 }).map((_, idx) => (
                <div key={idx} className="h-4 bg-[#f2f6f3] rounded animate-pulse" />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
