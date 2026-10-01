import { redirect } from "next/navigation";
import { getEvent } from "../data";

/** "Configurar": rascunho retoma na próxima etapa pendente; evento já publicado abre em Dados do evento. */
export default async function EditIndex({ params }: PageProps<"/admin/events/[id]/edit">) {
  const { id } = await params;
  const event = await getEvent(id);
  const step = event.status === "draft" ? Math.min(Math.max(event.wizardStep + 1, 1), 6) : 1;
  redirect(`/admin/events/${id}/edit/${step}`);
}
