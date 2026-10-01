"use client";

import { useActionState, useState } from "react";
import { testPixel, type StepState } from "../../../actions";
import { StepForm } from "../StepForm";

export function Step5Pixel({
  eventId,
  action,
  artist,
  initial,
}: {
  eventId: string;
  action: (prev: StepState, form: FormData) => Promise<StepState>;
  artist: { name: string; pixelId: string | null; hasToken: boolean };
  initial: { override: string; hasOverrideToken: boolean };
}) {
  const [mode, setMode] = useState<"inherit" | "override">(initial.override ? "override" : "inherit");
  const [testState, testAction, testing] = useActionState<StepState, FormData>(testPixel.bind(null, eventId), {});

  return (
    <>
      <StepForm action={action} eventId={eventId} step={5} hidden={{ pixelMode: mode }}>
        <div className="bo-card">
          <h2>Pixel e rastreamento (Meta)</h2>
          <p className="muted small" style={{ marginTop: -6 }}>
            O sistema monta o snippet no &lt;head&gt; a partir do ID. Eventos: PageView, ViewContent, InitiateCheckout,
            AddPaymentInfo e Purchase (server-side, após o webhook da Asaas).
          </p>
          <div className="bo-radio-row" style={{ marginBottom: 14 }}>
            <label className="bo-radio-card">
              <input type="radio" checked={mode === "inherit"} onChange={() => setMode("inherit")} />
              <span>
                <b>Usar o Pixel de {artist.name}</b>
                <br />
                <span className="small muted">
                  {artist.pixelId ? (
                    <>
                      <code>{artist.pixelId}</code> · {artist.hasToken ? "Conversions API ok" : "sem token da Conversions API"}
                    </>
                  ) : (
                    "O artista ainda não tem Pixel cadastrado"
                  )}
                </span>
              </span>
            </label>
            <label className="bo-radio-card">
              <input type="radio" checked={mode === "override"} onChange={() => setMode("override")} />
              <span>
                <b>Outro Pixel só para este evento</b>
                <br />
                <span className="small muted">Sobrescreve o do artista.</span>
              </span>
            </label>
          </div>
          {mode === "override" && (
            <div className="bo-form-grid">
              <label className="bo-field">
                <span>Pixel ID</span>
                <input name="metaPixelOverride" inputMode="numeric" defaultValue={initial.override} required />
              </label>
              <label className="bo-field">
                <span>Token da Conversions API</span>
                <input
                  name="metaCapiTokenOverride"
                  type="password"
                  autoComplete="off"
                  placeholder={initial.hasOverrideToken ? "•••••• configurado — digite para trocar" : "EAAG…"}
                />
              </label>
            </div>
          )}
        </div>
      </StepForm>

      <form action={testAction} className="bo-card" style={{ marginTop: 16 }}>
        <h3>Testar pixel</h3>
        <p className="muted small">Envia um PageView de teste pela Conversions API com o Pixel salvo. Salve antes de testar.</p>
        <div className="bo-actions">
          <input className="bo-input" style={{ maxWidth: 260 }} name="testEventCode" placeholder="Código de teste (ex.: TEST12345)" />
          <button className="bo-btn" disabled={testing}>
            {testing ? "Enviando…" : "Testar pixel"}
          </button>
        </div>
        {testState.error && <p className="bo-error" style={{ marginTop: 10 }}>{testState.error}</p>}
        {testState.notice && <p className="bo-success" style={{ marginTop: 10 }}>{testState.notice}</p>}
      </form>
    </>
  );
}
