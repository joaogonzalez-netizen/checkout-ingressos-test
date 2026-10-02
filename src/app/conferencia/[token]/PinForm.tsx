"use client";

import { useActionState } from "react";
import { enterDoor, type EnterState } from "./actions";

export function PinForm({ token, eventName }: { token: string; eventName: string }) {
  const [state, action, pending] = useActionState<EnterState, FormData>(enterDoor.bind(null, token), {});
  return (
    <main className="dr dr-center">
      <form action={action} className="dr-card">
        <p className="dr-eyebrow-free">Conferência da portaria</p>
        <h1>{eventName}</h1>
        <label className="dr-field">
          <span>Seu nome</span>
          <input name="name" autoComplete="given-name" placeholder="Ex.: Ana" required minLength={2} maxLength={60} defaultValue={state.name ?? ""} />
        </label>
        <label className="dr-field">
          <span>PIN do evento (6 números)</span>
          <input name="pin" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} placeholder="000000" required className="dr-pin" />
        </label>
        {state.error && (
          <p className="dr-error" role="alert">
            {state.error}
          </p>
        )}
        <button className="dr-btn dr-btn-primary dr-btn-block" disabled={pending}>
          {pending ? "Entrando…" : "Entrar"}
        </button>
        <p className="dr-hint">O PIN foi passado por quem organiza o evento. Seu nome aparece no registro de cada entrada liberada.</p>
      </form>
    </main>
  );
}
