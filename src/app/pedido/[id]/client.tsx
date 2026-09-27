"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export function OrderStatusPoller({ orderId, token }: { orderId: string; token: string }) {
  const router = useRouter();
  useEffect(() => {
    const id = setInterval(async () => {
      const res = await fetch(`/api/checkout/orders/${orderId}?t=${token}`, { cache: "no-store" });
      if (!res.ok) return;
      const body = await res.json();
      if (body.status !== "pending") router.refresh();
    }, 4000);
    return () => clearInterval(id);
  }, [orderId, token, router]);
  return null;
}

/** Purchase no navegador com o mesmo event_id do envio server-side, para o Meta deduplicar. */
export function PurchasePixel({ eventId, valueCents }: { eventId: string; valueCents: number }) {
  useEffect(() => {
    const fire = () => window.fbq?.("track", "Purchase", { currency: "BRL", value: valueCents / 100 }, { eventID: eventId });
    if (window.fbq) fire();
    else {
      const t = setTimeout(fire, 1500);
      return () => clearTimeout(t);
    }
  }, [eventId, valueCents]);
  return null;
}
