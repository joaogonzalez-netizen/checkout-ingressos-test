"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { StepState } from "../../actions";

type Props = {
  action: (prev: StepState, form: FormData) => Promise<StepState>;
  eventId: string;
  step: number;
  children: React.ReactNode;
  /** Campos ocultos derivados do estado do cliente (ex.: JSON dos lotes). */
  hidden?: Record<string, string>;
};

export function StepForm({ action, eventId, step, children, hidden }: Props) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="bo-form">
      {hidden && Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)}
      {children}
      {state.error && <p className="bo-error">{state.error}</p>}
      {state.notice && <p className="bo-warn">{state.notice}</p>}
      {state.saved && !state.notice && <p className="bo-success">Rascunho salvo.</p>}
      <div className="bo-wizard-foot">
        {step > 1 ? (
          <Link href={`/admin/events/${eventId}/edit/${step - 1}`} className="bo-btn">
            ← Voltar
          </Link>
        ) : (
          <span />
        )}
        <div className="bo-actions">
          <button className="bo-btn" name="intent" value="save" disabled={pending}>
            Salvar
          </button>
          <button className="bo-btn bo-btn-primary" name="intent" value="next" disabled={pending}>
            {pending ? "Salvando…" : "Salvar e continuar →"}
          </button>
        </div>
      </div>
    </form>
  );
}
