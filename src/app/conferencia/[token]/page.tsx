import "../door.css";
import type { Metadata } from "next";
import { findUsableAccess, readDoorSession } from "@/lib/door";
import { doorStats } from "@/lib/door-orders";
import { PinForm } from "./PinForm";
import { DoorApp } from "./DoorApp";

export const metadata: Metadata = { title: "Conferência", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** Conferência da portaria. Endereço secreto por evento; nada aqui aparece sem o PIN. */
export default async function DoorPage({ params }: PageProps<"/conferencia/[token]">) {
  const { token } = await params;
  const access = await findUsableAccess(token);
  if (!access) {
    return (
      <main className="dr dr-center">
        <div className="dr-card">
          <h1>Link indisponível</h1>
          <p>Este link de conferência não está ativo. Peça um novo link a quem organiza o evento.</p>
        </div>
      </main>
    );
  }
  const eventName = access.event.showName ?? "Evento";
  const session = await readDoorSession(token);
  if (!session) return <PinForm token={token} eventName={eventName} />;
  return <DoorApp token={token} eventName={eventName} staffName={session.name} initialStats={await doorStats(session.eventId)} />;
}
