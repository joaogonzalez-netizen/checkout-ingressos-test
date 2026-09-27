"use client";

export function PrintButton() {
  return (
    <button type="button" className="bo-btn bo-btn-pill" onClick={() => window.print()}>
      Imprimir lista
    </button>
  );
}
