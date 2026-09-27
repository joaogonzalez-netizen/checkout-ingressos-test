"use client";

import { useActionState, useState } from "react";
import { PasswordField } from "../components/PasswordField";
import { changeOwnPassword, createUser, resetUserPassword, type UserFormState } from "./actions";

function Feedback({ state }: { state: UserFormState }) {
  return (
    <>
      {state.error && <p className="bo-error">{state.error}</p>}
      {state.ok && <p className="bo-success">{state.ok}</p>}
    </>
  );
}

export function CreateUserForm() {
  const [state, action, pending] = useActionState<UserFormState, FormData>(createUser, {});
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  return (
    <form action={action} className="bo-form" autoComplete="off">
      <div className="bo-form-grid">
        <label className="bo-field">
          <span>Nome completo</span>
          <input name="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className="bo-field">
          <span>E-mail (login)</span>
          <input name="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="off" />
        </label>
      </div>
      <PasswordField name="password" label="Senha temporária" context={{ name, email }} allowGenerate />
      <label className="bo-field">
        <span>Confirmar senha</span>
        <input name="confirm" type="password" required autoComplete="new-password" />
      </label>
      <p className="bo-hint">
        Envie a senha temporária à pessoa por um canal seguro (não pelo mesmo e-mail do login). No primeiro acesso ela é obrigada a criar a
        própria senha.
      </p>
      <Feedback state={state} />
      <div className="bo-actions">
        <button className="bo-btn bo-btn-primary" disabled={pending}>
          {pending ? "Cadastrando…" : "Cadastrar e liberar acesso"}
        </button>
      </div>
    </form>
  );
}

export function ResetPasswordForm({ userId, name, email }: { userId: string; name: string; email: string }) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(resetUserPassword.bind(null, userId), {});
  return (
    <form action={action} className="bo-form" autoComplete="off">
      <PasswordField name="password" label="Nova senha temporária" context={{ name, email }} allowGenerate />
      <label className="bo-field">
        <span>Confirmar senha</span>
        <input name="confirm" type="password" required autoComplete="new-password" />
      </label>
      <Feedback state={state} />
      <div className="bo-actions">
        <button className="bo-btn" disabled={pending}>
          {pending ? "Redefinindo…" : "Redefinir senha"}
        </button>
      </div>
    </form>
  );
}

export function ChangeOwnPasswordForm({ name, email }: { name: string; email: string }) {
  const [state, action, pending] = useActionState<UserFormState, FormData>(changeOwnPassword, {});
  return (
    <form action={action} className="bo-form">
      <label className="bo-field">
        <span>Senha atual</span>
        <input name="current" type="password" required autoComplete="current-password" />
      </label>
      <PasswordField name="password" label="Nova senha" context={{ name, email }} />
      <label className="bo-field">
        <span>Confirmar nova senha</span>
        <input name="confirm" type="password" required autoComplete="new-password" />
      </label>
      <Feedback state={state} />
      <button className="bo-btn bo-btn-primary" disabled={pending}>
        {pending ? "Salvando…" : "Salvar nova senha"}
      </button>
    </form>
  );
}
