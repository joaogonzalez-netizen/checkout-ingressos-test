import { redirect } from "next/navigation";
import { getEvent } from "../data";

/** Retoma o rascunho na próxima etapa pendente. */
export default async function EditIndex({ params }: PageProps<"/admin/events/[id]/edit">) {
  const { id } = await params;
  const event = await getEvent(id);
  redirect(`/admin/events/${id}/edit/${Math.min(Math.max(event.wizardStep + 1, 1), 6)}`);
}
