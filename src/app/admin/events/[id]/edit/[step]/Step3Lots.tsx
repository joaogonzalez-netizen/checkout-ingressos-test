"use client";

import { useState } from "react";
import type { StepState } from "../../../actions";
import { LOT_CATEGORY_LABEL } from "../../../labels";
import { StepForm } from "../StepForm";

type Lot = {
  key: string;
  id?: string;
  name: string;
  description: string;
  category: keyof typeof LOT_CATEGORY_LABEL;
  price: string;
  quantity: string;
  salesStart: string;
  salesEnd: string;
  reserved: number;
  sold: number;
  minPriceLabel: string | null;
};

function blankLot(n: number): Lot {
  return {
    key: `new-${Date.now()}-${n}`,
    name: "",
    description: "",
    category: "inteira",
    price: "",
    quantity: "",
    salesStart: "",
    salesEnd: "",
    reserved: 0,
    sold: 0,
    minPriceLabel: null,
  };
}

export function Step3Lots({
  eventId,
  action,
  initial,
  initialLimit,
}: {
  eventId: string;
  action: (prev: StepState, form: FormData) => Promise<StepState>;
  initial: Lot[];
  initialLimit: number | null;
}) {
  const [lots, setLots] = useState<Lot[]>(initial.length ? initial : [blankLot(0)]);
  const [limit, setLimit] = useState(initialLimit ? String(initialLimit) : "");
  const limitNum = Number(limit) || 0;
  const distributed = lots.reduce((a, l) => a + (Number(l.quantity) || 0), 0);
  const over = limitNum > 0 && distributed > limitNum;
  const soldTotal = initial.reduce((a, l) => a + l.reserved, 0);
  const update = (key: string, patch: Partial<Lot>) => setLots((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const move = (i: number, d: number) =>
    setLots((ls) => {
      const next = [...ls];
      const j = i + d;
      if (j < 0 || j >= next.length) return ls;
      [next[i], next[j]] = [next[j], next[i]];
      return next;
    });

  const payload = JSON.stringify(
    lots.map(({ id, name, description, category, price, quantity, salesStart, salesEnd }) => ({ id, name, description, category, price, quantity, salesStart, salesEnd })),
  );
  const hasMeia = lots.some((l) => l.category === "meia");

  return (
    <StepForm action={action} eventId={eventId} step={3} hidden={{ lots: payload }}>
      <div className="bo-card">
        <h2>Limite de ingressos</h2>
        <div className="bo-limit">
          <label className="bo-field">
            <span>Total de ingressos do evento</span>
            <input
              name="ticketLimit"
              inputMode="numeric"
              required
              placeholder="Ex.: 300"
              value={limit}
              onChange={(e) => setLimit(e.target.value.replace(/\D/g, ""))}
            />
            <span className="bo-hint">Capacidade de venda. A soma das quantidades dos lotes não pode passar desse número.</span>
          </label>
          <div className={`bo-limit-meter${over ? " over" : ""}`} aria-live="polite">
            <div>
              <b>{distributed}</b> de {limitNum || "—"} distribuídos nos lotes
            </div>
            <div className="bo-limit-bar">
              <i style={{ transform: `scaleX(${limitNum ? Math.min(1, distributed / limitNum) : 0})` }} />
            </div>
            <span className="bo-hint">
              {over
                ? `Passou ${distributed - limitNum} do limite: reduza os lotes ou aumente o limite.`
                : limitNum
                  ? `Sobram ${limitNum - distributed} para novos lotes.`
                  : "Defina o limite para distribuir nos lotes."}
              {soldTotal > 0 && ` · ${soldTotal} já vendido(s)/reservado(s).`}
            </span>
          </div>
        </div>
      </div>

      <div className="bo-card">
        <h2>Ingressos e lotes</h2>
        <p className="muted small" style={{ marginTop: -6 }}>
          A ordem aqui é a ordem na página. Taxa de serviço de 10% é somada no checkout.
        </p>
        <div className="bo-form">
          {lots.map((l, i) => (
            <div className="bo-lot" key={l.key}>
              <label className="bo-field">
                <span>Nome do lote</span>
                <input value={l.name} onChange={(e) => update(l.key, { name: e.target.value })} placeholder="2º Lote Inteira" required />
              </label>
              <label className="bo-field">
                <span>Categoria</span>
                <select value={l.category} onChange={(e) => update(l.key, { category: e.target.value as Lot["category"] })}>
                  {Object.entries(LOT_CATEGORY_LABEL).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="bo-field">
                <span>Preço (R$)</span>
                <input value={l.price} inputMode="decimal" onChange={(e) => update(l.key, { price: e.target.value })} placeholder="120,00" required />
                {l.minPriceLabel && <span className="bo-hint">Tem vendas: mínimo {l.minPriceLabel}</span>}
              </label>
              <label className="bo-field">
                <span>Quantidade</span>
                <input
                  value={l.quantity}
                  inputMode="numeric"
                  onChange={(e) => update(l.key, { quantity: e.target.value.replace(/\D/g, "") })}
                  placeholder="100"
                  required
                />
                {l.reserved > 0 && <span className="bo-hint">{l.reserved} vendido(s)/reservado(s)</span>}
              </label>
              <label className="bo-field bo-lot-desc">
                <span>Descrição (opcional)</span>
                <input
                  value={l.description}
                  maxLength={300}
                  onChange={(e) => update(l.key, { description: e.target.value })}
                  placeholder={l.category === "solidario" ? "Ex.: obrigatória a doação de 1 L de leite na entrada" : "Quem tem direito ou o que levar"}
                />
              </label>
              <div className="bo-lot-dates">
                <label className="bo-field">
                  <span>Início da venda (opcional)</span>
                  <input type="datetime-local" value={l.salesStart} onChange={(e) => update(l.key, { salesStart: e.target.value })} />
                </label>
                <label className="bo-field">
                  <span>Fim da venda (opcional)</span>
                  <input type="datetime-local" value={l.salesEnd} onChange={(e) => update(l.key, { salesEnd: e.target.value })} />
                </label>
                <div className="bo-actions">
                  <button type="button" className="bo-btn bo-btn-sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label="Subir">
                    ↑
                  </button>
                  <button type="button" className="bo-btn bo-btn-sm" onClick={() => move(i, 1)} disabled={i === lots.length - 1} aria-label="Descer">
                    ↓
                  </button>
                  <button
                    type="button"
                    className="bo-btn bo-btn-sm bo-btn-danger"
                    disabled={l.reserved > 0 || lots.length === 1}
                    title={l.reserved > 0 ? "Lote com vendas não pode ser removido" : undefined}
                    onClick={() => setLots((ls) => ls.filter((x) => x.key !== l.key))}
                  >
                    Remover
                  </button>
                </div>
              </div>
            </div>
          ))}
          <div>
            <button type="button" className="bo-btn" onClick={() => setLots((ls) => [...ls, blankLot(ls.length)])}>
              + Adicionar lote
            </button>
          </div>
          {hasMeia && (
            <p className="bo-hint">
              Meia-entrada: a cota legal (Lei 12.933/2013) é de 40% dos ingressos. Confira a quantidade dos lotes de meia.
            </p>
          )}
        </div>
      </div>
    </StepForm>
  );
}
