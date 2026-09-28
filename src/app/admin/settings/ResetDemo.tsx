"use client";

import { useActionState } from "react";
import { resetDemoData, type ResetState } from "./actions";

export function ResetDemo() {
  const [state, action, pending] = useActionState<ResetState, FormData>(resetDemoData, {});
  return (
    <div className="bo-card bo-danger" style={{ marginTop: 16 }}>
      <h2>Limpar dados de teste</h2>
      <p className="bo-hint" style={{ marginTop: -6, marginBottom: 12 }}>
        Apaga todos os artistas, eventos, pedidos, ingressos e imagens para recomeçar do zero. Usuários e configurações continuam. Só existe no
        ambiente de teste.
      </p>
      <form
        action={action}
        className="bo-actions"
        onSubmit={(e) => {
          if (!confirm("Apagar todos os dados de teste? Não dá para desfazer.")) e.preventDefault();
        }}
      >
        <input className="bo-input" style={{ maxWidth: 220 }} name="confirm" placeholder="Digite LIMPAR" autoComplete="off" />
        <button className="bo-btn bo-btn-danger" disabled={pending}>
          {pending ? "Apagando…" : "Limpar dados de teste"}
        </button>
      </form>
      {state.error && <p className="bo-error" style={{ marginTop: 10 }}>{state.error}</p>}
      {state.done && <p className="bo-success" style={{ marginTop: 10 }}>{state.done}</p>}
    </div>
  );
}
