import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { formatDate } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";
import { ResetDemo } from "./ResetDemo";
import { env } from "@/lib/env";

export const metadata = { title: "Configurações · Backoffice" };

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
  const events = await db.event.findMany({
    where: { slug: { not: null }, status: { not: "draft" }, archivedAt: null },
    include: { artist: true },
    orderBy: { startsAt: "asc" },
  });
  return (
    <>
      <div className="bo-page-head">
        <div>
          <h1>Configurações</h1>
          <p className="muted">Preenchido uma vez, vale para todas as páginas de venda.</p>
        </div>
      </div>
      <SettingsForm
        missingLegal={!s.sellerName || !s.sellerCnpj}
        events={events.map((e) => ({ slug: e.slug!, label: `${e.artist.name} · ${e.showName} · ${e.city}/${e.state} · ${formatDate(e.startsAt)}` }))}
        initial={{
          sellerName: s.sellerName ?? "",
          sellerCnpj: s.sellerCnpj ?? "",
          sellerAddress: s.sellerAddress ?? "",
          contactEmail: s.contactEmail ?? "",
          contactWhatsapp: s.contactWhatsapp ?? "",
          halfPriceText: s.halfPriceText,
          cancellationText: s.cancellationText,
          feeText: s.feeText,
          homeEventSlug: s.homeEventSlug ?? "",
        }}
      />
      {env.ASAAS_MOCK && <ResetDemo />}
    </>
  );
}
