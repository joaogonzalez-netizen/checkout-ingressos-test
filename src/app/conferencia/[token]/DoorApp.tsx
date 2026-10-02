"use client";

import { useRef, useState } from "react";
import type { DoorFind, DoorOrder, DoorStats } from "@/lib/door-orders";
import { doorFind, doorOpen, doorRelease, leaveDoor } from "./actions";
import { Scanner } from "./Scanner";

type How = "qr" | "code" | "list";
type Done = {
  released: { code: string }[];
  rejected: { code: string; reason: "used" | "canceled" | "invalid"; usedAt: string | null; usedBy: string | null }[];
} | null;

const CODE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{4}$/;

function clock(iso: string | null) {
  return iso ? new Date(iso).toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" }) : "";
}
const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

export function DoorApp({ token, eventName, staffName, initialStats }: { token: string; eventName: string; staffName: string; initialStats: DoorStats }) {
  const [stats, setStats] = useState(initialStats);
  const [query, setQuery] = useState("");
  const [find, setFind] = useState<DoorFind | null>(null);
  const [order, setOrder] = useState<DoorOrder | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [how, setHow] = useState<How>("list");
  const [done, setDone] = useState<Done>(null);
  // Leitura de QR pela câmera é o método padrão: abre sozinha e volta a abrir a cada "Próximo cliente".
  const [scanning, setScanning] = useState(true);
  const [autoScan, setAutoScan] = useState(true);
  const [expired, setExpired] = useState(false);
  const [busy, setBusy] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  function showOrder(o: DoorOrder, via: How) {
    setOrder(o);
    setHow(via);
    setDone(null);
    // Quem chega junto costuma ser o grupo todo: já vem tudo que está pendente marcado; desmarque quem ainda não chegou.
    setSelected(new Set(o.tickets.filter((t) => t.status === "valid").map((t) => t.id)));
  }

  async function run(value: string, source: "qr" | "text") {
    if (source === "text") setScanning(false);
    setBusy(true);
    try {
      const res = await doorFind(token, value);
      if ("expired" in res) return setExpired(true);
      setStats(res.stats);
      setFind(res.find);
      if (res.find.kind === "order") {
        const via: How = source === "qr" ? "qr" : CODE.test(value.trim().toUpperCase().replace(/\s/g, "")) && res.find.order.highlightId ? "code" : "list";
        showOrder(res.find.order, via);
      } else {
        setOrder(null);
        setDone(null);
      }
    } finally {
      setBusy(false);
    }
  }

  async function open(orderId: string) {
    setBusy(true);
    try {
      const res = await doorOpen(token, orderId);
      if ("expired" in res) return setExpired(true);
      setStats(res.stats);
      if (res.order) showOrder(res.order, "list");
    } finally {
      setBusy(false);
    }
  }

  async function release() {
    if (!order || selected.size === 0) return;
    setBusy(true);
    try {
      const res = await doorRelease(token, order.orderId, [...selected], how);
      if ("expired" in res) return setExpired(true);
      setStats(res.stats);
      setOrder(res.order);
      setSelected(new Set());
      setDone({ released: res.released, rejected: res.rejected });
      navigator.vibrate?.(res.rejected.length ? [80, 60, 80] : 120);
    } finally {
      setBusy(false);
    }
  }

  function next() {
    setFind(null);
    setOrder(null);
    setDone(null);
    setQuery("");
    if (autoScan) setScanning(true);
    else input.current?.focus();
  }

  function toggle(id: string) {
    setSelected((cur) => {
      const n = new Set(cur);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  }

  if (expired) {
    return (
      <main className="dr dr-center">
        <div className="dr-card">
          <h1>Sessão encerrada</h1>
          <p>O PIN mudou, o link foi desativado ou a sessão venceu. Entre de novo para continuar.</p>
          <button className="dr-btn dr-btn-primary dr-btn-block" onClick={() => window.location.reload()}>
            Entrar de novo
          </button>
        </div>
      </main>
    );
  }

  const pending = order ? order.tickets.filter((t) => t.status === "valid") : [];
  const active = order ? order.tickets.filter((t) => t.status !== "canceled") : [];
  const allIn = !!order && pending.length === 0 && active.length > 0;
  const pct = stats.total ? Math.round((stats.used / stats.total) * 100) : 0;

  return (
    <main className="dr">
      <header className="dr-top">
        <div className="dr-top-title">
          <b>{eventName}</b>
          <span>Conferência · {staffName}</span>
        </div>
        <div className="dr-count" aria-live="polite" aria-label={`${stats.used} de ${stats.total} ingressos já entraram`}>
          <b>{stats.used}</b>
          <span>de {stats.total}</span>
        </div>
        <form action={leaveDoor.bind(null, token)}>
          <button className="dr-btn dr-btn-quiet" type="submit">
            Sair
          </button>
        </form>
      </header>
      <div className="dr-bar" role="progressbar" aria-valuemin={0} aria-valuemax={stats.total} aria-valuenow={stats.used} aria-label="Ingressos que já entraram">
        <i style={{ transform: `scaleX(${pct / 100})` }} />
      </div>

      {scanning && (
        <Scanner
          onClose={() => {
            setScanning(false);
            setAutoScan(false);
          }}
          onError={() => setAutoScan(false)}
          onResult={(value) => {
            setScanning(false);
            setQuery("");
            void run(value, "qr");
          }}
        />
      )}

      <form
        className="dr-search"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          if (query.trim()) void run(query, "text");
        }}
      >
        <input
          ref={input}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, telefone ou código de 4 caracteres"
          aria-label="Nome, telefone ou código de 4 caracteres"
          autoComplete="off"
          autoCapitalize="none"
          enterKeyHint="search"
        />
        <button className="dr-btn dr-btn-primary" disabled={busy || !query.trim()}>
          {busy ? "…" : "Buscar"}
        </button>
        <button
          type="button"
          className={`dr-btn${scanning ? " dr-btn-on" : ""}`}
          aria-pressed={scanning}
          onClick={() => {
            setAutoScan(!scanning);
            setScanning(!scanning);
          }}
        >
          {scanning ? "Fechar câmera" : "Ler QR pela câmera"}
        </button>
      </form>

      <div aria-live="assertive">
        {find?.kind === "error" && (
          <div className="dr-banner dr-bad" role="status">
            <b>✕ {find.message}</b>
            <button className="dr-btn" onClick={next}>
              Próximo cliente
            </button>
          </div>
        )}

        {find?.kind === "list" && !order && (
          <section className="dr-list" aria-label="Compras encontradas">
            <p className="dr-hint">{find.items.length} compras combinam. Toque na certa:</p>
            <ul>
              {find.items.map((i) => (
                <li key={i.orderId}>
                  <button type="button" onClick={() => open(i.orderId)} disabled={busy}>
                    <b>{i.buyer}</b>
                    <span>
                      {i.phoneEnd ? `final ${i.phoneEnd} · ` : ""}
                      {plural(i.total, "ingresso", "ingressos")} · {i.pending === 0 ? "todos já entraram" : `${i.pending} para liberar`}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {order && (
          <section className="dr-order" aria-label={`Compra de ${order.buyer}`}>
            {done && done.released.length > 0 && (
              <div className="dr-banner dr-good" role="status">
                <b>✓ {plural(done.released.length, "entrada liberada", "entradas liberadas")}</b>
                <span>{done.released.map((r) => r.code).join(" · ")}</span>
              </div>
            )}
            {done && done.rejected.length > 0 && (
              <div className="dr-banner dr-bad" role="status">
                <b>✕ {plural(done.rejected.length, "ingresso não foi liberado", "ingressos não foram liberados")}</b>
                {done.rejected.map((r) => (
                  <span key={r.code}>
                    {r.code}: {r.reason === "used" ? `já tinha entrado${r.usedAt ? ` às ${clock(r.usedAt)}` : ""}${r.usedBy ? ` (${r.usedBy})` : ""}` : r.reason === "canceled" ? "ingresso cancelado" : "inválido"}
                  </span>
                ))}
              </div>
            )}
            {!done && allIn && (
              <div className="dr-banner dr-bad" role="status">
                <b>✕ Todos os ingressos desta compra já entraram</b>
              </div>
            )}

            <header className="dr-order-head">
              <h2>{order.buyer}</h2>
              <p>
                {order.phoneEnd ? `Telefone final ${order.phoneEnd} · ` : ""}
                {pending.length === 0 ? `${plural(active.length, "ingresso", "ingressos")}, todos já entraram` : `${pending.length} de ${plural(active.length, "ingresso", "ingressos")} para liberar`}
              </p>
            </header>

            <ul className="dr-tickets">
              {order.tickets.map((t) => (
                <li key={t.id} className={`dr-ticket ${t.status}${t.id === order.highlightId ? " hl" : ""}`}>
                  <label>
                    <input type="checkbox" disabled={t.status !== "valid" || busy} checked={selected.has(t.id)} onChange={() => toggle(t.id)} />
                    <span className="dr-tk-main">
                      <b>{t.code}</b>
                      <span>
                        {t.lot}
                        {t.seat ? ` · poltrona ${t.seat}` : ""}
                        {t.id === order.highlightId ? " · lido agora" : ""}
                      </span>
                    </span>
                    <span className="dr-tk-state">
                      {t.status === "valid" ? "Pendente" : t.status === "used" ? `Entrou às ${clock(t.usedAt)}${t.usedBy ? ` · ${t.usedBy}` : ""}` : "Cancelado (estornado)"}
                    </span>
                  </label>
                </li>
              ))}
            </ul>

            {pending.length > 1 && (
              <button
                type="button"
                className="dr-link"
                onClick={() => setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((t) => t.id)))}
              >
                {selected.size === pending.length ? "Desmarcar todos" : "Marcar todos"}
              </button>
            )}
            <div className="dr-actions">
              {pending.length > 0 && (
                <button className="dr-btn dr-btn-go dr-btn-block" onClick={release} disabled={busy || selected.size === 0}>
                  {busy ? "Liberando…" : selected.size === 0 ? "Marque quem chegou" : `Liberar ${plural(selected.size, "entrada", "entradas")}`}
                </button>
              )}
              <button className={`dr-btn dr-btn-block${pending.length === 0 || done ? " dr-btn-primary" : ""}`} onClick={next}>
                Próximo cliente
              </button>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
