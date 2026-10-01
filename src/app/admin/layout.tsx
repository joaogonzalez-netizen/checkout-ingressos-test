import "./admin.css";
import { requireAdmin } from "@/lib/auth";
import { logout } from "../login/actions";
import { AdminSidebar } from "./AdminSidebar";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  const user = await requireAdmin();
  return (
    <div className="bo bo-shell">
      <AdminSidebar email={user.email} logoutAction={logout} />
      <main className="bo-main">
        {env.ASAAS_MOCK && (
          <p className="bo-demo-banner">
            🧪 Ambiente de teste: pagamentos simulados, sem Asaas. Limpe os dados em Configurações quando quiser recomeçar.
          </p>
        )}
        {children}
      </main>
    </div>
  );
}
