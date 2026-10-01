"use client";

import { useState } from "react";
import { generatePassword, passwordChecks } from "@/lib/password-policy";

type Props = {
  name: string;
  label: string;
  /** Nome e e-mail da pessoa, para barrar senha que os contenha. */
  context?: { name?: string; email?: string };
  /** Mostra o botão "Gerar senha forte" (cadastro/redefinição feita por um admin). */
  allowGenerate?: boolean;
  onChange?: (value: string) => void;
};

export function PasswordField({ name, label, context, allowGenerate, onChange }: Props) {
  const [value, setValue] = useState("");
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);
  const checks = passwordChecks(value, context);
  const passed = checks.filter((c) => c.ok).length;

  function update(v: string) {
    setValue(v);
    setCopied(false);
    onChange?.(v);
  }

  return (
    <div className="bo-field">
      <span>{label}</span>
      <div className="bo-password">
        <input
          name={name}
          type={visible ? "text" : "password"}
          autoComplete="new-password"
          required
          value={value}
          onChange={(e) => update(e.target.value)}
          spellCheck={false}
        />
        <button type="button" className="bo-btn bo-btn-sm" onClick={() => setVisible((v) => !v)} aria-pressed={visible}>
          {visible ? "Ocultar" : "Mostrar"}
        </button>
      </div>
      {allowGenerate && (
        <div className="bo-actions" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="bo-btn bo-btn-sm"
            onClick={() => {
              update(generatePassword());
              setVisible(true);
            }}
          >
            Gerar senha forte
          </button>
          {value && (
            <button
              type="button"
              className="bo-btn bo-btn-sm"
              onClick={async () => {
                await navigator.clipboard?.writeText(value);
                setCopied(true);
              }}
            >
              {copied ? "Copiada" : "Copiar"}
            </button>
          )}
        </div>
      )}
      <div className="bo-strength" aria-live="polite">
        <div className="bo-strength-bar">
          <i style={{ transform: `scaleX(${passed / checks.length})` }} className={passed === checks.length ? "ok" : passed >= 5 ? "mid" : "low"} />
        </div>
        <ul>
          {checks.map((c) => (
            <li key={c.id} className={c.ok ? "ok" : ""}>
              {c.ok ? "✓" : "○"} {c.label}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
