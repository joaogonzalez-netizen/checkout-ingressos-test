"use client";

type FbqFn = (cmd: string, name: string, params?: Record<string, unknown>, opts?: { eventID: string }) => void;

declare global {
  interface Window {
    fbq?: FbqFn;
  }
}

export function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

function newEventId(name: string) {
  return `${name.toLowerCase()}-${crypto.randomUUID()}`;
}

/**
 * Dispara o evento no pixel do navegador e reforça no servidor (Conversions API) com o mesmo
 * event_id, para o Meta deduplicar. Purchase não passa por aqui: é enviado pelo backend após o webhook.
 */
export function trackFunnel(
  slug: string,
  name: "ViewContent" | "InitiateCheckout" | "AddPaymentInfo",
  params: Record<string, unknown> = {},
) {
  const eventId = newEventId(name);
  window.fbq?.("track", name, params, { eventID: eventId });
  const body = JSON.stringify({
    slug,
    name,
    eventId,
    sourceUrl: location.href,
    fbp: readCookie("_fbp"),
    fbc: readCookie("_fbc"),
  });
  const sent = navigator.sendBeacon?.("/api/pixel", new Blob([body], { type: "application/json" }));
  if (!sent) fetch("/api/pixel", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true });
}
