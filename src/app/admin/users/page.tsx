import Link from "next/link";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { setUserActive } from "./actions";

export const metadata = { title: "Usuários · Backoffice" };

function when(d: Date | null) {
  return d ? d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";
}

export default async function UsersPage({ searchParams }: PageProps<"/admin/users">) {
  const me = await requireAdmin();
  const { criado } = await searchParams;
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }] });
  const names = new Map(users.map((u) => [u.id, u.name]));
  const now = new Date();

  return (
    <>
      <div className="bo-page-head">
        <div>
          <h1>Usuários</h1>
          <p className="muted">Quem pode entrar no backoffice. No v1 todo usuário tem acesso de Admin.</p>
        </div>
        <Link href="/admin/users/new" className="bo-btn bo-btn-primary">
          + Liberar acesso
        </Link>
      </div>
      {typeof criado === "string" && (
        <p className="bo-success" style={{ marginBottom: 16 }}>
          Acesso liberado para {criado}. A pessoa vai criar a própria senha no primeiro login.
        </p>
      )}
      <div className="bo-card">
        <div className="bo-table-wrap">
          <table className="bo-table">
            <thead>
              <tr>
                <th>Usuário</th>
                <th>Status</th>
                <th>Último acesso</th>
                <th>Criado por</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const locked = u.lockedUntil && u.lockedUntil > now;
                return (
                  <tr key={u.id}>
                    <td>
                      <Link href={`/admin/users/${u.id}`}>
                        <b>{u.name}</b>
                      </Link>
                      {u.id === me.id && <span className="muted small"> (você)</span>}
                      <div className="small muted">{u.email}</div>
                    </td>
                    <td>
                      {!u.active ? (
                        <span className="bo-badge archived">Desativado</span>
                      ) : locked ? (
                        <span className="bo-badge failed">Bloqueado até {when(u.lockedUntil).slice(-5)}</span>
                      ) : u.mustChangePassword ? (
                        <span className="bo-badge pending">Aguardando 1º acesso</span>
                      ) : (
                        <span className="bo-badge paid">Ativo</span>
                      )}
                    </td>
                    <td>{when(u.lastLoginAt)}</td>
                    <td>{u.createdById ? (names.get(u.createdById) ?? "—") : <span className="muted">seed</span>}</td>
                    <td style={{ textAlign: "right" }}>
                      {u.id !== me.id && (
                        <form action={setUserActive.bind(null, u.id, !u.active)}>
                          <button className={`bo-btn bo-btn-sm${u.active ? " bo-btn-danger" : ""}`}>{u.active ? "Desativar" : "Reativar"}</button>
                        </form>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
