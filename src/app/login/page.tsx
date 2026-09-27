import "../admin/admin.css";
import { LoginForm } from "./LoginForm";

export const metadata = { title: "Entrar · Backoffice" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <div className="bo bo-login">
      <div className="bo-card bo-login-card">
        <div className="bo-brand">Backoffice de Eventos</div>
        <h1>Entrar</h1>
        <LoginForm next={typeof next === "string" ? next : ""} />
      </div>
    </div>
  );
}
