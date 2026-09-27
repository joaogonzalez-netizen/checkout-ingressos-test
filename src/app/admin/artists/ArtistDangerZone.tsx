"use client";

import { useActionState, useState } from "react";
import { deleteArtist, setArtistArchived, type DeleteArtistState } from "./actions";

type Props = {
  artistId: string;
  name: string;
  archived: boolean;
  publishedEvents: number;
  eventsWithOrders: number;
  totalEvents: number;
};

export function ArtistDangerZone({ artistId, name, archived, publishedEvents, eventsWithOrders, totalEvents }: Props) {
  const [state, action, pending] = useActionState<DeleteArtistState, FormData>(deleteArtist.bind(null, artistId), {});
  const [typed, setTyped] = useState("");
  const canDelete = eventsWithOrders === 0;

  return (
    <div className="bo-card bo-danger">
      <h2>Desativar ou excluir</h2>

      <div className="bo-danger-row">
        <div>
          <h3>{archived ? "Reativar artista" : "Desativar artista"}</h3>
          <p className="bo-hint">
            {archived
              ? "Volta a aparecer na lista e a receber eventos novos."
              : "Some da lista de artistas e não pode receber eventos novos. Dá para reativar a qualquer momento."}
            {!archived && publishedEvents > 0 && (
              <>
                {" "}
                <b>
                  {publishedEvents} evento(s) publicado(s) continuam no ar vendendo.
                </b>{" "}
                Para tirar do ar, use &quot;Despublicar&quot; em cada evento.
              </>
            )}
          </p>
        </div>
        <form action={setArtistArchived.bind(null, artistId, !archived)}>
          <button className="bo-btn">{archived ? "Reativar" : "Desativar"}</button>
        </form>
      </div>

      <div className="bo-danger-row">
        <div>
          <h3>Excluir artista</h3>
          {canDelete ? (
            <p className="bo-hint">
              Apaga de vez o artista{totalEvents > 0 ? `, os ${totalEvents} evento(s) dele (nenhum tem pedido)` : ""} e as imagens enviadas. Não
              dá para desfazer.
            </p>
          ) : (
            <p className="bo-hint">
              Não pode ser excluído: {eventsWithOrders} evento(s) já têm pedidos, que precisam ficar guardados para a conciliação com a Asaas.
              Use &quot;Desativar&quot;.
            </p>
          )}
        </div>
      </div>
      {canDelete && (
        <form
          action={action}
          className="bo-actions"
          onSubmit={(e) => {
            if (!confirm(`Excluir "${name}" de vez? Não dá para desfazer.`)) e.preventDefault();
          }}
        >
          <input
            className="bo-input"
            style={{ maxWidth: 320 }}
            name="confirmName"
            placeholder={`Digite "${name}" para confirmar`}
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            autoComplete="off"
          />
          <button className="bo-btn bo-btn-danger" disabled={typed.trim() !== name || pending}>
            {pending ? "Excluindo…" : "Excluir de vez"}
          </button>
        </form>
      )}
      {state.error && <p className="bo-error">{state.error}</p>}
    </div>
  );
}
