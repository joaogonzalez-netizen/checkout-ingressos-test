"use client";

import Link from "next/link";
import { useActionState } from "react";
import { publishEvent, type StepState } from "../../../actions";
import type { ChecklistItem } from "@/lib/event-checklist";

export function Step6Review({
  eventId,
  status,
  checklist,
  ready,
}: {
  eventId: string;
  status: "draft" | "published" | "closed";
  checklist: ChecklistItem[];
  ready: boolean;
}) {
  const [state, action, pending] = useActionState<StepState>(publishEvent.bind(null, eventId), {});
  const src = `/preview/${eventId}`;

  return (
    <>
      <div className="bo-card">
        <h2>Pré-visualização</h2>
        <div className="bo-preview-frames">
          <div className="bo-frame" style={{ width: 640 }}>
            <div className="bo-frame-label">Desktop</div>
            <div style={{ width: 640, height: 450, overflow: "hidden" }}>
              <iframe src={src} title="Pré-visualização desktop" style={{ width: 1280, height: 900, transform: "scale(0.5)", transformOrigin: "0 0" }} />
            </div>
          </div>
          <div className="bo-frame" style={{ width: 312 }}>
            <div className="bo-frame-label">Mobile</div>
            <div style={{ width: 312, height: 600, overflow: "hidden" }}>
              <iframe src={src} title="Pré-visualização mobile" style={{ width: 390, height: 750, transform: "scale(0.8)", transformOrigin: "0 0" }} />
            </div>
          </div>
        </div>
        <p className="small" style={{ marginTop: 10 }}>
          <a href={src} target="_blank" rel="noreferrer">
            Abrir pré-visualização em nova aba
          </a>
        </p>
      </div>

      <div className="bo-card">
        <h2>Checklist</h2>
        <ul className="bo-checklist">
          {checklist.map((c) => (
            <li key={c.label}>
              <span className={c.done ? "ok" : "no"}>{c.done ? "✓" : "✕"}</span>
              {c.done ? (
                c.label
              ) : (
                <Link href={`/admin/events/${eventId}/edit/${c.step}`}>
                  {c.label} (etapa {c.step})
                </Link>
              )}
            </li>
          ))}
        </ul>
        <form action={action} className="bo-wizard-foot">
          <Link href={`/admin/events/${eventId}/edit/5`} className="bo-btn">
            ← Voltar
          </Link>
          {status === "draft" ? (
            <button className="bo-btn bo-btn-primary" disabled={!ready || pending}>
              {pending ? "Publicando…" : "Publicar evento"}
            </button>
          ) : (
            <span className="muted">Evento já publicado. As alterações salvas já estão no ar.</span>
          )}
        </form>
        {state.error && <p className="bo-error">{state.error}</p>}
      </div>
    </>
  );
}
