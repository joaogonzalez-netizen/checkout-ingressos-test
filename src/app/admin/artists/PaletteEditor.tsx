"use client";

import { useMemo, useState } from "react";
import { paletteContrastChecks } from "@/lib/contrast";
import { accessiblePrimary, isSuggested, suggestPalette } from "@/lib/palette-suggest";
import { isHexColor, paletteStyle, type Palette } from "@/lib/palette";

type DerivedKey = Exclude<keyof Palette, "primary">;

const DERIVED: { key: DerivedKey; label: string; hint: string }[] = [
  { key: "secondary", label: "Secundária", hint: "Faixa do evento e modo escuro" },
  { key: "accent", label: "Destaque", hint: "Botão principal ao lado do vídeo" },
  { key: "background", label: "Fundo", hint: "Fundo da página" },
];

/**
 * O usuário escolhe só a primária; secundária, destaque e fundo são sugeridas a partir dela.
 * Qualquer uma pode ser editada: a editada para de acompanhar a primária até "usar sugestão".
 */
export function PaletteEditor({ initial, isNew }: { initial: Palette; isNew: boolean }) {
  const [colors, setColors] = useState<Palette>(initial);
  const [edited, setEdited] = useState<Record<DerivedKey, boolean>>(() => ({
    secondary: !isNew && !isSuggested(initial, "secondary"),
    accent: !isNew && !isSuggested(initial, "accent"),
    background: !isNew && !isSuggested(initial, "background"),
  }));
  const suggestion = useMemo(() => (isHexColor(colors.primary) ? suggestPalette(colors.primary) : null), [colors.primary]);
  const checks = useMemo(
    () => (Object.values(colors).every(isHexColor) ? paletteContrastChecks(colors) : []),
    [colors],
  );
  const failing = checks.filter((c) => !c.ok);
  const betterPrimary = isHexColor(colors.primary) ? accessiblePrimary(colors.primary) : null;

  function setPrimary(value: string) {
    setColors((c) => {
      const next = { ...c, primary: value };
      if (!isHexColor(value)) return next;
      const s = suggestPalette(value);
      for (const { key } of DERIVED) if (!edited[key]) next[key] = s[key];
      return next;
    });
  }

  function setDerived(key: DerivedKey, value: string) {
    setColors((c) => ({ ...c, [key]: value }));
    setEdited((e) => ({ ...e, [key]: true }));
  }

  function applySuggestion(key?: DerivedKey) {
    if (!suggestion) return;
    const keys = key ? [key] : DERIVED.map((d) => d.key);
    setColors((c) => ({ ...c, ...Object.fromEntries(keys.map((k) => [k, suggestion[k]])) }));
    setEdited((e) => ({ ...e, ...Object.fromEntries(keys.map((k) => [k, false])) }));
  }

  const anyEdited = DERIVED.some((d) => edited[d.key]);

  return (
    <div className="bo-card">
      <h2>Paleta de cores</h2>
      <p className="bo-hint" style={{ marginTop: -6, marginBottom: 14 }}>
        Escolha a cor principal do artista. As outras três são sugeridas a partir dela e podem ser ajustadas.
      </p>

      <div className="bo-palette">
        <div className="bo-palette-primary">
          <label className="bo-field">
            <span>Cor primária</span>
            <div className="bo-color">
              <input type="color" value={isHexColor(colors.primary) ? colors.primary : "#000000"} onChange={(e) => setPrimary(e.target.value)} aria-label="Primária (seletor)" />
              <input className="bo-input" name="primary" value={colors.primary} pattern="#[0-9a-fA-F]{6}" onChange={(e) => setPrimary(e.target.value)} />
            </div>
            <span className="bo-hint">Botões, números das etapas, preços e destaques do título</span>
          </label>
          {betterPrimary && (
            <div className="bo-warn" style={{ marginTop: 10 }}>
              Texto branco fica difícil de ler nesta cor. Sugestão: <code>{betterPrimary}</code>{" "}
              <button type="button" className="bo-btn bo-btn-sm" onClick={() => setPrimary(betterPrimary)}>
                Usar versão mais escura
              </button>
            </div>
          )}
        </div>

        <div className="bo-palette-derived">
          {DERIVED.map((f) => (
            <label className="bo-field" key={f.key}>
              <span>
                {f.label}{" "}
                <em className={`bo-chip ${edited[f.key] ? "edited" : ""}`}>{edited[f.key] ? "editada" : "sugerida"}</em>
              </span>
              <div className="bo-color">
                <input type="color" value={isHexColor(colors[f.key]) ? colors[f.key] : "#000000"} onChange={(e) => setDerived(f.key, e.target.value)} aria-label={`${f.label} (seletor)`} />
                <input className="bo-input" name={f.key} value={colors[f.key]} pattern="#[0-9a-fA-F]{6}" onChange={(e) => setDerived(f.key, e.target.value)} />
              </div>
              <span className="bo-hint">
                {f.hint}
                {edited[f.key] && suggestion && (
                  <>
                    {" · "}
                    <button type="button" className="bo-link" onClick={() => applySuggestion(f.key)}>
                      usar sugestão ({suggestion[f.key]})
                    </button>
                  </>
                )}
              </span>
            </label>
          ))}
          {anyEdited && (
            <div>
              <button type="button" className="bo-btn bo-btn-sm" onClick={() => applySuggestion()}>
                ↺ Sugerir de novo as três a partir da primária
              </button>
            </div>
          )}
        </div>

        {Object.values(colors).every(isHexColor) && (
          <div className="bo-palette-preview" style={paletteStyle(colors)} aria-label="Prévia das cores">
            <div className="pv-strip">
              <small>FINALIZANDO COMPRA</small>
              <b>Nome do espetáculo</b>
            </div>
            <div className="pv-body">
              <b>
                Título com <span>destaque</span>
              </b>
              <span className="pv-cta">Quero garantir meu ingresso</span>
              <span className="pv-btn">Finalizar compra →</span>
            </div>
          </div>
        )}
      </div>

      <div style={{ marginTop: 14 }}>
        {failing.length === 0 ? (
          <p className="bo-success">Contraste ok em todos os pares usados pela página (WCAG AA).</p>
        ) : (
          <div className="bo-warn">
            <b>Contraste abaixo do WCAG AA (4,5:1)</b> — o texto pode ficar difícil de ler:
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {failing.map((c) => (
                <li key={c.label}>
                  {c.label}: {c.ratio.toFixed(2).replace(".", ",")}:1
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
