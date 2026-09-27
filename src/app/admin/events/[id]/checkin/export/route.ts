import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import type { TicketStatus } from "@/generated/prisma/client";

const STATUS_LABEL: Record<TicketStatus, string> = { valid: "Pendente", used: "Validado", canceled: "Cancelado" };

function csvCell(v: string) {
  // Aspas + escape; prefixo ' evita fórmula ao abrir no Excel (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** Exportar participantes (CSV com ; e BOM, para abrir direto no Excel em pt-BR). */
export async function GET(req: NextRequest, ctx: RouteContext<"/admin/events/[id]/checkin/export">) {
  await requireAdmin();
  const { id } = await ctx.params;
  const sp = req.nextUrl.searchParams;
  const status = sp.get("status");
  const event = await db.event.findUniqueOrThrow({ where: { id } });
  const tickets = await db.ticket.findMany({
    where: {
      eventId: id,
      status: status && status in STATUS_LABEL ? (status as TicketStatus) : undefined,
      lotId: sp.get("lot") || undefined,
    },
    include: { order: true, lot: true, seat: true },
    orderBy: { order: { buyerName: "asc" } },
  });
  const header = ["Participante", "E-mail", "Telefone", "CPF/CNPJ", "Tipo de ingresso", "Poltrona", "Código", "Pedido", "Status", "Check-in em", "Validado por", "Via", "Aceita comunicações"];
  const rows = tickets.map((t) => [
    t.order.buyerName,
    t.order.buyerEmail,
    t.order.buyerPhone ? formatPhone(t.order.buyerPhone) : "",
    formatCpfCnpj(t.order.buyerCpfCnpj),
    t.lot.name,
    t.seat ? `${t.seat.row}${t.seat.number}` : "",
    t.code,
    t.orderId.slice(-8).toUpperCase(),
    STATUS_LABEL[t.status],
    t.usedAt ? t.usedAt.toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    t.usedBy ?? "",
    t.validationMethod ?? "",
    t.order.marketingOptIn ? "Sim" : "Não",
  ]);
  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participantes-${event.slug ?? id}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
