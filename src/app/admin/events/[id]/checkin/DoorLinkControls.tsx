"use client";

import { useActionState, useState } from "react";
import { createDoorLink, revokeDoorLink, rotateDoorPinAction, type DoorLinkState } from "./door-actions";

type Active = { url: string; qr: string | null; createdAt: string; expiresAt: string | null; expired: boolean };

export function DoorLinkControls({ eventId, canCreate, active }: { eventId: string; canCreate: boolean; active: Active | null }) {
  const [created, createAction, creating] = useActionState<DoorLinkState, FormData>(createDoorLink.bind(null, eventId) as never, {});
  const [rotated, rotateAction, rotating] = useActionState<DoorLinkState, FormData>(rotateDoorPinAction.bind(null, eventId) as never, {});
  const [copied, setCopied] = useState<"link" | "pin" | null>(null);
  // O PIN em texto só existe aqui, logo depois de criar ou trocar: o servidor guarda só o hash.
  const reveal = rotated.pin ? rotated : created.pin ? created : null;
  const error = rotated.error ?? created.error;

  async function copy(text: string, what: "link" | "pin") {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(what);
      setTimeout(() => setCopied(null), 1800);
    } catch {
      // sem permissão de área de transferência: o campo continua selecionável
    }
  }

  if (!active) {
    return (
      <>
        <form action={createAction}>
          <button className="bo-btn bo-btn-primary" disabled={!canCreate || creating}>
            {creating ? "Criando…" : "Criar link da portaria"}
          </button>
        </form>
        {!canCreate && <p className="bo-hint">Publique o evento para criar o link da portaria.</p>}
        {error && <p className="bo-error" style={{ marginTop: 10 }}>{error}</p>}
      </>
    );
  }

  return (
    <div className="bo-door">
      <div className="bo-door-main">
        {active.expired && <p className="bo-warn">Este link já expirou (vale até 24 h depois do evento). Crie um novo se precisar.</p>}
        <label className="bo-field">
          <span>Link da portaria</span>
          <div className="bo-actions" style={{ flexWrap: "nowrap" }}>
            <input readOnly value={active.url} onFocus={(e) => e.currentTarget.select()} aria-label="Link da portaria" />
            <button type="button" className="bo-btn" onClick={() => copy(active.url, "link")}>
              {copied === "link" ? "Copiado!" : "Copiar"}
            </button>
          </div>
        </label>

        {reveal?.pin ? (
          <div className="bo-door-pin" role="status">
            <span>PIN da equipe (anote ou copie agora: não aparece de novo)</span>
            <div>
              <b>{reveal.pin}</b>
              <button type="button" className="bo-btn bo-btn-sm" onClick={() => copy(reveal.pin!, "pin")}>
                {copied === "pin" ? "Copiado!" : "Copiar PIN"}
              </button>
            </div>
          </div>
        ) : (
          <p className="bo-hint">
            O PIN de 6 números só aparece quando é criado. Se perdeu, gere um novo: quem estava conectado com o antigo é desconectado.
          </p>
        )}

        <p className="bo-hint">
          Criado em {active.createdAt}
          {active.expiresAt ? ` · vale até ${active.expiresAt}` : ""}. Cada pessoa informa o nome ao entrar, e ele fica registrado em cada entrada.
        </p>
        {error && <p className="bo-error">{error}</p>}

        <div className="bo-actions">
          <a className="bo-btn" href={active.url} target="_blank" rel="noreferrer">
            Abrir
          </a>
          <form action={rotateAction}>
            <button className="bo-btn" disabled={rotating}>
              {rotating ? "Gerando…" : "Gerar novo PIN"}
            </button>
          </form>
          <form
            action={revokeDoorLink.bind(null, eventId)}
            onSubmit={(e) => {
              if (!confirm("Desativar o link? A equipe conectada é desconectada na hora.")) e.preventDefault();
            }}
          >
            <button className="bo-btn bo-btn-danger">Desativar link</button>
          </form>
        </div>
      </div>
      {active.qr && (
        <figure className="bo-door-qr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={active.qr} alt="QR Code do link da portaria" width={150} height={150} />
          <figcaption className="bo-hint">Aponte a câmera do celular da equipe para abrir o link.</figcaption>
        </figure>
      )}
    </div>
  );
}
