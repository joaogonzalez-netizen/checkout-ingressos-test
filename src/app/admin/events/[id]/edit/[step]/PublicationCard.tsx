import { setEventStatus } from "../../../actions";
import { ArchiveButton } from "../../../ArchiveButton";

type Status = "draft" | "published" | "closed";

/** Único lugar do backoffice onde o ciclo de vida do evento é controlado (publicar fica no bloco acima). */
export function PublicationCard({ eventId, status, archived }: { eventId: string; status: Status; archived: boolean }) {
  return (
    <div className="bo-card">
      <h2>Situação do evento</h2>

      {status === "published" && (
        <>
          <div className="bo-danger-row">
            <div>
              <h3>Encerrar vendas</h3>
              <p className="muted small" style={{ margin: 0 }}>
                A página continua no ar com o aviso de encerramento. O check-in segue funcionando.
              </p>
            </div>
            <form action={setEventStatus.bind(null, eventId, "closed")}>
              <button className="bo-btn">Encerrar vendas</button>
            </form>
          </div>
          <div className="bo-danger-row">
            <div>
              <h3>Tirar do ar</h3>
              <p className="muted small" style={{ margin: 0 }}>
                O link público deixa de funcionar e o evento volta para rascunho. Os pedidos nunca são apagados.
              </p>
            </div>
            <form action={setEventStatus.bind(null, eventId, "draft")}>
              <button className="bo-btn bo-btn-danger">Despublicar</button>
            </form>
          </div>
        </>
      )}

      {status === "closed" && (
        <div className="bo-danger-row">
          <div>
            <h3>Vendas encerradas</h3>
            <p className="muted small" style={{ margin: 0 }}>
              A página mostra o aviso de encerramento. Reabra para voltar a vender.
            </p>
          </div>
          <form action={setEventStatus.bind(null, eventId, "published")}>
            <button className="bo-btn">Reabrir vendas</button>
          </form>
        </div>
      )}

      <div className="bo-danger-row">
        <div>
          <h3>{archived ? "Evento arquivado" : "Arquivar"}</h3>
          <p className="muted small" style={{ margin: 0 }}>
            {archived
              ? "Não aparece na lista de eventos ativos. Pedidos e ingressos continuam guardados."
              : status === "published"
                ? "Sai da lista de eventos ativos e encerra as vendas. Pedidos e ingressos continuam guardados."
                : "Sai da lista de eventos ativos. Dá para desarquivar quando quiser."}
          </p>
        </div>
        <ArchiveButton eventId={eventId} archived={archived} published={status === "published"} />
      </div>
    </div>
  );
}
