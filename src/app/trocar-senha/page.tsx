import "../admin/admin.css";
import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { ChangeOwnPasswordForm } from "../admin/users/UserForms";
import { logout } from "../login/actions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Trocar senha · Backoffice" };

/** Fora do layout do admin: é aqui que cai quem ainda precisa trocar a senha temporária. */
export default async function ChangePasswordPage() {
  const user = await requireUser();
  return (
    <div className="bo bo-login">
      <div className="bo-card bo-login-card" style={{ maxWidth: 520 }}>
        <div className="bo-brand">Backoffice de Eventos</div>
        <h1>{user.mustChangePassword ? "Crie a sua senha" : "Trocar senha"}</h1>
        <p className="muted small" style={{ marginTop: -10, marginBottom: 16 }}>
          {user.mustChangePassword
            ? "Seu acesso foi criado com uma senha temporária. Para continuar, defina uma senha só sua."
            : "Ao salvar, as outras sessões abertas com a sua conta são encerradas."}
        </p>
        <ChangeOwnPasswordForm name={user.name} email={user.email} />
        <div className="bo-actions" style={{ marginTop: 14, justifyContent: "space-between" }}>
          {!user.mustChangePassword ? <Link href="/admin">← Voltar</Link> : <span />}
          <form action={logout}>
            <button className="bo-btn bo-btn-sm">Sair</button>
          </form>
        </div>
      </div>
    </div>
  );
}
