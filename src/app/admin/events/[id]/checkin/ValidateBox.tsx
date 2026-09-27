"use client";

import { useActionState, useEffect, useRef } from "react";
import type { ValidateState } from "./actions";

export function ValidateBox({ action }: { action: (prev: ValidateState, form: FormData) => Promise<ValidateState> }) {
  const [state, formAction, pending] = useActionState(action, {});
  const input = useRef<HTMLInputElement>(null);

  // Depois de cada validação o campo volta limpo e focado, pronto para o próximo (inclusive leitor USB).
  useEffect(() => {
    if (!state.at || !input.current) return;
    input.current.value = "";
    input.current.focus();
  }, [state.at]);

  const r = state.result;
  return (
    <div className="bo-card">
      <h2>Validar entrada</h2>
      <form action={formAction} className="bo-actions">
        <input
          ref={input}
          name="entry"
          className="bo-input bo-entry"
          placeholder="Código (ex.: 7K4M) ou conteúdo do QR"
          autoComplete="off"
          autoCapitalize="characters"
          autoFocus
          required
        />
        <button className="bo-btn bo-btn-primary" disabled={pending}>
          {pending ? "Validando…" : "Validar"}
        </button>
      </form>
      {r && (
        <div className={`bo-result ${r.ok ? "ok" : "no"}`} role="status" aria-live="assertive">
          {r.ok ? (
            <>
              <b>✓ Entrada liberada</b>
              <span>
                {r.buyer} · {r.lot}
                {r.seat ? ` · Poltrona ${r.seat}` : ""} · código {r.code}
              </span>
            </>
          ) : (
            <>
              <b>✕ {r.reason === "used" ? "Já utilizado" : r.reason === "canceled" ? "Ingresso cancelado" : "Ingresso inválido"}</b>
              <span>
                {r.reason === "used" && r.usedAt
                  ? `Validado às ${new Date(r.usedAt).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })} por ${r.usedBy ?? "—"}`
                  : r.message}
              </span>
            </>
          )}
        </div>
      )}
      <p className="bo-hint" style={{ marginTop: 10 }}>
        O leitor de QR por câmera é o webapp do celular (Fase 3). Aqui dá para digitar o código ou usar um leitor USB, que &quot;digita&quot; o QR e aperta Enter.
      </p>
    </div>
  );
}
