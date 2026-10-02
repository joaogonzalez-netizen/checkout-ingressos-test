import QRCode from "qrcode";
import { db } from "@/lib/db";
import { doorExpiresAt, doorUrl } from "@/lib/door";
import { formatDateTime } from "@/lib/dates";
import { DoorLinkControls } from "./DoorLinkControls";

/** Bloco "Conferência na porta" da aba Check-in: link do evento + PIN para a equipe, sem conta de admin. */
export async function DoorLinkCard({ eventId, event }: { eventId: string; event: { status: string; startsAt: Date | null; endsAt: Date | null } }) {
  const access = await db.checkinAccess.findFirst({ where: { eventId, revokedAt: null }, orderBy: { createdAt: "desc" } });
  const expires = doorExpiresAt(event);
  const expired = !!expires && expires < new Date();
  const url = access ? doorUrl(access.token) : null;
  const qr = url ? await QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: "M" }) : null;

  return (
    <div className="bo-card bo-no-print" style={{ marginBottom: 16 }}>
      <h2>Conferência na porta</h2>
      <p className="muted" style={{ marginTop: -6 }}>
        Um link só deste evento para a equipe da porta, aberto no celular, sem login do backoffice. Lê o QR pela câmera ou busca por código de 4 caracteres, nome ou
        telefone, e mostra a compra inteira com todos os ingressos.
      </p>
      <DoorLinkControls
        eventId={eventId}
        canCreate={event.status !== "draft"}
        active={
          access && url
            ? {
                url,
                qr,
                createdAt: formatDateTime(access.createdAt),
                expiresAt: expires ? formatDateTime(expires) : null,
                expired,
              }
            : null
        }
      />
    </div>
  );
}
