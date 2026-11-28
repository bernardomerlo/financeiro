"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, Eye, EyeOff, ArrowRight, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { loginWithPasswordAction } from "@/app/actions";
import { AUTH_CACHE_KEY } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(AUTH_CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as { expiresAt?: number; password?: string };
        if (parsed.expiresAt && Date.now() < parsed.expiresAt && parsed.password) {
          // Restore session cookie from valid 20h client cache automatically
          loginWithPasswordAction(parsed.password).then((res) => {
            if (res.ok) {
              router.replace("/");
              router.refresh();
            } else {
              localStorage.removeItem(AUTH_CACHE_KEY);
            }
          });
        } else {
          localStorage.removeItem(AUTH_CACHE_KEY);
        }
      }
    } catch {
      // ignore localStorage errors
    }
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!password) return;

    setIsLoading(true);
    try {
      const res = await loginWithPasswordAction(password);
      if (!res.ok) {
        setError(res.error || "Senha incorreta.");
        toast.error("Senha incorreta.");
        setIsLoading(false);
        return;
      }

      try {
        localStorage.setItem(
          AUTH_CACHE_KEY,
          JSON.stringify({
            expiresAt: res.expiresAt,
            password,
          })
        );
      } catch {
        // ignore storage errors
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Erro ao autenticar.");
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-[#f4f6f4] p-4 select-none">
      <div className="w-full max-w-xs bg-white rounded-xl border border-[#cfd8d2] shadow-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-[#d8e0da] bg-[#eff3f0] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded bg-[#2d6a3e] text-white flex items-center justify-center">
              <Lock className="w-3.5 h-3.5" />
            </span>
            <h1 className="text-sm font-bold text-[#141f17]">Personal Hub</h1>
          </div>
          <span className="text-[11px] font-semibold text-[#526657]">20h Cache</span>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          <div>
            <label
              htmlFor="cf-password"
              className="block text-xs font-semibold text-[#141f17] mb-1.5"
            >
              Senha
            </label>
            <div className="relative flex items-center">
              <input
                id="cf-password"
                type={showPassword ? "text" : "password"}
                required
                autoFocus
                 value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError("");
                }}
                placeholder="••••••••••••"
                className={`w-full h-10 pl-3 pr-9 rounded-lg border text-sm font-medium text-[#141f17] focus:outline-none focus:ring-2 ${
                  error
                    ? "border-[#cc0000] focus:ring-[#cc0000]"
                    : "border-[#c5d1c8] focus:ring-[#2d6a3e]"
                }`}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 p-1 text-[#526657] hover:text-[#141f17] cursor-pointer"
                tabIndex={-1}
                aria-label="Mostrar ou ocultar senha"
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
            {error && (
              <p className="mt-1.5 text-xs font-semibold text-[#cc0000]">{error}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !password}
            className="w-full h-9 rounded-lg bg-[#2d6a3e] hover:bg-[#204f2d] disabled:opacity-50 text-white text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Entrar</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
