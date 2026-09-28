"use client";

import { useActionState } from "react";
import { formatCpfCnpj, formatPhone } from "@/lib/documents";
import { saveSettings, type SettingsState } from "./actions";

type Values = {
  sellerName: string;
  sellerCnpj: string;
  sellerAddress: string;
  contactEmail: string;
  contactWhatsapp: string;
  halfPriceText: string;
  cancellationText: string;
  feeText: string;
  homeEventSlug: string;
};

export function SettingsForm({
  initial,
  missingLegal,
  events,
}: {
  initial: Values;
  missingLegal: boolean;
  events: { slug: string; label: string }[];
}) {
  const [state, action, pending] = useActionState<SettingsState, FormData>(saveSettings, {});
  return (
    <form action={action} className="bo-form">
      <div className="bo-card">
        <h2>Página inicial do site</h2>
        <label className="bo-field" style={{ maxWidth: 520 }}>
          <span>Evento aberto no endereço principal</span>
          <select name="homeEventSlug" defaultValue={initial.homeEventSlug}>
            <option value="">Nenhum (o endereço principal abre o backoffice)</option>
            {events.map((e) => (
              <option key={e.slug} value={e.slug}>
                {e.label}
              </option>
            ))}
          </select>
          <span className="bo-hint">Quem acessar o domínio sem caminho cai direto na página de vendas desse evento.</span>
        </label>
      </div>

      <div className="bo-card">
        <h2>Quem vende</h2>
        <p className="bo-hint" style={{ marginTop: -6, marginBottom: 12 }}>
          Aparece no rodapé e em &quot;Sobre o produtor&quot; de todas as páginas de venda. A identificação do fornecedor é obrigatória em venda online (Decreto 7.962/2013).
        </p>
        {missingLegal && <p className="bo-warn" style={{ marginBottom: 12 }}>Razão social e CNPJ ainda não foram preenchidos.</p>}
        <div className="bo-form-grid">
          <label className="bo-field">
            <span>Razão social</span>
            <input name="sellerName" defaultValue={initial.sellerName} placeholder="Nome Empresarial Ltda." />
          </label>
          <label className="bo-field">
            <span>CNPJ</span>
            <input name="sellerCnpj" defaultValue={initial.sellerCnpj ? formatCpfCnpj(initial.sellerCnpj) : ""} placeholder="00.000.000/0000-00" inputMode="numeric" />
          </label>
          <label className="bo-field span-2">
            <span>Endereço</span>
            <input name="sellerAddress" defaultValue={initial.sellerAddress} placeholder="Rua, número, bairro, cidade/UF, CEP" />
          </label>
          <label className="bo-field">
            <span>E-mail de atendimento</span>
            <input name="contactEmail" type="email" defaultValue={initial.contactEmail} placeholder="contato@empresa.com.br" />
          </label>
          <label className="bo-field">
            <span>WhatsApp de atendimento</span>
            <input name="contactWhatsapp" defaultValue={initial.contactWhatsapp ? formatPhone(initial.contactWhatsapp) : ""} placeholder="(47) 99999-9999" inputMode="tel" />
          </label>
        </div>
      </div>

      <div className="bo-card">
        <h2>Textos legais</h2>
        <p className="bo-hint" style={{ marginTop: -6, marginBottom: 12 }}>
          Já vêm com um texto padrão (rascunho: revise com o jurídico). Deixe vazio para voltar ao padrão.
        </p>
        <label className="bo-field">
          <span>Meia-entrada (quem tem direito e documentos)</span>
          <textarea name="halfPriceText" rows={9} defaultValue={initial.halfPriceText} />
        </label>
        <label className="bo-field">
          <span>Política de cancelamento</span>
          <textarea name="cancellationText" rows={4} defaultValue={initial.cancellationText} />
        </label>
        <label className="bo-field">
          <span>Entenda a taxa</span>
          <textarea name="feeText" rows={3} defaultValue={initial.feeText} />
        </label>
      </div>

      {state.error && <p className="bo-error">{state.error}</p>}
      {state.saved && <p className="bo-success">Configurações salvas. Já valem para todas as páginas de venda.</p>}
      <div className="bo-actions">
        <button className="bo-btn bo-btn-primary" disabled={pending}>
          {pending ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>
    </form>
  );
}
