import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { ResetPasswordForm } from "../UserForms";
import { setUserActive } from "../actions";

export default async function UserPage({ params }: PageProps<"/admin/users/[id]">) {
  const me = await requireAdmin();
  const { id } = await params;
  const user = await db.user.findUnique({ where: { id } });
  if (!user) notFound();
  const history = await db.auditLog.findMany({ where: { entity: "user", entityId: id }, orderBy: { createdAt: "desc" }, take: 15, include: { user: true } });
  const LABEL: Record<string, string> = {
    created: "Acesso liberado",
    deactivated: "Desativado",
    reactivated: "Reativado",
    password_reset_by_admin: "Senha redefinida por admin",
    password_changed: "Trocou a própria senha",
    locked_after_failed_logins: "Bloqueado por tentativas erradas",
  };

  return (
    <>
      <div className="bo-page-head">
        <div>
          <Link href="/admin/users" className="small">
            ← Usuários
          </Link>
          <h1>
            {user.name} {!user.active && <span className="bo-badge archived">Desativado</span>}
          </h1>
          <p className="muted">{user.email}</p>
        </div>
        {user.id !== me.id && (
          <form action={setUserActive.bind(null, user.id, !user.active)}>
            <button className={`bo-btn${user.active ? " bo-btn-danger" : ""}`}>{user.active ? "Desativar acesso" : "Reativar acesso"}</button>
          </form>
        )}
      </div>

      <div className="bo-grid-2">
        <div className="bo-card">
          <h2>{user.id === me.id ? "Sua senha" : "Redefinir senha"}</h2>
          {user.id === me.id ? (
            <p className="muted">
              Para trocar a sua senha, use <Link href="/trocar-senha">Minha senha</Link>.
            </p>
          ) : (
            <>
              <p className="bo-hint" style={{ marginTop: -6, marginBottom: 12 }}>
                Encerra as sessões abertas de {user.name.split(" ")[0]} e obriga a criar uma senha nova no próximo acesso.
              </p>
              <ResetPasswordForm userId={user.id} name={user.name} email={user.email} />
            </>
          )}
        </div>
        <div className="bo-card">
          <h2>Histórico de acesso</h2>
          {history.length === 0 ? (
            <div className="bo-empty">Sem registros.</div>
          ) : (
            <table className="bo-table">
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td>{LABEL[h.action] ?? h.action}</td>
                    <td className="small muted">{h.user ? `por ${h.user.name}` : ""}</td>
                    <td className="small muted">{h.createdAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </>
  );
}
