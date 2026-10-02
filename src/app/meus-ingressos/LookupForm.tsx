"use client";

import { useActionState, useState } from "react";
import { lookupTickets, type LookupState } from "./actions";

export function LookupForm({ eventSlug }: { eventSlug: string | null }) {
  const [state, action, pending] = useActionState<LookupState, FormData>(lookupTickets, {});
  const [q, setQ] = useState("");
  const [email, setEmail] = useState("");

  return (
    <>
      <form action={action} className="card lookup-card">
        <div className="field-row">
          <label htmlFor="lookup-q">CPF ou celular da compra</label>
          <input
            id="lookup-q"
            name="q"
            inputMode="numeric"
            autoComplete="off"
            placeholder="000.000.000-00 ou (47) 99999-9999"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            aria-invalid={!!state.error}
            aria-describedby={state.error ? "lookup-error" : undefined}
            required
          />
        </div>
        <div className="field-row">
          <label htmlFor="lookup-email">E-mail da compra</label>
          <input
            id="lookup-email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="exemplo@email.com.br"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            aria-invalid={!!state.error}
            aria-describedby={state.error ? "lookup-error" : undefined}
            required
          />
          {state.error && (
            <div className="field-error" id="lookup-error" role="alert">
              {state.error}
            </div>
          )}
        </div>
        <button className="checkout-cta" type="submit" disabled={pending || q.replace(/\D/g, "").length < 11 || !email.includes("@")}>
          {pending ? "Buscando…" : "Ver meus ingressos"}
        </button>
        <p className="legal-note">Use o mesmo CPF (ou celular) e o mesmo e-mail informados na hora da compra. Só aparecem pedidos já pagos.</p>
      </form>

      {state.groups && state.groups.length === 0 && (
        <div className="card lookup-empty" role="status">
          <b>Não encontramos ingressos pagos com esses dados.</b>
          <p>
            Confira se o CPF (ou celular) e o e-mail são os mesmos usados na compra. Pagamentos por Pix podem levar alguns instantes para confirmar. Se o
            problema continuar, fale com o produtor do evento{eventSlug ? <> pela <a href={`/e/${eventSlug}#produtor`}>página do evento</a></> : null}.
          </p>
        </div>
      )}

      {state.groups?.map((g) => (
        <section key={g.eventId} className="lookup-event" aria-label={g.showName}>
          <header>
            <h2>{g.showName}</h2>
            <p>
              {g.artist} · {g.when}
              {g.venue ? ` · ${g.venue}` : ""}
            </p>
            {!g.upcoming && <span className="lookup-past">Evento já realizado</span>}
          </header>
          <ul className="lookup-tickets">
            {g.tickets.map((t) => (
              <li key={t.id} className={`lookup-pass${t.used ? " used" : ""}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.qr} alt={`QR Code do ingresso ${t.code}`} width={160} height={160} />
                <div className="lookup-pass-info">
                  <span className="lookup-code" aria-label={`Código ${t.code.split("").join(" ")}`}>
                    {t.code}
                  </span>
                  <b>{t.lot}</b>
                  {t.seat && <span>Poltrona {t.seat}</span>}
                  <span>{t.holder}</span>
                  <span className={`lookup-status ${t.used ? "used" : "valid"}`}>
                    {t.used ? `Já utilizado${t.usedAt ? ` em ${t.usedAt}` : ""}` : "Válido"}
                  </span>
                </div>
              </li>
            ))}
          </ul>
          {g.upcoming && <p className="lookup-tip">Na entrada, mostre o QR Code. Se preferir, informe o código de 4 letras.</p>}
        </section>
      ))}
    </>
  );
}
