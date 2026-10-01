import { requireAdmin } from "@/lib/auth";
import { OrdersView } from "../components/OrdersView";

export const metadata = { title: "Vendas · Backoffice" };

export default async function AllOrders({ searchParams }: PageProps<"/admin/orders">) {
  await requireAdmin();
  return (
    <>
      <div className="bo-page-head">
        <div>
          <h1>Vendas</h1>
          <p className="muted">Pedidos de todos os eventos. Procure por nome, e-mail, telefone, CPF, código do ingresso ou nº do pedido.</p>
        </div>
      </div>
      <OrdersView search={await searchParams} />
    </>
  );
}
