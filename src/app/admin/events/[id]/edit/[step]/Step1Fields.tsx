"use client";

import { useMemo, useState } from "react";
import { suggestEventSlug } from "@/lib/slug";
import { UFS, canonicalCity, citiesOf } from "@/lib/localidades";
import { AGE_RATINGS } from "@/lib/legal-defaults";

type Values = {
  showName: string;
  city: string;
  state: string;
  venueName: string;
  venueAddress: string;
  date: string;
  time: string;
  doorsTime: string;
  endTime: string;
  ageRating: string;
  ageRatingNote: string;
  slug: string;
  suggestedSlug: string;
};

export function Step1Fields({
  initial,
  artistSlug,
  published,
  minDate,
}: {
  initial: Values;
  artistSlug: string;
  published: boolean;
  minDate: string;
}) {
  const [uf, setUf] = useState(UFS.some((u) => u.sigla === initial.state.toUpperCase()) ? initial.state.toUpperCase() : "");
  const [city, setCity] = useState(initial.city);
  const cities = useMemo(() => citiesOf(uf), [uf]);
  const officialCity = uf && city ? canonicalCity(uf, city) : null;
  const cityError = uf && city && !officialCity ? `"${city}" não é um município de ${uf}. Escolha da lista.` : null;
  const [date, setDate] = useState(initial.date);
  const [slug, setSlug] = useState(initial.slug);
  // Slug sugerido automaticamente ({artista}-{cidade}-{data}) até o usuário editar à mão.
  const [touched, setTouched] = useState(!!initial.slug && initial.slug !== initial.suggestedSlug);
  const suggested = officialCity && date ? suggestEventSlug(artistSlug, officialCity, date) : "";
  // Publicado: o link é fixo (anúncios já apontam para ele), mesmo que a cidade mude.
  const value = published ? initial.slug : touched ? slug : suggested || slug;

  return (
    <div className="bo-card">
      <h2>Dados do evento</h2>
      {published && (
        <p className="bo-warn" style={{ marginBottom: 14 }}>
          Evento publicado: mudanças de data, horário ou local exigem avisar os compradores.
        </p>
      )}
      <div className="bo-form-grid">
        <label className="bo-field span-2">
          <span>Nome do espetáculo</span>
          <input name="showName" required defaultValue={initial.showName} />
          <span className="bo-hint">Sugerido pelo cadastro do artista.</span>
        </label>
        <label className="bo-field">
          <span>Estado</span>
          <select
            name="state"
            required
            value={uf}
            onChange={(e) => {
              setUf(e.target.value);
              setCity("");
            }}
          >
            <option value="" disabled>
              Selecione o estado
            </option>
            {UFS.map((u) => (
              <option key={u.sigla} value={u.sigla}>
                {u.nome} ({u.sigla})
              </option>
            ))}
          </select>
        </label>
        <label className="bo-field">
          <span>Cidade</span>
          <input
            name="city"
            required
            list="bo-cities"
            autoComplete="off"
            disabled={!uf}
            value={city}
            aria-invalid={!!cityError}
            placeholder={uf ? `Digite para buscar entre ${cities.length} cidades` : "Escolha o estado primeiro"}
            onChange={(e) => setCity(e.target.value)}
            // Ao sair do campo, troca pelo nome oficial ("joinville" -> "Joinville").
            onBlur={() => officialCity && setCity(officialCity)}
          />
          <datalist id="bo-cities">
            {cities.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
          {cityError ? <span className="bo-hint" style={{ color: "var(--danger)" }}>{cityError}</span> : <span className="bo-hint">Lista oficial de municípios do IBGE.</span>}
        </label>
        <label className="bo-field">
          <span>Local</span>
          <input name="venueName" required defaultValue={initial.venueName} placeholder="Teatro Estação BH" />
        </label>
        <label className="bo-field">
          <span>Endereço</span>
          <input name="venueAddress" required defaultValue={initial.venueAddress} placeholder="Rua, número, bairro" />
        </label>
        <label className="bo-field">
          <span>Data</span>
          <input name="date" type="date" required min={minDate} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <div className="bo-form-grid" style={{ gap: 10 }}>
          <label className="bo-field">
            <span>Horário</span>
            <input name="time" type="time" required defaultValue={initial.time} />
          </label>
          <label className="bo-field">
            <span>Portões (opcional)</span>
            <input name="doorsTime" type="time" defaultValue={initial.doorsTime} />
          </label>
        </div>
        <label className="bo-field">
          <span>Término previsto (opcional)</span>
          <input name="endTime" type="time" defaultValue={initial.endTime} />
          <span className="bo-hint">Se passar da meia-noite, é entendido como o dia seguinte.</span>
        </label>
        <div className="bo-form-grid" style={{ gap: 10 }}>
          <label className="bo-field">
            <span>Classificação indicativa</span>
            <select name="ageRating" required defaultValue={initial.ageRating}>
              <option value="" disabled>
                Selecione
              </option>
              {AGE_RATINGS.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </label>
          <label className="bo-field">
            <span>Observação (opcional)</span>
            <input name="ageRatingNote" defaultValue={initial.ageRatingNote} placeholder="Menores só com responsável" maxLength={140} />
          </label>
        </div>
        <label className="bo-field span-2">
          <span>Slug da URL</span>
          <input
            name="slug"
            required
            value={value}
            readOnly={published}
            onChange={(e) => {
              setTouched(true);
              setSlug(e.target.value);
            }}
          />
          <span className="bo-hint">
            /e/{value || "…"} · {published ? "fixo depois de publicado" : "sugerido como {artista}-{cidade}-{data}, editável"}
          </span>
        </label>
      </div>
    </div>
  );
}
