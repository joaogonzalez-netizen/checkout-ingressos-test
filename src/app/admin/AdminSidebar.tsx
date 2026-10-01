"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Icon } from "./components/Icon";
import { NavLink } from "./NavLink";

/**
 * Navegação única do backoffice. Desktop: barra lateral fixa. Celular: barra superior com ☰ que abre a mesma
 * navegação como gaveta (fecha ao trocar de página, no Esc e no toque fora).
 */
export function AdminSidebar({ email, logoutAction }: { email: string; logoutAction: () => void | Promise<void> }) {
  const pathname = usePathname();
  // "Aberto" vale só para a página em que foi aberto; ao navegar a gaveta fecha sozinha.
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === pathname;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenAt(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <header className="bo-topbar">
        <button
          type="button"
          className="bo-topbar-btn"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          aria-expanded={open}
          aria-controls="bo-nav"
          onClick={() => setOpenAt(open ? null : pathname)}
        >
          <Icon name={open ? "close" : "menu"} size={22} />
        </button>
        <span className="bo-brand">Backoffice de Eventos</span>
      </header>
      {open && <button type="button" className="bo-scrim" aria-label="Fechar menu" tabIndex={-1} onClick={() => setOpenAt(null)} />}
      <aside className="bo-sidebar" id="bo-nav" data-open={open}>
        <div className="bo-brand">Backoffice de Eventos</div>
        <nav aria-label="Principal" className="bo-nav">
          <NavLink href="/admin/events" icon="calendar">
            Eventos
          </NavLink>
          <NavLink href="/admin/orders" icon="ticket">
            Vendas
          </NavLink>
          <NavLink href="/admin/checkin" icon="scan">
            Check-in
          </NavLink>
          <NavLink href="/admin/artists" icon="mic">
            Artistas
          </NavLink>
        </nav>
        <nav aria-label="Sistema" className="bo-nav bo-nav-system">
          <span className="bo-nav-label">Sistema</span>
          <NavLink href="/admin/users" icon="users">
            Usuários
          </NavLink>
          <NavLink href="/admin/settings" icon="sliders">
            Configurações
          </NavLink>
        </nav>
        <details className="bo-account">
          <summary>
            <span className="bo-account-mail">{email}</span>
            <Icon name="chevron" size={16} />
          </summary>
          <a href="/trocar-senha">Minha senha</a>
          <form action={logoutAction}>
            <button type="submit">Sair</button>
          </form>
        </details>
      </aside>
    </>
  );
}
