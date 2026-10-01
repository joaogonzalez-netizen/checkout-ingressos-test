import Link from "next/link";
import { db } from "@/lib/db";
import { env } from "@/lib/env";
import { formatPhone } from "@/lib/documents";
import type { Prisma } from "@/generated/prisma/client";
import { Icon } from "../../../components/Icon";
import { getEvent } from "../data";
import { checkInFromList, generateTestAttendees, undoFromList, validateEntry } from "./actions";
import { ValidateBox } from "./ValidateBox";
import { CopyButton } from "./CopyButton";
import { PrintButton } from "./PrintButton";

const METHOD_LABEL = { qr: "QR", code: "código", manual: "manual", list: "lista" } as const;

function time(d: Date) {
  return d.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

const ACCENTED = "áàâãäéèêëíìîïóòôõöúùûüç";
const PLAIN = "aaaaaeeeeiiiiooooouuuuc";
const unaccent = (v: string) => [...v.toLowerCase()].map((c) => PLAIN[ACCENTED.indexOf(c)] ?? c).join("");
/** % e _ são curingas no LIKE: escapa para buscar o caractere literal. */
const likeLiteral = (v: string) => v.replace(/[\\%_]/g, (c) => `\\${c}`);

/** Busca única: nome (sem diferenciar acento), e-mail ou telefone; também código do ingresso ou nº do pedido. */
async function searchWhere(eventId: string, q: string): Promise<Prisma.TicketWhereInput> {
  if (!q) return {};
  const digits = q.replace(/\D/g, "");
  // Na portaria ninguém digita acento: "natalia" precisa achar "Natália". SQL próprio porque o
  // "contains" do Prisma não escapa % e _ (buscar "%" traria todo mundo).
  const pattern = `%${likeLiteral(unaccent(q))}%`;
  const byText = await db.$queryRaw<{ id: string }[]>`
    SELECT t.id FROM tickets t JOIN orders o ON o.id = t.order_id
    WHERE t.event_id = ${eventId}
      AND (translate(lower(o.buyer_name), ${ACCENTED}, ${PLAIN}) LIKE ${pattern} OR lower(o.buyer_email) LIKE ${pattern})`;
  return {
    OR: [
      { id: { in: byText.map((r) => r.id) } },
      ...(digits.length >= 4 ? [{ order: { buyerPhone: { contains: digits } } }] : []),
      { code: q.toUpperCase().replace(/\s/g, "") },
      ...(/^[a-z0-9]{4,}$/i.test(q) ? [{ orderId: { endsWith: q.toLowerCase() } }] : []),
    ],
  };
}

export default async function CheckinPage({ params, searchParams }: PageProps<"/admin/events/[id]/checkin">) {
  const { id } = await params;
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const codeMode = sp.modo === "codigo";
  const event = await getEvent(id);
  const base = `/admin/events/${id}/checkin`;

  const [tickets, total, used] = await Promise.all([
    codeMode
      ? Promise.resolve([])
      : db.ticket.findMany({
          where: { eventId: id, status: { not: "canceled" }, ...(await searchWhere(id, q)) },
          include: { order: true, lot: true, seat: true },
          orderBy: [{ order: { buyerName: "asc" } }, { code: "asc" }],
          take: 2000,
        }),
    db.ticket.count({ where: { eventId: id, status: { not: "canceled" } } }),
    db.ticket.count({ where: { eventId: id, status: "used" } }),
  ]);

  return (
    <>
      <nav className="bo-tabs" aria-label="Modo de check-in">
        <Link href={base} aria-current={!codeMode ? "page" : undefined}>
          Lista
        </Link>
        <Link href={`${base}?modo=codigo`} aria-current={codeMode ? "page" : undefined}>
          Código / QR
        </Link>
      </nav>

      {codeMode ? (
        <>
          <div className="bo-checkin-counter" style={{ marginBottom: 12 }}>
            <span>Check-ins feitos</span>
            <b>
              <em>{used}</em> de {total}
            </b>
          </div>
          <ValidateBox action={validateEntry.bind(null, id)} />
        </>
      ) : (
        <div className="bo-card bo-checkin">
          <div className="bo-checkin-title">
            <h2>Lista de participantes</h2>
            <span className="bo-print-only">
              {event.showName} · {event.venueName}
            </span>
          </div>

          <div className="bo-checkin-bar">
            <form className="bo-search" role="search">
              <Icon name="search" size={18} />
              <input name="q" placeholder="Nome, e-mail ou telefone" defaultValue={q} autoComplete="off" autoFocus />
              {q && (
                <Link href={base} aria-label="Limpar busca">
                  <Icon name="close" size={16} />
                </Link>
              )}
            </form>
            <div className="bo-checkin-counter">
              <span>Check-ins feitos</span>
              <b>
                <em>{used}</em> de {total}
              </b>
            </div>
            <div className="bo-actions bo-no-print">
              <Link className="bo-btn bo-btn-pill" href={`${base}/export`} prefetch={false}>
                Exportar participantes
              </Link>
              <PrintButton />
              <Link className="bo-btn bo-btn-pill" href={q ? `${base}?q=${encodeURIComponent(q)}` : base}>
                Atualizar lista
              </Link>
            </div>
          </div>

          {tickets.length === 0 ? (
            <div className="bo-empty">{total === 0 ? "Nenhum ingresso emitido ainda." : `Ninguém encontrado para "${q}".`}</div>
          ) : (
            <div className="bo-table-wrap">
              <table className="bo-table bo-checkin-table">
                <thead>
                  <tr>
                    <th>Check-in</th>
                    <th>Participante</th>
                    <th>Check-in feito em</th>
                    <th>Tipo de ingresso</th>
                    <th>Nº do ingresso</th>
                    <th>Nº do pedido</th>
                  </tr>
                </thead>
                <tbody>
                  {tickets.map((t) => (
                    <tr key={t.id}>
                      <td>
                        {t.status === "valid" ? (
                          <form action={checkInFromList.bind(null, id, t.id)}>
                            <button className="bo-btn bo-btn-pill bo-btn-sm">Fazer check-in</button>
                          </form>
                        ) : (
                          <details className="bo-undo">
                            <summary>
                              <span className="bo-checked">✓ Check-in feito</span>
                            </summary>
                            <form action={undoFromList.bind(null, id, t.id)} className="bo-actions">
                              <input className="bo-input" name="reason" placeholder="Motivo (obrigatório)" required minLength={3} />
                              <button className="bo-btn bo-btn-sm bo-btn-danger">Desfazer</button>
                            </form>
                          </details>
                        )}
                      </td>
                      <td>
                        <span className="bo-participant">{t.order.buyerName}</span>
                        {t.order.buyerPhone && <div className="small muted">{formatPhone(t.order.buyerPhone)}</div>}
                      </td>
                      <td>
                        {t.usedAt ? (
                          <>
                            {time(t.usedAt)}
                            <div className="small muted">
                              via {METHOD_LABEL[t.validationMethod ?? "list"]}
                              {t.usedBy ? ` · ${t.usedBy}` : ""}
                            </div>
                          </>
                        ) : (
                          <span className="muted">---</span>
                        )}
                      </td>
                      <td>
                        {t.lot.name}
                        {t.seat && (
                          <div className="small muted">
                            Poltrona {t.seat.row}
                            {t.seat.number}
                          </div>
                        )}
                      </td>
                      <td>
                        <code>{t.code}</code>
                        {env.ASAAS_MOCK && (
                          <div className="bo-no-print" style={{ marginTop: 4 }}>
                            <CopyButton value={t.qrPayload} label="Copiar QR (teste)" />
                          </div>
                        )}
                      </td>
                      <td>
                        <code>{t.orderId.slice(-8).toUpperCase()}</code>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {env.ASAAS_MOCK && (
        <div className="bo-card bo-dev bo-no-print" style={{ marginTop: 16 }}>
          <h3>Ambiente de teste</h3>
          <p className="bo-hint">Cria 10 compradores com pedido pago e ingresso emitido, pelo mesmo caminho do checkout (sem Asaas). Só aparece em desenvolvimento.</p>
          <form action={generateTestAttendees.bind(null, id)}>
            <button className="bo-btn">Gerar 10 participantes de teste</button>
          </form>
        </div>
      )}
    </>
  );
}
