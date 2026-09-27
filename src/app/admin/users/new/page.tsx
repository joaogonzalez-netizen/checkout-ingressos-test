import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { CreateUserForm } from "../UserForms";

export const metadata = { title: "Liberar acesso · Backoffice" };

export default async function NewUserPage() {
  await requireAdmin();
  return (
    <>
      <div className="bo-page-head">
        <div>
          <Link href="/admin/users" className="small">
            ← Usuários
          </Link>
          <h1>Liberar acesso</h1>
          <p className="muted">A pessoa entra com este e-mail e a senha temporária, e cria a própria senha no primeiro acesso.</p>
        </div>
      </div>
      <div className="bo-card" style={{ maxWidth: 720 }}>
        <CreateUserForm />
      </div>
    </>
  );
}
