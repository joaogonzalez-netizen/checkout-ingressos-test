"use client";

import { setEventArchived } from "./actions";

/** Arquivar/desarquivar com confirmação quando o evento ainda está vendendo. */
export function ArchiveButton({ eventId, archived, published, small }: { eventId: string; archived: boolean; published: boolean; small?: boolean }) {
  return (
    <form
      action={setEventArchived.bind(null, eventId, !archived)}
      onSubmit={(e) => {
        if (!archived && published && !confirm("Este evento está publicado. Arquivar encerra as vendas. Continuar?")) e.preventDefault();
      }}
    >
      <button className={`bo-btn${small ? " bo-btn-sm" : ""}`}>{archived ? "Desarquivar" : "Arquivar"}</button>
    </form>
  );
}
