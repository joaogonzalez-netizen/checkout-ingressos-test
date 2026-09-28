import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

/** Endereço principal: abre o evento escolhido em Configurações (se publicado), senão o backoffice. */
export default async function Home() {
  const { homeEventSlug } = await getSettings();
  if (homeEventSlug) {
    const event = await db.event.findUnique({ where: { slug: homeEventSlug }, select: { status: true, archivedAt: true } });
    if (event && event.status !== "draft" && !event.archivedAt) redirect(`/e/${homeEventSlug}`);
  }
  redirect("/admin");
}
