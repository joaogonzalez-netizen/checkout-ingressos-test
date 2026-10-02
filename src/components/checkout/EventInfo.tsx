"use client";

import { useEffect, useState } from "react";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import type { TemplateData } from "./types";

/** Texto com linhas iniciadas por "- " vira lista; o resto vira parágrafo. */
export function RichText({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const isItem = /^[-*•]\s+/.test(line);
    const clean = line.replace(/^[-*•]\s+/, "");
    const last = blocks[blocks.length - 1];
    if (last && last.list === isItem && isItem) last.lines.push(clean);
    else blocks.push({ list: isItem, lines: [clean] });
  }
  return (
    <>
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i}>
            {b.lines.map((l, j) => (
              <li key={j}>{l}</li>
            ))}
          </ul>
        ) : (
          <p key={i}>{b.lines.join(" ")}</p>
        ),
      )}
    </>
  );
}

function whatsappUrl(digits: string) {
  return `https://wa.me/55${digits}`;
}

/** Audiodescrição: o navegador lê a descrição e as informações do evento em voz alta (pt-BR). */
function ListenButton({ text }: { text: string }) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    const ok = typeof window !== "undefined" && "speechSynthesis" in window;
    // Recurso do navegador: só é conhecido depois da hidratação.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSupported(ok);
    return () => {
      if (ok) window.speechSynthesis.cancel();
    };
  }, []);
  if (!supported || !text.trim()) return null;
  return (
    <button
      type="button"
      className="listen-btn"
      aria-pressed={speaking}
      onClick={() => {
        const synth = window.speechSynthesis;
        if (speaking) {
          synth.cancel();
          setSpeaking(false);
          return;
        }
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "pt-BR";
        u.rate = 1;
        u.onend = () => setSpeaking(false);
        u.onerror = () => setSpeaking(false);
        synth.cancel();
        synth.speak(u);
        setSpeaking(true);
      }}
    >
      {speaking ? "⏸ Parar leitura" : "🔊 Ouvir descrição"}
    </button>
  );
}

export type BuyCtaInfo = { soldOut: boolean; fromLabel: string | null; onClick: () => void };

/** Botão de compra: leva até a seção "Finalize sua compra". */
export function BuyCta({ info, className = "" }: { info: BuyCtaInfo; className?: string }) {
  return (
    <div className={`buy-cta ${className}`}>
      <button type="button" className="vsl-cta" onClick={info.onClick}>
        {info.soldOut ? "Ver ingressos" : "Comprar ingressos"} ↓
      </button>
      {info.fromLabel && <span className="buy-cta-from">{info.fromLabel} · parcele em até 12x</span>}
    </div>
  );
}

