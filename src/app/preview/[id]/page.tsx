import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { toTemplateData } from "@/lib/template-data";
import { CheckoutTemplate } from "@/components/checkout/CheckoutTemplate";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pré-visualização", robots: { index: false } };

/** Preview do template para rascunhos (fica fora do layout do admin para renderizar em tela cheia). */
export default async function PreviewPage({ params }: PageProps<"/preview/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const event = await db.event.findUnique({ where: { id }, include: { artist: true, lots: true, seats: true, media: true } });
  if (!event) notFound();
  return <CheckoutTemplate mode="preview" data={toTemplateData(event, { pixelEnabled: false, settings: await getSettings() })} />;
}
