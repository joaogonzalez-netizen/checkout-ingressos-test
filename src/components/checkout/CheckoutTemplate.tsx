"use client";

import "./checkout.css";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { paletteStyle } from "@/lib/palette";
import { formatBRL, INSTALLMENT_OPTIONS, installmentTotalCents, serviceFeeCents, type InstallmentCount } from "@/lib/money";
import { formatCpfCnpj, formatPhone, isValidCpfCnpj, isValidMobile, onlyDigits } from "@/lib/documents";
import { readCookie, trackFunnel } from "./pixel-client";
import type { TemplateData } from "./types";
import { VslVideo } from "./VslVideo";
import { EventFooter, EventInfo } from "./EventInfo";

type Props = {
  data: TemplateData;
  /** preview: usado no backoffice. Mostra tudo, mas não cria pedido nem dispara pixel. */
  mode?: "live" | "preview";
};

type PixState = {
  orderId: string;
  token: string;
  qrImage: string;
  payload: string;
  expiresAt: string;
  devPayUrl?: string;
};

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Tema salvo por evento no localStorage, como no HTML original. No servidor é sempre "light".
const THEME_EVENT = "tpl-theme-change";
function subscribeTheme(cb: () => void) {
  window.addEventListener(THEME_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(THEME_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function readTheme(key: string): "light" | "dark" {
  try {
    return localStorage.getItem(key) === "dark" ? "dark" : "light";
  } catch {
    return "light";
  }
}

function Headline({ text, city }: { text: string; city: string }) {
  // Destaca a cidade como no HTML original ("está chegando em <span>Belo Horizonte</span>").
  const i = city ? text.indexOf(city) : -1;
  if (i < 0) return <>{text}</>;
  return (
    <>
      {text.slice(0, i)}
      <span>{city}</span>
      {text.slice(i + city.length)}
    </>
  );
}

export function CheckoutTemplate({ data, mode = "live" }: Props) {
  const live = mode === "live";
  const router = useRouter();
  const themeKey = `tpl-theme-${data.slug}`;
  const theme = useSyncExternalStore(subscribeTheme, () => readTheme(themeKey), () => "light" as const);
  const [seatId, setSeatId] = useState<string | null>(null);
  const firstLot = data.lots.find((l) => l.available) ?? null;
  // Quantidade por lote. Lugar marcado: sempre 1 ingresso (1 poltrona), escolhido por rádio.
  const [qty, setQty] = useState<Record<string, number>>(() => (data.seated && firstLot ? { [firstLot.id]: 1 } : {}));
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [emailConfirm, setEmailConfirm] = useState("");
  const [phone, setPhone] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [marketingOptIn, setMarketingOptIn] = useState(false);
  const [shared, setShared] = useState(false);
  const [showFee, setShowFee] = useState(false);

  async function share() {
    const url = window.location.href.split("?")[0];
    const title = `${data.artistName} · ${data.showName}`;
    try {
      if (navigator.share) await navigator.share({ title, text: `${title} — ${data.city}/${data.state}`, url });
      else {
        await navigator.clipboard?.writeText(url);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      // usuário cancelou o compartilhamento
    }
  }
  const [method, setMethod] = useState<"credit_card" | "pix">("credit_card");
  const [installments, setInstallments] = useState<InstallmentCount>(1);
  const [docType, setDocType] = useState<"cpf" | "cnpj">("cpf");
  const [doc, setDoc] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pix, setPix] = useState<PixState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const initiated = useRef(false);
  const seatGridRef = useRef<HTMLDivElement>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // Primeira dobra: o header encolhe o quanto for preciso para data, horário e local caberem na tela.
  // O CSS traz uma reserva aproximada (--fold-reserve); aqui ela vira a altura medida do nav + faixa.
  useEffect(() => {
    const root = rootRef.current;
    const nav = root?.querySelector<HTMLElement>("header.nav");
    const strip = root?.querySelector<HTMLElement>(".event-strip");
    if (!root || !nav || !strip) return;
    const update = () => root.style.setProperty("--fold-reserve", `${nav.offsetHeight + strip.offsetHeight + 12}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(nav);
    ro.observe(strip);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (live && data.pixelEnabled) trackFunnel(data.slug, "ViewContent", { content_name: data.showName });
  }, [live, data.pixelEnabled, data.slug, data.showName]);

  const selected = data.lots.filter((l) => (qty[l.id] ?? 0) > 0).map((l) => ({ lot: l, quantity: qty[l.id] }));
  const count = selected.reduce((a, i) => a + i.quantity, 0);

  function changeQty(lotId: string, delta: number) {
    setErrors((e) => ({ ...e, lot: "" }));
    setQty((q) => {
      const lot = data.lots.find((l) => l.id === lotId);
      if (!lot) return q;
      const current = q[lotId] ?? 0;
      const total = Object.values(q).reduce((a, n) => a + n, 0);
      const next = Math.max(0, Math.min(current + delta, lot.remaining, current + (data.maxPerOrder - total)));
      return { ...q, [lotId]: next };
    });
  }
  const seatCode = useMemo(() => {
    for (const r of data.seatRows) for (const s of r.seats) if (s.id === seatId) return `${r.row}${s.number}`;
    return null;
  }, [data.seatRows, seatId]);

  // Mesma conta do servidor: taxa por unidade, somada.
  const ticketCents = selected.reduce((a, i) => a + i.lot.priceCents * i.quantity, 0);
  const feeCents = selected.reduce((a, i) => a + serviceFeeCents(i.lot.priceCents) * i.quantity, 0);
  const baseCents = ticketCents + feeCents;
  const totalCents = method === "credit_card" ? installmentTotalCents(baseCents, installments) : baseCents;

  function toggleTheme() {
    try {
      localStorage.setItem(themeKey, theme === "dark" ? "light" : "dark");
    } catch {}
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  function onFirstInteraction() {
    if (initiated.current || !live || !data.pixelEnabled) return;
    initiated.current = true;
    trackFunnel(data.slug, "InitiateCheckout", { content_name: data.showName });
  }

  function chooseMethod(next: "credit_card" | "pix") {
    setMethod(next);
    if (next === "pix") setInstallments(1);
    if (live && data.pixelEnabled) trackFunnel(data.slug, "AddPaymentInfo", { payment_type: next });
  }

  function validate() {
    const e: Record<string, string> = {};
    if (data.seated && !seatId) e.seat = "Selecione uma poltrona antes de continuar.";
    if (count === 0) e.lot = "Selecione ao menos um ingresso.";
    if (name.trim().split(/\s+/).length < 2) e.name = "Informe nome e sobrenome.";
    if (!EMAIL.test(email.trim())) e.email = "E-mail inválido.";
    else if (email.trim().toLowerCase() !== emailConfirm.trim().toLowerCase()) e.emailConfirm = "Os e-mails não conferem.";
    if (!isValidMobile(phone)) e.phone = "Informe o celular com DDD.";
    if (!acceptTerms) e.terms = "Para continuar, aceite os Termos de uso e a Política de privacidade.";
    const expected = method === "credit_card" ? [11, 14] : docType === "cpf" ? [11] : [14];
    if (!expected.includes(onlyDigits(doc).length) || !isValidCpfCnpj(doc)) e.doc = "Documento inválido.";
    setErrors(e);
    if (e.seat) seatGridRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    return Object.keys(e).length === 0;
  }

  async function submit() {
    setFormError(null);
    if (!validate()) return;
    if (!live) {
      setFormError("Pré-visualização: nenhum pedido é criado.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/checkout/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: data.slug,
          items: selected.map((i) => ({ lotId: i.lot.id, quantity: i.quantity })),
          seatId,
          buyerName: name,
          buyerEmail: email,
          buyerCpfCnpj: doc,
          buyerPhone: phone,
          acceptTerms,
          marketingOptIn,
          method,
          installments,
          fbp: readCookie("_fbp"),
          fbc: readCookie("_fbc"),
          sourceUrl: location.href,
        }),
      });
      const body = await res.json();
      if (!res.ok) {
        setFormError(body.error ?? "Não foi possível finalizar. Tente novamente.");
        if (body.code === "seat_taken") setSeatId(null);
        return;
      }
      if (body.next.type === "redirect") {
        window.location.assign(body.next.url); // fatura externa da Asaas
        return;
      }
      setPix({ orderId: body.orderId, token: body.accessToken, ...body.next });
    } catch {
      setFormError("Falha de conexão. Verifique sua internet e tente novamente.");
    } finally {
      setSubmitting(false);
    }
  }

  // Pix: acompanha o status até o webhook confirmar.
  useEffect(() => {
    if (!pix) return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const poll = setInterval(async () => {
      const res = await fetch(`/api/checkout/orders/${pix.orderId}?t=${pix.token}`, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json();
      if (body.status !== "pending") router.push(`/pedido/${pix.orderId}?t=${pix.token}`);
    }, 4000);
    return () => {
      clearInterval(tick);
      clearInterval(poll);
    };
  }, [pix, router]);

  const remaining = pix ? Math.max(0, new Date(pix.expiresAt).getTime() - now) : 0;
  const venueLine = `${data.venueName} · ${data.city}/${data.state} · ${data.dateLabel}${data.timeLabel ? ` às ${data.timeLabel}` : ""}`;
  const ctaLabel = method === "pix" ? "Pagar com Pix →" : "Finalizar compra →";

  return (
    <div className="tpl" ref={rootRef} data-theme={theme} style={paletteStyle(data.palette)}>
      {!live && <div className="preview-banner">Pré-visualização — a página pública só existe depois de publicar.</div>}
      {live && data.demo && (
        <div className="demo-banner" role="note">
          🧪 Ambiente de teste · os pagamentos são simulados e nenhum valor é cobrado
        </div>
      )}
      <header className="nav">
        <div className="nav-inner">
          <div className="nav-logo">
            {data.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logoUrl} alt={data.artistName} />
            ) : (
              data.artistName
            )}
          </div>
          <button className="theme-toggle" type="button" onClick={toggleTheme} aria-label="Alternar tema claro/escuro">
            {theme === "dark" ? "☀️" : "🌙"}
          </button>
        </div>
      </header>

      {data.cover && (
        <div className="event-cover">
          <div className="event-cover-bg" style={{ backgroundImage: `url(${data.cover.desktop})` }} aria-hidden />
          <picture>
            {data.cover.mobile && <source media="(max-width: 640px)" srcSet={data.cover.mobile} />}
            <img src={data.cover.desktop} alt={`${data.artistName} — ${data.showName}`} />
          </picture>
        </div>
      )}

      <div className="event-strip">
        <div className="event-strip-inner">
          <div className="event-eyebrow">Finalizando compra</div>
          <div className="event-title">{data.showName}</div>
          <div className="event-chips">
            {data.ageRatingLabel && (
              <span className={`age-chip age-${data.ageRatingLabel === "Livre" ? "L" : data.ageRatingLabel.slice(0, 2)}`} title="Classificação indicativa">
                {data.ageRatingLabel === "Livre" ? "L" : data.ageRatingLabel.slice(0, 2)}
              </span>
            )}
            <span className="chip-soft">Evento presencial</span>
            <span className="chip-installments">💳 Parcele em até 12x</span>
            <button type="button" className="chip-share" onClick={share}>
              {shared ? "Link copiado!" : "↗ Compartilhar"}
            </button>
          </div>
          <div className="event-info">
            <div className="event-info-item">
              <span className="event-info-icon" aria-hidden>📅</span>
              <div>
                <strong>{data.longDateLabel}</strong>
                {data.timeLabel && (
                  <span>
                    Início às {data.timeLabel}
                    {data.endLabel && ` · término às ${data.endLabel}`}
                    {data.doorsLabel && ` · portões às ${data.doorsLabel}`}
                  </span>
                )}
              </div>
            </div>
            <div className="event-info-item">
              <span className="event-info-icon" aria-hidden>📍</span>
              <div>
                <strong>{data.venueName}</strong>
                <span>
                  {/* Não repete a cidade quando o endereço já traz ela. */}
                  {data.venueAddress && data.venueAddress.toLowerCase().includes(data.city.toLowerCase())
                    ? data.venueAddress
                    : [data.venueAddress, `${data.city}/${data.state}`].filter(Boolean).join(" · ")}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="vsl-intro">
        {/* Com vídeo (Reels 9:16): título, texto e CTA à esquerda, vídeo à direita; no celular o texto vem antes. */}
        <div className={`vsl-inner ${data.video ? "with-reels" : "no-video"}`}>
          <div className="vsl-copy">
            <div className="event-eyebrow">Não perca essa</div>
            <h1 className="vsl-title">
              <Headline text={data.vslHeadline} city={data.city} />
            </h1>
            {data.vslSubtitle && <p className="vsl-sub">{data.vslSubtitle}</p>}
            <button
              className="vsl-cta"
              type="button"
              onClick={() => document.getElementById("checkoutSection")?.scrollIntoView({ behavior: "smooth" })}
            >
              {data.vslCtaLabel} ↓
            </button>
            <div className="vsl-trust">🔒 Compra segura · ingresso enviado por e-mail na hora</div>
          </div>
          {data.video && <VslVideo video={data.video} />}
        </div>
      </section>

      <div className="wrap" id="checkoutSection">
        <div className="checkout-heading">
          <h2>Finalize sua compra</h2>
          <p>
            {data.seated ? "Poltrona, lote, seus dados e pagamento" : "Lote, seus dados e pagamento"} — tudo em uma
            página só.
          </p>
        </div>
        <div className="checkout-grid">
          <div className="card form-card" onFocusCapture={onFirstInteraction} onClickCapture={onFirstInteraction}>
            {pix ? (
              <div className="pix-result">
                <div className="step-label">
                  <span className="step-num">✓</span> Pague com Pix para garantir seu ingresso
                </div>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={`data:image/png;base64,${pix.qrImage}`} alt="QR Code do Pix" />
                <textarea className="pix-code" readOnly rows={3} value={pix.payload} aria-label="Pix copia e cola" />
                <button className="ghost-btn" type="button" onClick={() => navigator.clipboard?.writeText(pix.payload)}>
                  Copiar código Pix
                </button>
                <div className="pix-timer">
                  {remaining > 0
                    ? `Reservamos ${data.seated ? "sua poltrona" : "seu ingresso"} por ${Math.floor(remaining / 60000)}:${String(
                        Math.floor((remaining % 60000) / 1000),
                      ).padStart(2, "0")}. Assim que o pagamento cair, você recebe a confirmação aqui.`
                    : "O prazo do Pix acabou. Recarregue a página para tentar de novo."}
                </div>
                {pix.devPayUrl && (
                  <p className="secure-note">
                    Ambiente de teste: <a href={pix.devPayUrl}>simular o pagamento deste Pix</a>
                  </p>
                )}
              </div>
            ) : (
              <>
                {data.seated && (
                  <>
                    <div className="step-label">
                      <span className="step-num">1</span> Escolha sua poltrona
                    </div>
                    <div className="seat-legend">
                      <span>
                        <i className="dot available" /> Disponível
                      </span>
                      <span>
                        <i className="dot selected" /> Selecionado
                      </span>
                      <span>
                        <i className="dot occupied" /> Ocupado
                      </span>
                    </div>
                    <div className="stage-label">PALCO</div>
                    <div className="seat-grid" ref={seatGridRef}>
                      {data.seatRows.map((r) => (
                        <div className="seat-row" key={r.row}>
                          <span className="seat-row-label">{r.row}</span>
                          {r.seats.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              disabled={s.taken}
                              className={`seat${s.taken ? " occupied" : ""}${s.id === seatId ? " selected" : ""}`}
                              aria-label={`Poltrona ${r.row}${s.number}${s.taken ? " (ocupada)" : " (disponível)"}`}
                              aria-pressed={s.id === seatId}
                              onClick={() => {
                                setSeatId(s.id);
                                setErrors((e) => ({ ...e, seat: "" }));
                              }}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                    <div className="seat-picked">
                      {seatCode ? `Poltrona selecionada: ${seatCode}` : "Nenhuma poltrona selecionada ainda."}
                    </div>
                  </>
                )}

                <div className="step-label">
                  <span className="step-num">{data.seated ? 2 : 1}</span> {data.seated ? "Escolha o lote" : "Escolha seus ingressos"}
                </div>
                {data.seated ? (
                  <div className="lot-options">
                    {data.lots.map((l) => (
                      <label key={l.id} className={`lot-option${qty[l.id] ? " selected" : ""}${l.available ? "" : " disabled"}`}>
                        <span className="lot-name">
                          <input
                            type="radio"
                            name="lot"
                            checked={!!qty[l.id]}
                            disabled={!l.available}
                            onChange={() => setQty({ [l.id]: 1 })}
                          />
                          {l.name}
                        </span>
                        <span className="lot-price">{l.available ? formatBRL(l.priceCents) : "Esgotado"}</span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="ticket-list">
                    {data.lots.map((l) => {
                      const n = qty[l.id] ?? 0;
                      const fee = serviceFeeCents(l.priceCents);
                      const perInstallment = Math.round(installmentTotalCents(l.priceCents + fee, 12) / 12);
                      const canAdd = l.available && n < l.remaining && count < data.maxPerOrder;
                      return (
                        <div key={l.id} className={`ticket-card${n > 0 ? " selected" : ""}${l.available ? "" : " disabled"}`}>
                          <div className="ticket-info">
                            <div className="ticket-name">{l.name}</div>
                            {l.description && <div className="ticket-desc">{l.description}</div>}
                            {l.isHalfPrice && (
                              <a className="ticket-rules" href="#meia-entrada">
                                Quem tem direito à meia-entrada?
                              </a>
                            )}
                            {l.available ? (
                              <>
                                <div className="ticket-price">
                                  <strong>{formatBRL(l.priceCents)}</strong> <span>(+{formatBRL(fee).replace("R$", "").trim()} taxa)</span>
                                </div>
                                <span className="ticket-installments">em até 12x {formatBRL(perInstallment)}</span>
                                {l.salesEndLabel && <div className="ticket-until">{l.salesEndLabel}</div>}
                              </>
                            ) : (
                              <div className="ticket-soldout">Esgotado</div>
                            )}
                          </div>
                          <div className="ticket-stepper" role="group" aria-label={`Quantidade de ${l.name}`}>
                            <button type="button" className="step-minus" disabled={n === 0} onClick={() => changeQty(l.id, -1)} aria-label={`Remover um ${l.name}`}>
                              −
                            </button>
                            <span aria-live="polite">{n}</span>
                            <button type="button" className="step-plus" disabled={!canAdd} onClick={() => changeQty(l.id, 1)} aria-label={`Adicionar um ${l.name}`}>
                              +
                            </button>
                          </div>
                        </div>
                      );
                    })}
                    {count >= data.maxPerOrder && <div className="ticket-limit-note">Máximo de {data.maxPerOrder} ingressos por compra.</div>}
                    <div className="fee-explain">
                      <button type="button" className="link-btn" aria-expanded={showFee} onClick={() => setShowFee((v) => !v)}>
                        ⓘ Entenda nossa taxa
                      </button>
                      {showFee && <p>{data.seller.feeText}</p>}
                    </div>
                  </div>
                )}
                {errors.lot && <div className="field-error">{errors.lot}</div>}

                <div className="step-label">
                  <span className="step-num">{data.seated ? 3 : 2}</span> Seus dados
                </div>
                <div className="field-row">
                  <label htmlFor="buyerName">Nome completo</label>
                  <input
                    id="buyerName"
                    autoComplete="name"
                    placeholder="Nome Sobrenome"
                    value={name}
                    aria-invalid={!!errors.name}
                    onChange={(e) => setName(e.target.value)}
                  />
                  {errors.name && <div className="field-error">{errors.name}</div>}
                </div>
                <div className="field-grid">
                  <div className="field-row">
                    <label htmlFor="buyerEmail">E-mail</label>
                    <input
                      id="buyerEmail"
                      type="email"
                      autoComplete="email"
                      placeholder="exemplo@email.com.br"
                      value={email}
                      aria-invalid={!!errors.email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    {errors.email && <div className="field-error">{errors.email}</div>}
                  </div>
                  <div className="field-row">
                    <label htmlFor="buyerEmailConfirm">Confirmar e-mail</label>
                    <input
                      id="buyerEmailConfirm"
                      type="email"
                      autoComplete="off"
                      placeholder="exemplo@email.com.br"
                      value={emailConfirm}
                      aria-invalid={!!errors.emailConfirm}
                      onChange={(e) => setEmailConfirm(e.target.value)}
                    />
                    {errors.emailConfirm && <div className="field-error">{errors.emailConfirm}</div>}
                  </div>
                </div>
                <div className="field-row">
                  <label htmlFor="buyerPhone">Celular (WhatsApp)</label>
                  <input
                    id="buyerPhone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    placeholder="(47) 99999-9999"
                    value={phone}
                    aria-invalid={!!errors.phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                  />
                  {errors.phone && <div className="field-error">{errors.phone}</div>}
                </div>

                <div className="step-label">
                  <span className="step-num">{data.seated ? 4 : 3}</span> Pagamento e dados do comprador
                </div>
                <div className="pay-methods">
                  <label className={`pay-method${method === "credit_card" ? " selected" : ""}`}>
                    <input
                      type="radio"
                      name="paymethod"
                      checked={method === "credit_card"}
                      onChange={() => chooseMethod("credit_card")}
                    />
                    <span className="pay-icon">💳</span>
                    <span className="pay-name">Cartão de crédito</span>
                    <span className="pay-badge">Parcele em até 12x</span>
                  </label>
                  <label className={`pay-method${method === "pix" ? " selected" : ""}`}>
                    <input type="radio" name="paymethod" checked={method === "pix"} onChange={() => chooseMethod("pix")} />
                    <span className="pay-icon pay-icon-pix">Pix</span>
                    <span className="pay-name">Pix</span>
                  </label>
                </div>

                <div className="pay-panel">
                  {method === "credit_card" ? (
                    <>
                      <p>
                        Os dados do cartão são digitados no ambiente seguro da Asaas, na próxima tela. Nenhum dado do
                        cartão passa por aqui.
                      </p>
                      <div className="pay-brands small" aria-label="Bandeiras aceitas">
                        {["Visa", "Mastercard", "Elo", "Amex", "Hipercard"].map((b) => (
                          <span key={b}>{b}</span>
                        ))}
                      </div>
                      <div className="field-row">
                        <label htmlFor="installments">Parcelas</label>
                        <select
                          id="installments"
                          value={installments}
                          onChange={(e) => setInstallments(Number(e.target.value) as InstallmentCount)}
                        >
                          {INSTALLMENT_OPTIONS.map((o) => {
                            const total = installmentTotalCents(baseCents, o.count);
                            return (
                              <option key={o.count} value={o.count}>
                                {o.count}x de {formatBRL(Math.round(total / o.count))} {o.interest ? "com juros" : "sem juros"}
                              </option>
                            );
                          })}
                        </select>
                      </div>
                      <div className="field-row">
                        <label htmlFor="doc">CPF/CNPJ do comprador</label>
                        <input
                          id="doc"
                          inputMode="numeric"
                          placeholder="000.000.000-00"
                          value={doc}
                          aria-invalid={!!errors.doc}
                          onChange={(e) => setDoc(formatCpfCnpj(e.target.value))}
                        />
                        {errors.doc && <div className="field-error">{errors.doc}</div>}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="pix-info-title">Como pagar com Pix?</div>
                      <p>
                        Ao finalizar a compra, será gerado um <strong>QR Code de pagamento</strong>. Use o aplicativo do
                        seu banco ou carteira digital para escaneá-lo e realizar o pagamento.
                      </p>
                      <div className="doc-type-row">
                        <label className="doc-radio">
                          <input type="radio" name="docType" checked={docType === "cpf"} onChange={() => setDocType("cpf")} />{" "}
                          CPF
                        </label>
                        <label className="doc-radio">
                          <input
                            type="radio"
                            name="docType"
                            checked={docType === "cnpj"}
                            onChange={() => setDocType("cnpj")}
                          />{" "}
                          CNPJ
                        </label>
                      </div>
                      <div className="field-row">
                        <label htmlFor="doc">{docType === "cpf" ? "CPF" : "CNPJ"}</label>
                        <input
                          id="doc"
                          inputMode="numeric"
                          placeholder={docType === "cpf" ? "000.000.000-00" : "00.000.000/0000-00"}
                          value={doc}
                          aria-invalid={!!errors.doc}
                          onChange={(e) => setDoc(formatCpfCnpj(e.target.value))}
                        />
                        {errors.doc && <div className="field-error">{errors.doc}</div>}
                      </div>
                    </>
                  )}
                </div>

                <div className="consents">
                  <label className={`consent${errors.terms ? " invalid" : ""}`}>
                    <input
                      type="checkbox"
                      checked={acceptTerms}
                      onChange={(e) => {
                        setAcceptTerms(e.target.checked);
                        setErrors((x) => ({ ...x, terms: "" }));
                      }}
                    />
                    <span>
                      Li e aceito os{" "}
                      <a href={data.termsUrl} target="_blank" rel="noreferrer">
                        Termos de uso
                      </a>
                      , a{" "}
                      <a href={data.privacyUrl} target="_blank" rel="noreferrer">
                        Política de privacidade
                      </a>{" "}
                      e a <a href="#politica">política de cancelamento</a>.
                    </span>
                  </label>
                  {errors.terms && <div className="field-error">{errors.terms}</div>}
                  <label className="consent">
                    <input type="checkbox" checked={marketingOptIn} onChange={(e) => setMarketingOptIn(e.target.checked)} />
                    <span>Aceito receber informações deste e de outros shows de comédia. (Opcional; você pode cancelar quando quiser.)</span>
                  </label>
                </div>

                <button className="checkout-cta" type="button" onClick={submit} disabled={submitting || count === 0}>
                  {submitting ? "Processando…" : count === 0 ? "Selecione um ingresso" : ctaLabel}
                </button>
                {formError && <div className="form-error">{formError}</div>}
                <p className="legal-note">
                  Cancelamento em até 7 dias após a compra e até 48 h antes do evento. <a href="#politica">Ver política</a>.
                </p>
              </>
            )}
          </div>

          <div className="card summary-card">
            <div className="summary-event">{data.showName}</div>
            <div className="summary-venue">{venueLine}</div>
            {data.seated && (
              <div className="summary-line">
                <span>Poltrona</span>
                <span>{seatCode ?? "—"}</span>
              </div>
            )}
            {selected.length === 0 ? (
              <div className="summary-line">
                <span>Ingressos</span>
                <span>—</span>
              </div>
            ) : (
              selected.map((i) => (
                <div className="summary-line" key={i.lot.id}>
                  <span>
                    {i.quantity}x {i.lot.name}
                  </span>
                  <span>{formatBRL(i.lot.priceCents * i.quantity)}</span>
                </div>
              ))
            )}
            <div className="summary-line">
              <span>Taxa de serviço</span>
              <span>{formatBRL(feeCents)}</span>
            </div>
            {totalCents !== baseCents && (
              <div className="summary-line">
                <span>Juros do parcelamento</span>
                <span>{formatBRL(totalCents - baseCents)}</span>
              </div>
            )}
            <div className="summary-total">
              <span>Total</span>
              <span>{formatBRL(totalCents)}</span>
            </div>
            <div className="summary-note">Ingresso digital, enviado por e-mail após confirmação.</div>
            {errors.seat && <div className="warn-inline">⚠ {errors.seat}</div>}
          </div>
        </div>
      </div>

      <EventInfo data={data} />
      <EventFooter data={data} />
    </div>
  );
}