export function EventInfo({ data, buyCta }: { data: TemplateData; buyCta?: BuyCtaInfo }) {
  const s = data.seller;
  const lotsWithDescription = data.lots.filter((l) => l.description);
  const hasHalfPrice = data.lots.some((l) => l.isHalfPrice);
  const seatsText = data.seated
    ? "Lugar marcado: cada ingresso dá direito à poltrona escolhida na compra."
    : "A ocupação dos lugares é por ordem de chegada, respeitando a capacidade do local. Não há reserva de assentos.";
  const spoken = [
    `${data.showName}. ${data.longDateLabel}${data.timeLabel ? `, às ${data.timeLabel}` : ""}. ${data.venueName}, ${data.city}.`,
    data.description,
    data.ageRatingLabel ? `Classificação indicativa: ${data.ageRatingLabel}. ${data.ageRatingNote ?? ""}` : "",
    seatsText,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="info-wrap">
      <div className="info-main">
        {data.description && (
          <section className="info-section" id="descricao">
            <div className="info-head">
              <h2>Descrição do evento</h2>
              <ListenButton text={spoken} />
            </div>
            <RichText text={data.description} />
          </section>
        )}

        <section className="info-section" id="informacoes">
          <div className="info-head">
            <h2>Informações importantes</h2>
            {!data.description && <ListenButton text={spoken} />}
          </div>
          {data.ageRatingLabel && (
            <p>
              <strong>Classificação indicativa: {data.ageRatingLabel}.</strong> {data.ageRatingNote}
            </p>
          )}
          <p>
            <strong>Abertura dos portões:</strong>{" "}
            {data.doorsLabel ? `às ${data.doorsLabel}. Recomendamos chegar com antecedência.` : "recomendamos chegar com antecedência."}
          </p>
          <p>
            <strong>Assentos:</strong> {seatsText}
          </p>
          {data.accessRules && (
            <>
              <h3>Informações gerais</h3>
              <RichText text={data.accessRules} />
            </>
          )}
        </section>

        {buyCta && <BuyCta info={buyCta} className="info-cta" />}

        {lotsWithDescription.length > 0 && (
          <section className="info-section" id="tipos-de-ingresso">
            <h2>Tipos de ingresso</h2>
            {lotsWithDescription.map((l) => (
              <div key={l.id} className="info-lot">
                <h3>{l.name}</h3>
                <p>{l.description}</p>
              </div>
            ))}
          </section>
        )}

        <section className="info-section" id="meia-entrada">
          <h2>Meia-entrada</h2>
          {!hasHalfPrice && <p className="info-soft">Este evento não tem lote de meia-entrada à venda no momento.</p>}
          <RichText text={s.halfPriceText} />
        </section>

        <section className="info-section" id="politica">
          <h2>Política do evento</h2>
          <h3>Cancelamento de pedidos pagos</h3>
          <RichText text={s.cancellationText} />
        </section>

        <section className="info-section" id="local">
          <h2>Local</h2>
          <p>
            <strong>{data.venueName}</strong>
            <br />
            {data.venueAddress}
            {data.venueAddress && <br />}
            {data.city}, {data.state}
          </p>
          <a className="ghost-btn" href={data.mapUrl} target="_blank" rel="noreferrer">
            📍 Ver no mapa
          </a>
        </section>

        {(s.name || s.email || s.whatsapp) && (
          <section className="info-section" id="produtor">
            <h2>Sobre o produtor</h2>
            {s.name && <p className="info-producer">{s.name}</p>}
            <div className="info-actions">
              {s.whatsapp && (
                <a className="ghost-btn" href={whatsappUrl(s.whatsapp)} target="_blank" rel="noreferrer">
                  💬 Fale pelo WhatsApp
                </a>
              )}
              {s.email && (
                <a className="ghost-btn" href={`mailto:${s.email}?subject=${encodeURIComponent(data.showName)}`}>
                  ✉️ Fale com o produtor
                </a>
              )}
            </div>
          </section>
        )}

        {buyCta && <BuyCta info={buyCta} className="info-cta" />}
      </div>
    </div>
  );
}

export function EventFooter({ data }: { data: TemplateData }) {
  const s = data.seller;
  return (
    <footer className="tpl-footer">
      <div className="tpl-footer-grid">
        <div>
          <h3>Métodos de pagamento</h3>
          <div className="pay-brands" aria-label="Formas de pagamento aceitas">
            {["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Pix"].map((b) => (
              <span key={b}>{b}</span>
            ))}
          </div>
          <span className="pay-badge">Parcele sua compra em até 12x</span>
        </div>
        <div>
          <h3>Compra segura</h3>
          <p>
            Pagamento processado pela Asaas, instituição de pagamento certificada PCI-DSS. Os dados do cartão são digitados no ambiente da Asaas e
            não passam pelo nosso site. Conexão protegida por HTTPS.
          </p>
        </div>
        <div>
          <h3>Já comprou?</h3>
          <p>
            <a href={`/meus-ingressos?e=${encodeURIComponent(data.slug)}`}>Ver meus ingressos</a> com o CPF (ou celular) e o e-mail da compra.
          </p>
          <h3 style={{ marginTop: 18 }}>Precisando de ajuda?</h3>
          {s.whatsapp || s.email ? (
            <p>
              {s.whatsapp && (
                <>
                  WhatsApp:{" "}
                  <a href={whatsappUrl(s.whatsapp)} target="_blank" rel="noreferrer">
                    {formatPhone(s.whatsapp)}
                  </a>
                  <br />
                </>
              )}
              {s.email && (
                <>
                  E-mail: <a href={`mailto:${s.email}`}>{s.email}</a>
                </>
              )}
            </p>
          ) : (
            <p>Responda o e-mail de confirmação da sua compra.</p>
          )}
        </div>
      </div>
      <div className="tpl-footer-legal">
        {s.name && <span>{s.name}</span>}
        {s.cnpj && <span>CNPJ {formatCpfCnpj(s.cnpj)}</span>}
        {s.address && <span>{s.address}</span>}
        <span>
          <a href={data.termsUrl} target="_blank" rel="noreferrer">
            Termos de uso
          </a>{" "}
          ·{" "}
          <a href={data.privacyUrl} target="_blank" rel="noreferrer">
            Política de privacidade
          </a>
        </span>
      </div>
    </footer>
  );
}
