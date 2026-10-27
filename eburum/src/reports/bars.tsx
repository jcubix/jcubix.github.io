export function Bars({
  title,
  rows,
  unit = "",
  family = "attendance",
}: {
  title: string;
  rows: [string, number][];
  unit?: string;
  family?: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <article className="chart-card" data-chart-family={family}>
      <h4>{title}</h4>
      <p className="chart-scale">
        Scala: 0–{max} {unit.trim() || "registrazioni"}
      </p>
      {rows.map(([label, value]) => (
        <div className="chart-bar-row" key={label}>
          <span>{label}</span>
          <div className="chart-track">
            <div
              className="chart-fill"
              style={{ width: `${Math.round((value / max) * 100)}%` }}
            />
          </div>
          <b>
            {value}
            {unit}
          </b>
        </div>
      ))}
      {!rows.length ? (
        <p className="row-sub">Nessun dato registrato nel periodo.</p>
      ) : null}
    </article>
  );
}
