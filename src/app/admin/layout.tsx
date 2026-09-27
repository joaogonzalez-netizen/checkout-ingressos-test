import "./admin.css";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../login/actions";
import { NavLink } from "./NavLink";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className="bo bo-shell">
      <aside className="bo-sidebar">
        <div className="bo-brand">Backoffice de Eventos</div>
        <NavLink href="/admin/artists">Artistas</NavLink>
        <NavLink href="/admin/events">Eventos</NavLink>
        <NavLink href="/admin/users">Usuários</NavLink>
        <NavLink href="/admin/settings">Configurações</NavLink>
        <form action={logout}>
          <div className="bo-user">{user.email}</div>
          <a href="/trocar-senha" className="bo-user-link">
            Minha senha
          </a>
          <button className="bo-btn bo-btn-sm" style={{ width: "100%" }}>
            Sair
          </button>
        </form>
      </aside>
      <main className="bo-main">{children}</main>
    </div>
  );
}
