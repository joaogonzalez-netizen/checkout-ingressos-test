/** Caixa com o formato exigido, mostrada ao lado de cada upload. */
export function MediaSpec({ rows, tip }: { rows: [string, string][]; tip?: string }) {
  return (
    <div className="bo-spec">
      <dl>
        {rows.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      {tip && <p className="bo-hint">💡 {tip}</p>}
    </div>
  );
}
