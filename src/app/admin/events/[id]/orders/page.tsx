import { OrdersView } from "../../../components/OrdersView";

export default async function EventOrders({ params, searchParams }: PageProps<"/admin/events/[id]/orders">) {
  const { id } = await params;
  return <OrdersView eventId={id} search={await searchParams} title="Vendas deste evento" />;
}
