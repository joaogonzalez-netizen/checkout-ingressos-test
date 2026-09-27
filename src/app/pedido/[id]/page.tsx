import "@/components/checkout/checkout.css";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { safeEqual } from "@/lib/crypto";
import { reconcileOrder } from "@/lib/orders";
import { resolvePixel } from "@/lib/meta";
import { paletteStyle, parsePalette } from "@/lib/palette";
import { formatBRL } from "@/lib/money";
import { formatDateTime } from "@/lib/dates";
import { MetaPixel } from "@/components/checkout/MetaPixel";
import { OrderStatusPoller, PurchasePixel } from "./client";

export const dynamic = "force-dynamic";

const COPY = {
  pending: { title: "Aguardando confirmação do pagamento", body: "Assim que a Asaas confirmar, esta página atualiza sozinha." },
  paid: { title: "Compra confirmada!", body: "Seu ingresso foi emitido e será enviado para o seu e-mail." },
  failed: { title: "Pagamento não aprovado", body: "Nenhum valor foi cobrado. Você pode tentar de novo pela página do evento." },
  expired: { title: "O prazo de pagamento acabou", body: "A reserva foi liberada. Você pode fazer uma nova compra pela página do evento." },
  canceled: { title: "Pedido cancelado", body: "A reserva foi liberada." },
  refunded: { title: "Pedido estornado", body: "O valor foi devolvido e o ingresso cancelado." },
} as const;

export default async function OrderPage({ params, searchParams }: PageProps<"/pedido/[id]">) {
  const { id } = await params;
  const { t } = await searchParams;
  const token = typeof t === "string" ? t : "";

  await reconcileOrder(id);
  const order = await db.order.findUnique({
    where: { id },
    include: {
      event: { include: { artist: true } },
      seat: true,
      items: { include: { lot: true } },
      tickets: { include: { lot: true }, orderBy: { createdAt: "asc" } },
    },
  });
  if (!order || !safeEqual(order.accessToken, token)) notFound();

  const { event } = order;
  const copy = COPY[order.status];
  const pixel = resolvePixel(event);

  return (
    <div className="tpl" style={paletteStyle(parsePalette(event.artist.colors))}>
      {pixel && order.status === "paid" && (
        <>
          <MetaPixel pixelId={pixel.pixelId} pageViewEventId={`pageview-order-${order.id}`} />
          <PurchasePixel eventId={`purchase-${order.id}`} valueCents={order.totalCents} />
        </>
      )}
      {order.status === "pending" && <OrderStatusPoller orderId={order.id} token={token} />}
      <div className="event-strip">
        <div className="event-strip-inner">
          <div className="event-eyebrow">Pedido {order.id.slice(-8).toUpperCase()}</div>
          <div className="event-title">{copy.title}</div>
          <div className="event-meta">{copy.body}</div>
        </div>
      </div>
      <div className="wrap">
        <div className="card summary-card" style={{ position: "static", maxWidth: 520, margin: "0 auto" }}>
          <div className="summary-event">{event.showName}</div>
          <div className="summary-venue">
            {event.city}/{event.state} · {event.venueName} · {formatDateTime(event.startsAt)}
          </div>
          {order.seat && (
            <div className="summary-line">
              <span>Poltrona</span>
              <span>
                {order.seat.row}
                {order.seat.number}
              </span>
            </div>
          )}
          {order.items.map((i) => (
            <div className="summary-line" key={i.id}>
              <span>
                {i.quantity}x {i.lot.name}
              </span>
              <span>{formatBRL(i.unitCents * i.quantity)}</span>
            </div>
          ))}
          <div className="summary-line">
            <span>Taxa de serviço</span>
            <span>{formatBRL(order.feeCents)}</span>
          </div>
          <div className="summary-line">
            <span>Pagamento</span>
            <span>{order.paymentMethod === "pix" ? "Pix" : `Cartão em ${order.installments}x`}</span>
          </div>
          {order.tickets.length > 0 && (
            <div className="summary-tickets">
              <span>{order.tickets.length === 1 ? "Código do ingresso" : `Códigos dos ${order.tickets.length} ingressos`}</span>
              <ul>
                {order.tickets.map((t) => (
                  <li key={t.id}>
                    <strong>{t.code}</strong> <small>{t.lot.name}</small>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="summary-total">
            <span>Total</span>
            <span>{formatBRL(order.totalCents)}</span>
          </div>
          <div className="summary-note">Enviado para {order.buyerEmail}.</div>
          {order.status === "pending" && order.invoiceUrl && order.paymentMethod === "credit_card" && (
            <p className="summary-note">
              Ainda não pagou? <a href={order.invoiceUrl} style={{ textDecoration: "underline" }}>Voltar ao pagamento</a>
            </p>
          )}
          {["failed", "expired", "canceled"].includes(order.status) && event.slug && (
            <p className="summary-note">
              <a href={`/e/${event.slug}`} style={{ textDecoration: "underline" }}>Voltar para a página do evento</a>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
