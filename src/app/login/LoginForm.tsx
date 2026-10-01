"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<LoginState, FormData>(login, {});
  return (
    <form action={action} className="bo-form">
      <input type="hidden" name="next" value={next} />
      <label className="bo-field">
        <span>E-mail</span>
        <input name="email" type="email" autoComplete="username" required defaultValue={state.email} key={state.email} />
      </label>
      <label className="bo-field">
        <span>Senha</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error && <p className="bo-error" role="alert">{state.error}</p>}
      <button className="bo-btn bo-btn-primary" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
