import Script from "next/script";

/**
 * Snippet oficial do Meta Pixel montado a partir do Pixel ID cadastrado.
 * Não há campo de código livre no MVP (risco de script ao lado do checkout).
 */
export function MetaPixel({ pixelId, pageViewEventId }: { pixelId: string; pageViewEventId: string }) {
  const safeId = pixelId.replace(/\D/g, "");
  if (!safeId) return null;
  return (
    <Script id="meta-pixel" strategy="afterInteractive">
      {`!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
document,'script','https://connect.facebook.net/en_US/fbevents.js');
fbq('init','${safeId}');fbq('track','PageView',{},{eventID:'${pageViewEventId}'});`}
    </Script>
  );
}
