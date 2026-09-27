"use client";

import { useMemo, useState } from "react";
import type { StepState } from "../../../actions";
import { StepForm } from "../StepForm";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

type Initial = {
  seatingMode: "seated" | "general" | null;
  rows: number;
  perRow: number;
  seats: { code: string; status: "available" | "blocked" | "held" | "sold" }[];
  ticketLimit: number | null;
};

export function Step4Seats({
  eventId,
  action,
  initial,
}: {
  eventId: string;
  action: (prev: StepState, form: FormData) => Promise<StepState>;
  initial: Initial;
}) {
  // Padrão: sem lugar marcado. Lugar marcado está desativado para eventos novos; quem já é, continua.
  const seatedAllowed = initial.seatingMode === "seated";
  const [mode, setMode] = useState(initial.seatingMode ?? "general");
  const [rows, setRows] = useState(initial.rows);
  const [perRow, setPerRow] = useState(initial.perRow);
  const [blocked, setBlocked] = useState(() => new Set(initial.seats.filter((s) => s.status === "blocked").map((s) => s.code)));
  const locked = useMemo(
    () => new Set(initial.seats.filter((s) => s.status === "held" || s.status === "sold").map((s) => s.code)),
    [initial.seats],
  );
  const hasSales = locked.size > 0;
  const validRows = Math.min(Math.max(rows || 0, 0), 26);
  const validPerRow = Math.min(Math.max(perRow || 0, 0), 60);
  const available = validRows * validPerRow - [...blocked].filter((c) => LETTERS.indexOf(c[0]) < validRows && Number(c.slice(1)) <= validPerRow).length;

  function toggle(code: string) {
    if (locked.has(code)) return;
    setBlocked((b) => {
      const next = new Set(b);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  return (
    <StepForm action={action} eventId={eventId} step={4} hidden={{ blocked: JSON.stringify([...blocked]), seatingMode: mode }}>
      <div className="bo-card">
        <h2>Lugares</h2>
        <div className="bo-radio-row" style={{ marginBottom: 16 }}>
          <label className="bo-radio-card">
            <input type="radio" checked={mode === "general"} disabled={hasSales} onChange={() => setMode("general")} />
            <span>
              <b>Sem lugar marcado</b>
              <br />
              <span className="small muted">Entrada por ordem de chegada. Capacidade = limite de ingressos.</span>
            </span>
          </label>
          <label className={`bo-radio-card${seatedAllowed ? "" : " disabled"}`}>
            <input type="radio" checked={mode === "seated"} disabled={!seatedAllowed} onChange={() => setMode("seated")} />
            <span>
              <b>Lugar marcado</b> {!seatedAllowed && <em className="bo-chip">desativado</em>}
              <br />
              <span className="small muted">
                {seatedAllowed ? "O comprador escolhe a poltrona no mapa." : "Indisponível por enquanto para eventos novos."}
              </span>
            </span>
          </label>
        </div>

        {mode === "seated" ? (
          <>
            <div className="bo-form-grid" style={{ maxWidth: 420 }}>
              <label className="bo-field">
                <span>Fileiras (A–Z)</span>
                <input name="seatRows" type="number" min={1} max={26} value={rows} readOnly={hasSales} onChange={(e) => setRows(Number(e.target.value))} />
              </label>
              <label className="bo-field">
                <span>Assentos por fileira</span>
                <input name="seatsPerRow" type="number" min={1} max={60} value={perRow} readOnly={hasSales} onChange={(e) => setPerRow(Number(e.target.value))} />
              </label>
            </div>
            <p className="bo-hint" style={{ margin: "10px 0" }}>
              Clique numa poltrona para bloquear (cinza) ou liberar. {hasSales && "Poltronas com contorno já foram vendidas ou reservadas."}
            </p>
            <div className="bo-stage">PALCO</div>
            <div className="bo-seat-grid">
              {Array.from({ length: validRows }, (_, r) => (
                <div className="bo-seat-row" key={r}>
                  <b>{LETTERS[r]}</b>
                  {Array.from({ length: validPerRow }, (_, n) => {
                    const code = `${LETTERS[r]}${n + 1}`;
                    return (
                      <button
                        key={code}
                        type="button"
                        title={code}
                        aria-label={`Poltrona ${code}${blocked.has(code) ? " bloqueada" : ""}`}
                        className={`bo-seat${blocked.has(code) ? " blocked" : ""}${locked.has(code) ? " locked" : ""}`}
                        onClick={() => toggle(code)}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
            <p className="muted small">
              {available} poltronas disponíveis · limite de {initial.ticketLimit ?? "—"} ingressos
              {(initial.ticketLimit ?? 0) > available && " — a venda para quando as poltronas acabarem"}.
            </p>
          </>
        ) : (
          <p className="muted">
            Capacidade: {initial.ticketLimit ? `${initial.ticketLimit} ingressos (limite definido em Ingressos)` : "defina o limite de ingressos na etapa 3"}.
          </p>
        )}
      </div>
    </StepForm>
  );
}
