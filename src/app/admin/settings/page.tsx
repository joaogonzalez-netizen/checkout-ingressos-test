import { requireAdmin } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { SettingsForm } from "./SettingsForm";

export const metadata = { title: "Configurações · Backoffice" };

export default async function SettingsPage() {
  await requireAdmin();
  const s = await getSettings();
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
        initial={{
          sellerName: s.sellerName ?? "",
          sellerCnpj: s.sellerCnpj ?? "",
          sellerAddress: s.sellerAddress ?? "",
          contactEmail: s.contactEmail ?? "",
          contactWhatsapp: s.contactWhatsapp ?? "",
          halfPriceText: s.halfPriceText,
          cancellationText: s.cancellationText,
          feeText: s.feeText,
        }}
      />
    </>
  );
}
